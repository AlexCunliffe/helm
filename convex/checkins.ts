/**
 * Check-ins — the accountability log (docs/03). One morning + one evening row
 * per London day. Morning records the chosen 3; evening reconciles what actually
 * got done (planned + adhoc) and what carried. This is what makes "what did I do
 * today?" answerable and gives the day a close (docs/01 dopamine, no-guilt).
 */
import { mutation, query } from "./_generated/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { checkinKindValidator, checkinDoc } from "./validators";
import { dateString, dayRange, shiftDate } from "./lib/time";
import { isSnoozed } from "./lib/views";
import { requireKey } from "./lib/auth";
import { readSettings } from "./lib/settings";

const apiKeyArg = { apiKey: v.optional(v.string()) };
const fixtureArg = { fixtureRunId: v.optional(v.string()) };

// Tests must not adopt an existing user row. A normal edit clears fixture
// ownership, so a later fixture mutation or cleanup refuses that row.
function requireFixtureOwnership(existing: Doc<"checkins"> | null, fixtureRunId?: string) {
  if (fixtureRunId === undefined) return;
  if (!/^test:reg:[a-f0-9-]+:$/.test(fixtureRunId) || fixtureRunId.length > 100)
    throw new ConvexError("Use a valid regression run identifier.");
  if (existing && existing.fixtureRunId !== fixtureRunId)
    throw new ConvexError("Refuse to overwrite a check-in outside this fixture run.");
}

async function findCheckin(
  ctx: QueryCtx | MutationCtx,
  date: string,
  kind: "morning" | "evening",
) {
  const rows = await ctx.db
    .query("checkins")
    .withIndex("by_date", (q) => q.eq("date", date))
    .collect();
  return rows.find((c) => c.kind === kind) ?? null;
}

export const getCheckin = query({
  args: { ...apiKeyArg, date: v.string(), kind: checkinKindValidator },
  returns: v.union(checkinDoc, v.null()),
  handler: async (ctx, { apiKey, date, kind }) => {
    requireKey(apiKey);
    dayRange(date, (await readSettings(ctx)).timezone);
    return await findCheckin(ctx, date, kind);
  },
});

/** Thin upsert of a check-in row by (date, kind). Unspecified arrays are kept. */
export const upsertCheckin = mutation({
  args: {
    ...apiKeyArg, ...fixtureArg,
    date: v.string(),
    kind: checkinKindValidator,
    chosen: v.optional(v.array(v.id("tasks"))),
    completedPlanned: v.optional(v.array(v.id("tasks"))),
    completedAdhoc: v.optional(v.array(v.id("tasks"))),
    carried: v.optional(v.array(v.id("tasks"))),
    summary: v.optional(v.string()),
  },
  returns: v.id("checkins"),
  handler: async (ctx, args) => {
    requireKey(args.apiKey);
    dayRange(args.date, (await readSettings(ctx)).timezone);
    const existing = await findCheckin(ctx, args.date, args.kind);
    requireFixtureOwnership(existing, args.fixtureRunId);
    const row = {
      fixtureRunId: args.fixtureRunId,
      date: args.date,
      kind: args.kind,
      chosen: args.chosen ?? existing?.chosen ?? [],
      completedPlanned: args.completedPlanned ?? existing?.completedPlanned ?? [],
      completedAdhoc: args.completedAdhoc ?? existing?.completedAdhoc ?? [],
      carried: args.carried ?? existing?.carried ?? [],
      summary: args.summary ?? existing?.summary,
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return existing._id;
    }
    return await ctx.db.insert("checkins", row);
  },
});

/**
 * Morning: commit "today's 3". Records `chosen` in the morning check-in AND
 * moves those tasks to `today` so every surface (brief/computeToday/widget)
 * leads with them. Idempotent for the day.
 */
