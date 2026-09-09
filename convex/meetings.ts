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
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { loadCalendarWindow, validateWindow, MEETING_LIMIT, type MeetingInput } from "./lib/calendar";
import { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireKey } from "./lib/auth";
import { readSettings } from "./lib/settings";
import { dateString } from "./lib/time";
import { prependNow } from "./lib/nowOrder";
import { boundedRows, readTask, accountRead } from "./lib/bounds";
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
      signal: AbortSignal.timeout(15_000),
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`calendar: token refresh failed (${tokenRes.status})`);
    }
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    if (typeof access_token !== "string" || !access_token) throw new Error("calendar: missing access token");
    const now = Math.floor(Date.now() / 1000) * 1000; // Google bounds ignore milliseconds.
    const windowStart = now - 2 * HOUR_MS;
    const windowEnd = now + 48 * HOUR_MS;
    const meetings = await loadCalendarWindow(access_token, windowStart, windowEnd);

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
 * Reconcile a complete sync window by event ID. Matching row IDs and prep
 * state survive. Missing, expired, and duplicate rows leave the rolling mirror.
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
  handler: async (ctx, args) => replaceMeetingWindow(ctx, args),
});

/** Complete mirror reads fail explicitly beyond the supported capacity. */
export async function readMeetingMirror(ctx: QueryCtx | MutationCtx) {
  return await boundedRows(ctx, ctx.db.query("meetings").withIndex("by_start"), "Calendar mirror", MEETING_LIMIT);
}

/** Reconcile by stable event identity, including events spanning the lower bound. */
export async function replaceMeetingWindow(ctx: MutationCtx, args: { windowStart: number; windowEnd: number; meetings: MeetingInput[] }) {
  validateWindow(args.windowStart, args.windowEnd, args.meetings);
  const existing = await readMeetingMirror(ctx);
  const kept = new Set<Id<"meetings">>();
  const now = Date.now();
  for (const meeting of args.meetings) {
    const matches = existing.filter(row => row.eventId === meeting.eventId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const canonical = matches[0];
    // Earlier buggy syncs can leave a duplicate with the surviving prep link.
    const linked = matches.find(row => row.prepTaskId !== undefined);
    const promoted = linked ? matches.filter(row => row.prepTaskId === linked.prepTaskId && row.prepPromotedAt !== undefined)
      .map(row => row.prepPromotedAt!) : [];
    const row = { ...meeting, url: meeting.url, updatedAt: now,
      prepTaskId: linked?.prepTaskId, prepPromotedAt: promoted.length ? Math.max(...promoted) : undefined };
    if (canonical) { await ctx.db.patch(canonical._id, row); kept.add(canonical._id); }
    else await ctx.db.insert("meetings", row);
  }
  // The input is a complete snapshot. Remove missing, old, and duplicate rows.
  for (const row of existing) if (!kept.has(row._id)) await ctx.db.delete(row._id);
  return null;
}

export async function readUpcomingMeetings(ctx: QueryCtx | MutationCtx, now: number, horizonHours: number) {
  if (!Number.isFinite(horizonHours) || horizonHours < 0 || horizonHours > 72)
    throw new ConvexError("Use a meeting horizon from 0 to 72 hours.");
  return (await readMeetingMirror(ctx)).filter(row => row.endAt > now - 2 * HOUR_MS && row.startAt < now + horizonHours * HOUR_MS);
}

// ── reads + prep linking ─────────────────────────────────────────────────────

/** The day thread's markers: in-progress + upcoming, ordered by start. */
export const upcomingMeetings = query({
  args: { ...apiKeyArg, horizonHours: v.optional(v.number()) },
  returns: v.array(meetingDoc),
  handler: async (ctx, { apiKey, horizonHours }) => {
    requireKey(apiKey);
    const now = Date.now();
    return await readUpcomingMeetings(ctx, now, horizonHours ?? 36);
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
    if (!meeting) throw new ConvexError(`Meeting ${eventId} not found in the sync window.`);
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
  handler: async (ctx) => promoteMeetingPrep(ctx, Date.now()),
});

export async function promoteMeetingPrep(ctx: MutationCtx, now: number) {
    const settings = await readSettings(ctx);
    const prepLead = (settings.caps?.meetingPrepLeadMin ?? PREP_LEAD_MS / 60_000) * 60_000;
    const soon = await boundedRows(ctx, ctx.db.query("meetings")
      .withIndex("by_start", q => q.gte("startAt", now).lt("startAt", now + prepLead)), "Upcoming prep meetings");
    let promoted = 0;
    const promotedIds: Id<"tasks">[] = [];
    for (const m of soon) {
      if (!m.prepTaskId || m.prepPromotedAt !== undefined) continue;
      const task: Doc<"tasks"> | null = await readTask(ctx, m.prepTaskId);
      if (task && task.status !== "done" && task.status !== "dropped") {
        await ctx.db.patch(task._id, {
          status: "today",
          urgent: true,
          waitingSince: undefined,
          snoozeUntil: undefined, // a parked prep still surfaces for its meeting
          updatedAt: now,
        });
        promoted++;
        promotedIds.push(task._id);
      }
      await ctx.db.patch(m._id, { prepPromotedAt: now, updatedAt: now });
    }
    if (promotedIds.length) {
      const date = dateString(now, settings.timezone);
      const morning = accountRead(ctx, await ctx.db.query("checkins")
        .withIndex("by_date_kind", q => q.eq("date", date).eq("kind", "morning")).unique());
      const chosen = new Set(morning?.chosen ?? []);
      const newlyPromoted = new Set(promotedIds);
      const prepOrder: Id<"tasks">[] = [];
      // Keep earlier, still-active prep ahead of meetings that enter the lead
      // window on a later cron pass. Deliberate demotions have left chosen.
      for (const meeting of soon) {
        if (!meeting.prepTaskId) continue;
        if (newlyPromoted.has(meeting.prepTaskId)) prepOrder.push(meeting.prepTaskId);
        else if (meeting.prepPromotedAt !== undefined && chosen.has(meeting.prepTaskId)) {
          const task = await readTask(ctx, meeting.prepTaskId);
          if (task?.status === "today" && (task.snoozeUntil === undefined || task.snoozeUntil <= now))
            prepOrder.push(task._id);
        }
      }
      await prependNow(ctx, date, prepOrder);
    }
    return { promoted };
}
