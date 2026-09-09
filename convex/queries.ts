/**
 * Read API (docs/04). Every query is index-backed (the tables grow for years)
 * and surface-friendly: hydrated task views, ordered, deduped. The product
 * promise is "decide for me" — surface the one next thing + today's 3, the
 * waiting pile, quick wins, and what's ageing. Never a wall (docs/01).
 */
import { query } from "./_generated/server";
import { QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { statusValidator, originValidator, taskView, meetingDoc } from "./validators";
import { loadAreaMap, toView, isSnoozed, isClosed, byPriority, TaskView } from "./lib/views";
import { dateString, dayRange, shiftDate, DAY_MS } from "./lib/time";
import { resolveAreaId } from "./areas";
import { requireKey } from "./lib/auth";
import { readSettings, type Settings } from "./lib/settings";

const apiKeyArg = { apiKey: v.optional(v.string()) };

const TODAY_CAP = 3;
const WINS_CAP = 5;
const AGEING_CAP = 5;
const WAITING_CAP = 10; // oldest first, so the ageing ones always make the cut
const UPCOMING_CAP = 5; // the glass strip shows the soonest + a count
const NEW_TODAY_CAP = 50;
const HOUR_MS = 60 * 60 * 1000;
const WAITING_AGEING_DAYS = 5;
const OPEN_AGEING_DAYS = 14;

const counts = v.object({
  today: v.number(),
  waiting: v.number(),
  inbox: v.number(),
  wins: v.number(),
  ageing: v.number(),
  upcoming: v.number(),
});

async function byStatus(ctx: QueryCtx, status: Doc<"tasks">["status"]) {
  return await ctx.db
    .query("tasks")
    .withIndex("by_status", (q) => q.eq("status", status))
    .collect();
}

/**
 * Today's ordered shortlist (raw docs). An explicit morning `checkin.chosen`
 * wins; otherwise auto-pick: status:today first, then fill from urgent/due/next.
 * Snoozed and closed tasks never appear.
 */
async function computeToday(ctx: QueryCtx, now: number, settings: Settings): Promise<Doc<"tasks">[]> {
  const ordered: Doc<"tasks">[] = [];
  const seen = new Set<Id<"tasks">>();
  const add = (t: Doc<"tasks">) => {
    if (!seen.has(t._id) && !isSnoozed(t, now) && !isClosed(t)) {
      seen.add(t._id);
      ordered.push(t);
    }
  };

  // 1. Explicit choice for today, if a morning check-in recorded one.
  const today = dateString(now, settings.timezone);
  const checkins = await ctx.db
    .query("checkins")
    .withIndex("by_date", (q) => q.eq("date", today))
    .collect();
  const morning = checkins.find((c) => c.kind === "morning");
  if (morning) {
    for (const id of morning.chosen) {
      const t = await ctx.db.get(id);
      if (t) add(t);
    }
  }

  // 2. Anything the user/Claude parked in `today`.
  for (const t of (await byStatus(ctx, "today")).sort(byPriority)) add(t);

  // 3. Auto-fill toward the cap from the actionable backlog.
  if (ordered.length < (settings.caps?.today ?? TODAY_CAP)) {
    const backlog = [...(await byStatus(ctx, "next")), ...(await byStatus(ctx, "inbox"))]
      .filter((t) => !isSnoozed(t, now))
      .sort(byPriority);
    for (const t of backlog) {
      if (ordered.length >= (settings.caps?.today ?? TODAY_CAP)) break;
      add(t);
    }
  }
  return ordered;
}

/**
 * Consecutive-day completion streak (dopamine). Bounded 60-day look-back.
 * Trusts only rows still `status:"done"` (a dropped provisional keeps its
 * doneAt) and only CONFIRMED completions — a raw hook-logged provisional
 * doesn't count until an evening reconcile blesses it (H5), so a missed
 * evening can't quietly inflate the streak.
 */
async function computeStreak(ctx: QueryCtx, now: number, settings: Settings): Promise<number> {
  const since = now - 60 * DAY_MS;
  const done = (
    await ctx.db
      .query("tasks")
      .withIndex("by_done", (q) => q.gte("doneAt", since))
      .collect()
  ).filter((t) => t.status === "done" && !t.provisional);
  const days = new Set(done.map((t) => dateString(t.doneAt!, settings.timezone)));
  let streak = 0;
  for (let i = 0; i <= 60; i++) {
    const d = shiftDate(dateString(now, settings.timezone), -i);
    if (days.has(d)) {
      streak++;
    } else if (i > 0) {
      break; // today may legitimately be empty in the morning; don't reset on i=0
    }
  }
  return streak;
}

// ── brief: the morning payload ───────────────────────────────────────────────

export const brief = query({
  args: { ...apiKeyArg },
  returns: v.object({
    date: v.string(),
    pick: v.union(taskView, v.null()),
    today: v.array(taskView),
    waiting: v.array(taskView),
    wins: v.array(taskView),
    ageing: v.array(taskView),
    // Glass sections (4.4) — additive; the widget's shape is unchanged.
    upcoming: v.array(taskView), // parked tasks, soonest wake first
    meetings: v.array(meetingDoc), // day-thread markers (4.2 mirror)
    energy: v.string(), // battery state: low | steady | deep (meta-config)
    streak: v.number(),
    counts,
  }),
  handler: async (ctx, { apiKey }) => {
    requireKey(apiKey);
    const settings = await readSettings(ctx);
    const now = Date.now();
    const areas = await loadAreaMap(ctx);
    const view = (t: Doc<"tasks">) => toView(t, areas);

    const todayDocs = (await computeToday(ctx, now, settings)).slice(0, (settings.caps?.today ?? TODAY_CAP));

    // waiting on others, oldest first (by_waiting = [status, waitingSince]).
    const waitingDocs = (
      await ctx.db
        .query("tasks")
        .withIndex("by_waiting", (q) => q.eq("status", "waiting"))
        .collect()
    ).filter((t) => !isSnoozed(t, now));

    // 2-min wins: actionable xs tasks.
    const actionable = [
      ...(await byStatus(ctx, "inbox")),
      ...(await byStatus(ctx, "today")),
      ...(await byStatus(ctx, "next")),
    ].filter((t) => !isSnoozed(t, now));
    const wins = actionable.filter((t) => t.size === "xs").sort(byPriority).slice(0, (settings.caps?.wins ?? WINS_CAP));

    // ageing flags: waiting too long, or open + untouched too long.
    const ageingSet = new Map<Id<"tasks">, Doc<"tasks">>();
    for (const t of waitingDocs) {
      if (now - (t.waitingSince ?? t.updatedAt) > (settings.caps?.waitingAgeingDays ?? WAITING_AGEING_DAYS) * DAY_MS) {
        ageingSet.set(t._id, t);
      }
    }
    for (const t of actionable) {
      if (now - t.updatedAt > (settings.caps?.openAgeingDays ?? OPEN_AGEING_DAYS) * DAY_MS) ageingSet.set(t._id, t);
    }
    const ageing = [...ageingSet.values()]
      .sort((a, b) => (a.waitingSince ?? a.updatedAt) - (b.waitingSince ?? b.updatedAt))
      .slice(0, (settings.caps?.ageing ?? AGEING_CAP));

    // Mirror inbox()'s predicate exactly: a closed task isn't "awaiting confirm",
    // so the badge can't drift above the list.
    const inboxCount = (
      await ctx.db
        .query("tasks")
        .withIndex("by_review", (q) => q.eq("needsReview", true))
        .collect()
    ).filter((t) => !isClosed(t)).length;

    // Glass sections (4.4). upcoming = parked tasks by soonest wake — the
    // dashed strip under the stage; meetings = the day-thread markers;
    // energy = the battery state the glass cycles via setMeta.
    const upcomingDocs = (
      await ctx.db
        .query("tasks")
        .withIndex("by_snooze", (q) => q.gt("snoozeUntil", now))
        .collect()
    )
      .filter((t) => !isClosed(t))
      .sort((a, b) => a.snoozeUntil! - b.snoozeUntil!);
    const meetings = await ctx.db
      .query("meetings")
      .withIndex("by_start", (q) => q.gte("startAt", now - 2 * HOUR_MS).lt("startAt", now + 36 * HOUR_MS))
      .collect();
    const energyRow = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "config:energy"))
      .unique();
    const energy = typeof energyRow?.value === "string" ? energyRow.value : "steady";

    return {
      date: dateString(now, settings.timezone),
      pick: todayDocs.length ? view(todayDocs[0]) : null,
      today: todayDocs.map(view),
      // Capped: the one payload that could become a wall — which is the thing
      // Helm exists to prevent (H6). counts.waiting stays the true total; the
      // full pile is one `waiting` query away.
      waiting: waitingDocs.slice(0, (settings.caps?.waiting ?? WAITING_CAP)).map(view),
      wins: wins.map(view),
      ageing: ageing.map(view),
      upcoming: upcomingDocs.slice(0, (settings.caps?.upcoming ?? UPCOMING_CAP)).map(view),
      meetings,
      energy,
      streak: await computeStreak(ctx, now, settings),
      counts: {
        today: todayDocs.length,
        waiting: waitingDocs.length,
        inbox: inboxCount,
        wins: wins.length,
        ageing: ageing.length,
        upcoming: upcomingDocs.length,
      },
    };
  },
});