export const chooseToday = mutation({
  args: { ...apiKeyArg, ...fixtureArg, taskIds: v.array(v.id("tasks")), date: v.optional(v.string()) },
  returns: v.id("checkins"),
  handler: async (ctx, { apiKey, taskIds, date, fixtureRunId }) => {
    requireKey(apiKey);
    const settings = await readSettings(ctx);
    const now = Date.now();
    const day = date ?? dateString(now, settings.timezone);
    dayRange(day, settings.timezone);
    const existing = await findCheckin(ctx, day, "morning");
    requireFixtureOwnership(existing, fixtureRunId);
    const prevChosen = existing?.chosen ?? [];

    // Promote the picks we can actually action; record ONLY those (a closed task
    // can't be "chosen for today", so it mustn't appear in `chosen`).
    const promoted: typeof taskIds = [];
    for (const id of taskIds) {
      const t = await ctx.db.get(id);
      if (t && t.status !== "done" && t.status !== "dropped") {
        if (t.status !== "today") await ctx.db.patch(id, { status: "today", updatedAt: now });
        promoted.push(id);
      }
    }
    // Re-choosing is allowed: demote any previously-chosen task that dropped out
    // of the new set and is still sitting in `today`, so today matches the choice.
    const keep = new Set(taskIds);
    for (const id of prevChosen) {
      if (keep.has(id)) continue;
      const t = await ctx.db.get(id);
      if (t && t.status === "today") await ctx.db.patch(id, { status: "next", updatedAt: now });
    }

    if (existing) {
      await ctx.db.patch(existing._id, { chosen: promoted, fixtureRunId });
      return existing._id;
    }
    return await ctx.db.insert("checkins", {
      fixtureRunId, date: day,
      kind: "morning",
      chosen: promoted,
      completedPlanned: [],
      completedAdhoc: [],
      carried: [],
    });
  },
});

/**
 * Reconcile one London day (shared by reconcileDay + reconcileOutstanding).
 * Counts only rows still `status:"done"` — a dropped provisional keeps its
 * doneAt stamp, and without the filter dropped noise would stay in the day's
 * numbers forever (H5). Surviving provisionals are CONFIRMED here (flag
 * cleared): reconcile is the moment the hook's raw log becomes the honest
 * record, and the streak only trusts confirmed completions.
 *
 * `liveCarried` — carried is only knowable for a day being closed live (it
 * reads current `status:today`). Healing or backfilling a past day keeps the
 * historical carried (or [] if the day was never closed).
 */
async function reconcileOneDay(
  ctx: MutationCtx,
  day: string,
  opts: { summary?: string; liveCarried: boolean; timezone: string; fixtureRunId?: string },
) {
  const now = Date.now();
  const { start, end } = dayRange(day, opts.timezone);
  const existing = await findCheckin(ctx, day, "evening");
  requireFixtureOwnership(existing, opts.fixtureRunId);

  const inDay = await ctx.db
    .query("tasks")
    .withIndex("by_done", (q) => q.gte("doneAt", start).lt("doneAt", end))
    .collect();
  const done = inDay.filter((t) => t.status === "done");
  if (opts.fixtureRunId && done.some(t => !t.dedupeKey?.startsWith(opts.fixtureRunId!)))
    throw new ConvexError("Refuse to reconcile completions outside this fixture run.");

  let confirmed = 0;
  for (const t of done) {
    if (t.provisional) {
      await ctx.db.patch(t._id, { provisional: undefined });
      confirmed++;
    }
  }

  const completedPlanned = done.filter((t) => t.origin === "planned").map((t) => t._id);
  const completedAdhoc = done.filter((t) => t.origin === "adhoc").map((t) => t._id);

  // Carried = still-open tasks slated for today that didn't get done. A
  // snoozed task is deliberately parked, not a miss, so it doesn't count
  // (no-guilt close — docs/01).
  const carried = opts.liveCarried
    ? (
        await ctx.db
          .query("tasks")
          .withIndex("by_status", (q) => q.eq("status", "today"))
          .collect()
      )
        .filter((t) => !isSnoozed(t, now))
        .map((t) => t._id)
    : (existing?.carried ?? []);

  const row = {
    fixtureRunId: opts.fixtureRunId, date: day,
    kind: "evening" as const,
    chosen: existing?.chosen ?? [],
    completedPlanned,
    completedAdhoc,
    carried,
    summary: opts.summary ?? existing?.summary,
  };
  let checkinId;
  if (existing) {
    await ctx.db.patch(existing._id, row);
    checkinId = existing._id;
  } else {
    checkinId = await ctx.db.insert("checkins", row);
  }
  return {
    date: day,
    completedPlanned: completedPlanned.length,
    completedAdhoc: completedAdhoc.length,
    carried: carried.length,
    confirmed,
    checkinId,
    existed: existing !== null,
  };
}

