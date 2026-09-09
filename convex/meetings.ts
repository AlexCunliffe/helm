/**
 * Meetings — server-side Google Calendar sync (slice 4.2, D12).
 *
 * The day thread needs meetings IN the brain (markers, countdowns, T-30 prep
 * promotion) — not proposals from a client-side sweep. A cron action pulls
 * today+tomorrow from the Google Calendar API using an OAuth refresh token
 * held as Convex secrets (GOOGLE_CAL_CLIENT_ID / _SECRET / _REFRESH_TOKEN)
 * and REPLACES the window — the table is a rolling mirror, never an archive.
 * Unset secrets → the sync skips quietly (the cron must not error-spam while
 * the OAuth gate is open).
 *
 * T-30: a meeting with a linked prep task promotes it once (status today +
 * urgent) as the meeting comes within 30 minutes — "meeting prep takes the
 * stage" (docs/06-surfaces.md). The stamp means a deliberate demotion isn't fought.
 */
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireKey } from "./lib/auth";
import { meetingFields, meetingDoc } from "./validators";

const apiKeyArg = { apiKey: v.optional(v.string()) };
const HOUR_MS = 60 * 60 * 1000;
const PREP_LEAD_MS = 30 * 60 * 1000;

// ── the sync (cron) ──────────────────────────────────────────────────────────