// ── todaysPick: the single right-now task ────────────────────────────────────

export const todaysPick = query({
  args: { ...apiKeyArg },
  returns: v.union(taskView, v.null()),
  handler: async (ctx, { apiKey }) => {
    requireKey(apiKey);
    const settings = await readSettings(ctx);
    const now = Date.now();
    const todayDocs = await computeToday(ctx, now, settings);
    if (!todayDocs.length) return null;
    const areas = await loadAreaMap(ctx);
    return toView(todayDocs[0], areas);
  },
});

// ── dayLog: the evening reconcile payload ────────────────────────────────────

export const dayLog = query({
  args: { ...apiKeyArg, date: v.optional(v.string()) }, // "YYYY-MM-DD" London; defaults to today
  returns: v.object({
    date: v.string(),
    completedPlanned: v.array(taskView),
    completedAdhoc: v.array(taskView),
    counts: v.object({ planned: v.number(), adhoc: v.number(), total: v.number() }),
  }),
  handler: async (ctx, { apiKey, date }) => {
    requireKey(apiKey);
    const settings = await readSettings(ctx);
    const now = Date.now();
    const day = date ?? dateString(now, settings.timezone);
    const { start, end } = dayRange(day, settings.timezone);
    const areas = await loadAreaMap(ctx);

    // Only rows still `status:"done"`: doneAt survives a drop, and without the
    // filter the noise the reconcile skill drops would haunt the day forever (H5).
    const done = (
      await ctx.db
        .query("tasks")
        .withIndex("by_done", (q) => q.gte("doneAt", start).lt("doneAt", end))
        .collect()
    ).filter((t) => t.status === "done");

    const planned: TaskView[] = [];
    const adhoc: TaskView[] = [];
    for (const t of done.sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))) {
      (t.origin === "adhoc" ? adhoc : planned).push(toView(t, areas));
    }
    return {
      date: day,
      completedPlanned: planned,
      completedAdhoc: adhoc,
      counts: { planned: planned.length, adhoc: adhoc.length, total: done.length },
    };
  },
});