const reconcileReturns = v.object({
  date: v.string(),
  completedPlanned: v.number(),
  completedAdhoc: v.number(),
  carried: v.number(),
  confirmed: v.number(), // provisionals promoted to real completions this run
  checkinId: v.id("checkins"),
});

/**
 * Evening: reconcile the day. Reads everything completed in the London day
 * (planned + adhoc), computes what's carried (still slated for `today`), and
 * upserts the evening check-in. Returns the counts so the routine can post
 * "here's everything you did today" + the N that carried. Idempotent.
 */
export const reconcileDay = mutation({
  args: { ...apiKeyArg, ...fixtureArg, date: v.optional(v.string()), summary: v.optional(v.string()) },
  returns: reconcileReturns,
  handler: async (ctx, { apiKey, date, summary, fixtureRunId }) => {
    requireKey(apiKey);
    const settings = await readSettings(ctx);
    const now = Date.now();
    const day = date ?? dateString(now, settings.timezone);
    const { existed: _existed, ...result } = await reconcileOneDay(ctx, day, {
      summary,
      liveCarried: day === dateString(now, settings.timezone),
      timezone: settings.timezone, fixtureRunId,
    });
    return result;
  },
});

/**
 * Self-healing reconcile (H5): a missed evening can't corrupt the honesty
 * layer. Sweeps a bounded recent window (or an explicit `dates` list) and for
 * each day: backfills the evening check-in if the day had completions but was
 * never closed (carried: [] — unknowable in hindsight), re-confirms surviving
 * provisionals on already-reconciled days (historical carried preserved), and
 * closes today live. Any single run catches the whole backlog up.
 */
export const reconcileOutstanding = mutation({
  args: {
    ...apiKeyArg, ...fixtureArg,
    lookbackDays: v.optional(v.number()), // default 14, capped 60
    dates: v.optional(v.array(v.string())), // explicit day list overrides the window
    summary: v.optional(v.string()), // applied to today only
  },
  returns: v.object({
    reconciled: v.array(v.string()), // days whose evening check-in was created this run
    healed: v.number(), // provisionals confirmed across the window
  }),
  handler: async (ctx, { apiKey, lookbackDays, dates, summary, fixtureRunId }) => {
    requireKey(apiKey);
    const settings = await readSettings(ctx);
    const now = Date.now();
    const today = dateString(now, settings.timezone);
    const window =
      dates ??
      Array.from({ length: Math.min(lookbackDays ?? 14, 60) }, (_, i) =>
        shiftDate(today, -i),
      ).reverse();

    const reconciled: string[] = [];
    let healed = 0;
    for (const day of window) {
      const isToday = day === today;
      const existing = await findCheckin(ctx, day, "evening");
      if (!existing && !isToday) {
        // Never closed: only backfill days that actually had completions —
        // an empty check-in row for a day off is noise, not honesty.
        const { start, end } = dayRange(day, settings.timezone);
        const hadDone = (
          await ctx.db
            .query("tasks")
            .withIndex("by_done", (q) => q.gte("doneAt", start).lt("doneAt", end))
            .collect()
        ).some((t) => t.status === "done");
        if (!hadDone) continue;
      }
      const r = await reconcileOneDay(ctx, day, {
        summary: isToday ? summary : undefined,
        liveCarried: isToday,
        timezone: settings.timezone, fixtureRunId,
      });
      healed += r.confirmed;
      if (!r.existed) reconciled.push(day);
    }
    return { reconciled, healed };
  },
});