export const syncGoogleCalendar = internalAction({
  args: {},
  returns: v.object({ synced: v.number(), skipped: v.boolean() }),
  handler: async (ctx) => {
    // trim(): a stray newline from a paste breaks OAuth invisibly.
    const clientId = process.env.GOOGLE_CAL_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CAL_CLIENT_SECRET?.trim();
    const refreshToken = process.env.GOOGLE_CAL_REFRESH_TOKEN?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
      return { synced: 0, skipped: true }; // OAuth gate still open — stay quiet
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenRes.ok) {
      // Google's error body says WHICH credential is wrong (invalid_client =
      // id/secret; invalid_grant = refresh token) — surface it, it's not secret.
      const body = (await tokenRes.text()).slice(0, 300);
      throw new Error(`calendar: token refresh failed (${tokenRes.status}) — ${body}`);
    }
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const now = Date.now();
    const windowStart = now - 2 * HOUR_MS; // keep in-progress meetings visible
    const windowEnd = now + 48 * HOUR_MS;
    const params = new URLSearchParams({
      timeMin: new Date(windowStart).toISOString(),
      timeMax: new Date(windowEnd).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!eventsRes.ok) {
      throw new Error(`calendar: events fetch failed (${eventsRes.status})`);
    }
    const data = (await eventsRes.json()) as {
      items?: Array<{
        id: string;
        summary?: string;
        htmlLink?: string;
        status?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };

    // Timed events only — all-day rows would sit meaninglessly on the thread.
    const meetings = (data.items ?? [])
      .filter((e) => e.status !== "cancelled" && e.start?.dateTime && e.end?.dateTime)
      .map((e) => ({
        eventId: e.id,
        title: e.summary ?? "(untitled)",
        startAt: Date.parse(e.start!.dateTime!),
        endAt: Date.parse(e.end!.dateTime!),
        url: e.htmlLink,
      }));

    await ctx.runMutation(internal.meetings.replaceWindow, {
      windowStart,
      windowEnd,
      meetings,
    });
    return { synced: meetings.length, skipped: false };
  },
});

/**
 * Shape-check the Google OAuth secrets WITHOUT exposing them — runs where the
 * secrets already live and returns only verdicts (prefix/suffix/length/
 * whitespace). `npx convex run meetings:calendarDiag` when the sync 401s.
 */
export const calendarDiag = internalAction({
  args: {},
  returns: v.object({ clientId: v.string(), clientSecret: v.string(), refreshToken: v.string() }),
  handler: async () => {
    const check = (
      raw: string | undefined,
      expect: { prefix?: string; suffix?: string; min: number },
    ): string => {
      if (!raw) return "MISSING";
      const t = raw.trim();
      const notes: string[] = [];
      if (t !== raw) notes.push("has surrounding whitespace (now tolerated, but re-set cleanly)");
      if (expect.prefix && !t.startsWith(expect.prefix)) notes.push(`doesn't start with "${expect.prefix}"`);
      if (expect.suffix && !t.endsWith(expect.suffix)) notes.push(`doesn't end with "${expect.suffix}"`);
      if (t.length < expect.min) notes.push(`suspiciously short`);
      return notes.length ? `⚠️ ${notes.join("; ")} (len ${t.length})` : `looks right (len ${t.length})`;
    };
    return {
      clientId: check(process.env.GOOGLE_CAL_CLIENT_ID, {
        suffix: ".apps.googleusercontent.com",
        min: 40,
      }),
      clientSecret: check(process.env.GOOGLE_CAL_CLIENT_SECRET, { prefix: "GOCSPX-", min: 20 }),
      refreshToken: check(process.env.GOOGLE_CAL_REFRESH_TOKEN, { prefix: "1//", min: 50 }),
    };
  },
});

/**
 * Replace the sync window's rows. Prep links survive: a fresh row for an
 * eventId inherits prepTaskId/prepPromotedAt from the row it replaces.
 */
export const replaceWindow = internalMutation({
  args: {
    windowStart: v.number(),
    windowEnd: v.number(),
    meetings: v.array(
      v.object({
        eventId: v.string(),
        title: v.string(),
        startAt: v.number(),
        endAt: v.number(),
        url: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { windowStart, windowEnd, meetings }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("meetings")
      .withIndex("by_start", (q) => q.gte("startAt", windowStart).lt("startAt", windowEnd))
      .collect();
    const links = new Map(
      existing.map((m) => [m.eventId, { prepTaskId: m.prepTaskId, prepPromotedAt: m.prepPromotedAt }]),
    );
    for (const m of existing) await ctx.db.delete(m._id);
    for (const m of meetings) {
      const link = links.get(m.eventId);
      await ctx.db.insert("meetings", {
        ...m,
        prepTaskId: link?.prepTaskId,
        prepPromotedAt: link?.prepPromotedAt,
        updatedAt: now,
      });
    }
    return null;
  },
});

// ── reads + prep linking ─────────────────────────────────────────────────────

/** The day thread's markers: in-progress + upcoming, ordered by start. */
export const upcomingMeetings = query({
  args: { ...apiKeyArg, horizonHours: v.optional(v.number()) },
  returns: v.array(meetingDoc),
  handler: async (ctx, { apiKey, horizonHours }) => {
    requireKey(apiKey);
    const now = Date.now();
    const horizon = now + Math.min(horizonHours ?? 36, 72) * HOUR_MS;
    return await ctx.db
      .query("meetings")
      .withIndex("by_start", (q) => q.gte("startAt", now - 2 * HOUR_MS).lt("startAt", horizon))
      .collect();
  },
});

/** Link (or unlink) a prep task to a meeting — the T-30 promotion target. */
export const linkPrep = mutation({
  args: {
    ...apiKeyArg,
    eventId: v.string(),
    taskId: v.optional(v.id("tasks")), // omit to unlink
  },
  returns: v.null(),
  handler: async (ctx, { apiKey, eventId, taskId }) => {
    requireKey(apiKey);
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .unique();
    if (!meeting) throw new Error(`Meeting ${eventId} not found in the sync window.`);
    await ctx.db.patch(meeting._id, {
      prepTaskId: taskId,
      prepPromotedAt: undefined, // re-linking re-arms the promotion
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * T-30 promoter (runs from crons.ts every minute): meetings starting within
 * the lead window promote their linked, still-open prep task to today+urgent
 * — once. A deliberate demotion afterwards isn't fought.
 */
export const promotePrep = internalMutation({
  args: {},
  returns: v.object({ promoted: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const soon = await ctx.db
      .query("meetings")
      .withIndex("by_start", (q) => q.gte("startAt", now).lt("startAt", now + PREP_LEAD_MS))
      .collect();
    let promoted = 0;
    for (const m of soon) {
      if (!m.prepTaskId || m.prepPromotedAt !== undefined) continue;
      const task: Doc<"tasks"> | null = await ctx.db.get(m.prepTaskId);
      if (task && task.status !== "done" && task.status !== "dropped") {
        await ctx.db.patch(task._id, {
          status: "today",
          urgent: true,
          snoozeUntil: undefined, // a parked prep still surfaces for its meeting
          updatedAt: now,
        });
        promoted++;
      }
      await ctx.db.patch(m._id, { prepPromotedAt: now, updatedAt: now });
    }
    return { promoted };
  },
});