// ── inbox: sweep proposals awaiting one-tap confirm ──────────────────────────

export const inbox = query({
  args: { ...apiKeyArg },
  returns: v.array(taskView),
  handler: async (ctx, { apiKey }) => {
    requireKey(apiKey);
    const areas = await loadAreaMap(ctx);
    const items = await ctx.db
      .query("tasks")
      .withIndex("by_review", (q) => q.eq("needsReview", true))
      .collect();
    return items
      .filter((t) => !isClosed(t))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((t) => toView(t, areas));
  },
});

// ── waiting: blocked on others, oldest first ─────────────────────────────────

export const waiting = query({
  args: { ...apiKeyArg },
  returns: v.array(taskView),
  handler: async (ctx, { apiKey }) => {
    requireKey(apiKey);
    const now = Date.now();
    const areas = await loadAreaMap(ctx);
    const items = await ctx.db
      .query("tasks")
      .withIndex("by_waiting", (q) => q.eq("status", "waiting"))
      .collect();
    return items.filter((t) => !isSnoozed(t, now)).map((t) => toView(t, areas));
  },
});

// ── newToday: what showed up while I wasn't looking (docs/06-surfaces.md) ─────────────

/**
 * Everything that ENTERED Helm today (London), newest first, with provenance
 * carried by `source`/`sourceRef`/`_creationTime` — the counterweight to
 * ambient capture. Uses the built-in creation-time index; bounded to the day.
 */
export const newToday = query({
  args: { ...apiKeyArg },
  returns: v.array(taskView),
  handler: async (ctx, { apiKey }) => {
    requireKey(apiKey);
    const settings = await readSettings(ctx);
    const now = Date.now();
    const { start, end } = dayRange(dateString(now, settings.timezone), settings.timezone);
    const areas = await loadAreaMap(ctx);
    const docs = await ctx.db
      .query("tasks")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", start).lt("_creationTime", end))
      .order("desc")
      .take((settings.caps?.newToday ?? NEW_TODAY_CAP));
    return docs.map((t) => toView(t, areas));
  },
});

// ── list: generic indexed read for NL queries from the client ────────────────

export const list = query({
  args: {
    ...apiKeyArg,
    status: v.optional(statusValidator),
    areaKey: v.optional(v.string()),
    origin: v.optional(originValidator),
    needsReview: v.optional(v.boolean()),
    includeSnoozed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(taskView),
  handler: async (ctx, args) => {
    requireKey(args.apiKey);
    const now = Date.now();
    const areas = await loadAreaMap(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    // Pick an index: status > area > review(true) > open-actionable union.
    // Never an unbounded scan of a forever-growing partition.
    let docs: Doc<"tasks">[];
    if (args.status !== undefined) {
      if (args.status === "done" || args.status === "dropped") {
        // Terminal partitions accumulate for years — bound the read to the
        // newest `limit` rather than collecting the whole history.
        docs = await ctx.db
          .query("tasks")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(limit);
      } else {
        docs = await byStatus(ctx, args.status);
      }
    } else if (args.areaKey !== undefined) {
      const areaId = await resolveAreaId(ctx, args.areaKey);
      docs = await ctx.db
        .query("tasks")
        .withIndex("by_area", (q) => q.eq("areaId", areaId))
        .collect();
    } else if (args.needsReview === true) {
      // Only `true` rows are stored explicitly; `eq(false)` would miss every
      // task with the field absent, so `false` falls through to the union below.
      docs = await ctx.db
        .query("tasks")
        .withIndex("by_review", (q) => q.eq("needsReview", true))
        .collect();
    } else {
      docs = [
        ...(await byStatus(ctx, "inbox")),
        ...(await byStatus(ctx, "today")),
        ...(await byStatus(ctx, "next")),
        ...(await byStatus(ctx, "waiting")),
      ];
    }

    // Remaining filters in-memory (already index-narrowed).
    if (args.areaKey !== undefined && args.status !== undefined) {
      const areaId = await resolveAreaId(ctx, args.areaKey);
      docs = docs.filter((t) => t.areaId === areaId);
    }
    if (args.origin !== undefined) docs = docs.filter((t) => t.origin === args.origin);
    // Absent-as-false, applied on every path (the index eq can't express it).
    if (args.needsReview !== undefined) {
      docs = docs.filter((t) => (t.needsReview ?? false) === args.needsReview);
    }
    if (!args.includeSnoozed) docs = docs.filter((t) => !isSnoozed(t, now));

    return docs.sort(byPriority).slice(0, limit).map((t) => toView(t, areas));
  },
});
