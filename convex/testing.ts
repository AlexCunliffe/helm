/**
 * Test-fixture janitor for the regression harness (scripts/regression.mjs).
 *
 * `internalMutation` — callable only with admin credentials (`npx convex run`),
 * never by MCP/HTTP clients. The harness owns a distinct test-prefixed task
 * namespace. Check-ins require exact snapshots of rows created by that run;
 * date-wide deletion is deliberately refused.
 */
import type { Id } from "./_generated/dataModel";
import { wakeDueBatch } from "./tasks";
import { internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { seedAreaRows } from "./areas";
import { dayRange, dateString } from "./lib/time";
import { readSettings } from "./lib/settings";
import { replaceMeetingWindow, readMeetingMirror, readUpcomingMeetings, promoteMeetingPrep } from "./meetings";
import { removeFromNow } from "./lib/nowOrder";
import { loadCalendarWindow } from "./lib/calendar";
import { boundedRows } from "./lib/bounds";
import { checkinDoc } from "./validators";

export const purgeTestData = internalMutation({
  args: {
    prefix: v.optional(v.string()), // dedupeKey prefix; default "test:"
    dates: v.optional(v.array(v.string())), // compatibility: only an empty list is accepted
    checkinSnapshots: v.optional(v.array(checkinDoc)),
  },
  returns: v.object({ tasks: v.number(), checkins: v.number() }),
  handler: async (ctx, { prefix = "test:", dates = [], checkinSnapshots = [] }) => {
    const taskFixture = /^(?:ingest:)?test:[a-z0-9][a-z0-9:-]{0,199}$/i.test(prefix);
    const hookFixture = /^session:test-hook-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(prefix);
    if (!taskFixture && !hookFixture) throw new ConvexError("Use a distinct test-prefixed namespace or a test-hook session UUID.");
    if (dates.length) throw new ConvexError("Date-wide cleanup is disabled. Provide exact owned check-in snapshots.");
    if (checkinSnapshots.length > 10) throw new ConvexError("Clean at most ten owned check-ins per call.");
    const owned = [];
    for (const snapshot of checkinSnapshots) {
      if (snapshot.fixtureRunId !== prefix) throw new ConvexError("Refuse a check-in owned by another run or a normal user.");
      const row = await ctx.db.get(snapshot._id);
      if (!row) continue;
      const keys = Object.keys(row) as (keyof typeof row)[];
      if (keys.length !== Object.keys(snapshot).length || keys.some(key => JSON.stringify(row[key]) !== JSON.stringify(snapshot[key])))
        throw new ConvexError("A fixture check-in changed after its snapshot. Preserve it for inspection.");
      owned.push(row._id);
    }
    // Range scan on by_dedupe covers every key with the prefix. Tasks without a
    // dedupeKey sort before all strings in the index, so they're never touched.
    const tasks = await boundedRows(ctx, ctx.db.query("tasks")
      .withIndex("by_dedupe", q => q.gte("dedupeKey", prefix).lt("dedupeKey", prefix + "\uffff")), "Fixture namespace");
    for (const t of tasks) await ctx.db.delete(t._id);

    for (const id of owned) await ctx.db.delete(id);
    const checkins = owned.length;
    return { tasks: tasks.length, checkins };
  },
});


/** Read-only calendar probes for the development regression harness. */
export const calendarRanges = internalQuery({
  args: { cases: v.array(v.object({ date: v.string(), timezone: v.string() })) },
  returns: v.array(v.object({ start: v.number(), end: v.number() })),
  handler: async (_ctx, { cases }) => {
    if (cases.length > 20) throw new Error("At most 20 calendar cases.");
    return cases.map(c => dayRange(c.date, c.timezone));
  },
});

/** Exercise the real empty-store seed in a transaction that ALWAYS rolls back.
 * This preserves area IDs referenced by existing development tasks. */
export const seedEmptyProbe = internalMutation({
  args: { areas: v.array(v.object({ key: v.string(), label: v.string(), color: v.string(), order: v.number() })) },
  returns: v.null(),
  handler: async (ctx, { areas }) => {
    const existing = await ctx.db.query("areas").withIndex("by_key").take(101);
    if (existing.length > 100) throw new ConvexError("Probe supports at most 100 existing areas.");
    for (const a of existing) await ctx.db.delete(a._id);
    const first = await seedAreaRows(ctx, areas, true);
    const second = await seedAreaRows(ctx, areas.map(a => ({ ...a, label: "Must not replace" })), true);
    const seeded = await ctx.db.query("areas").withIndex("by_key").take(101);
    if (first.inserted !== areas.length || second.inserted !== 0 || second.updated !== 0 ||
      !areas.every(a => seeded.some(s => s.key === a.key && s.label === a.label && s.color === a.color)))
      throw new ConvexError("SEED_PROBE_FAILED");
    throw new ConvexError("SEED_PROBE_PASSED_ROLLED_BACK");
  },
});

/** Delete only unused, explicitly named area fixtures. */
export const removeFixtureAreas = internalMutation({
  args: { keys: v.array(v.string()) }, returns: v.null(),
  handler: async (ctx, { keys }) => {
    if (keys.length > 20 || keys.some(k => !k.startsWith("test-"))) throw new ConvexError("Use at most 20 test-prefixed area keys.");
    for (const key of keys) {
      const area = await ctx.db.query("areas").withIndex("by_key", q => q.eq("key", key)).unique();
      if (!area) continue;
      if (await ctx.db.query("tasks").withIndex("by_area", q => q.eq("areaId", area._id)).first()) throw new ConvexError("Area still has tasks.");
      await ctx.db.delete(area._id);
    }
    return null;
  },
});

/** Exercise real mirror/promotion helpers, then ALWAYS roll back every write. */
export const meetingWindowProbe = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    let checks = 0;
    const check = (condition: unknown, label: string) => { if (!condition) throw new ConvexError("MEETING_PROBE_FAILED: " + label); checks++; };
    const settings = await readSettings(ctx);
    const settingRow = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "settings")).unique();
    const value = { ...settings, timezone: "UTC", caps: { ...settings.caps, today: 3, meetingPrepLeadMin: 30 } };
    if (settingRow) await ctx.db.patch(settingRow._id, { value }); else await ctx.db.insert("meta", { key: "settings", value });
    const area = await ctx.db.query("areas").withIndex("by_key").first();
    if (!area) throw new ConvexError("Seed an area before running the meeting probe.");
    const now = Date.now(), minute = 60_000, hour = 60 * minute;
    const task = (title: string) => ctx.db.insert("tasks", { title, areaId: area._id, status: "waiting", waitingSince: 1,
      origin: "planned", source: "test", dedupeKey: "test:meeting-probe:" + title, updatedAt: now });
    const a = await task("TEST early prep"), b = await task("TEST later prep"), ordinary = await task("TEST ordinary choice");
    await ctx.db.patch(ordinary, { status: "today", waitingSince: undefined });
    const long = { eventId: "test:meeting-probe:long", title: "TEST ongoing event", startAt: now - 3 * hour, endAt: now + 10 * minute };
    const early = { eventId: "test:meeting-probe:early", title: "TEST earlier event", startAt: now + 15 * minute, endAt: now + hour };
    const later = { eventId: "test:meeting-probe:later", title: "TEST later event", startAt: now + 35 * minute, endAt: now + 2 * hour };
    const window = { windowStart: now - 2 * hour, windowEnd: now + 48 * hour };
    await replaceMeetingWindow(ctx, { ...window, meetings: [long, early, later] });
    const first = await readMeetingMirror(ctx), longRow = first.find(m => m.eventId === long.eventId)!;
    const earlyRow = first.find(m => m.eventId === early.eventId)!;
    check(first.length === 3, "complete replacement");
    check((await readUpcomingMeetings(ctx, now, 36)).some(m => m.eventId === long.eventId), "long ongoing event is visible");
    await ctx.db.patch(longRow._id, { prepTaskId: a, prepPromotedAt: now - minute });
    await ctx.db.insert("meetings", { ...long, updatedAt: now + 1 }); // reproduce an inherited duplicate
    await ctx.db.insert("meetings", { eventId: "test:meeting-probe:stale", title: "TEST old event", startAt: now - 5 * hour, endAt: now - 4 * hour, updatedAt: now });
    await replaceMeetingWindow(ctx, { ...window, windowStart: now - hour, meetings: [{ ...long, title: "TEST updated ongoing event" }, early, later] });
    const second = await readMeetingMirror(ctx), ongoing = second.find(m => m.eventId === long.eventId)!;
    check(second.length === 3 && new Set(second.map(m => m.eventId)).size === 3, "duplicates and stale rows pruned");
    check(ongoing.prepTaskId === a && ongoing.prepPromotedAt === now - minute, "matching duplicate prep state survives advancing lower bound");
    check(second.find(m => m.eventId === early.eventId)!._id === earlyRow._id, "unchanged event row identity survives");
    const beforeInvalid = JSON.stringify(second);
    let rejected = false;
    try { await replaceMeetingWindow(ctx, { ...window, meetings: [early, early] }); } catch { rejected = true; }
    check(rejected && JSON.stringify(await readMeetingMirror(ctx)) === beforeInvalid, "invalid snapshot makes no writes");
    for (const [eventId, prepTaskId] of [[early.eventId, a], [later.eventId, b]] as const) {
      const meeting = await ctx.db.query("meetings").withIndex("by_event", q => q.eq("eventId", eventId)).unique();
      await ctx.db.patch(meeting!._id, { prepTaskId, prepPromotedAt: undefined });
    }
    const date = dateString(now, "UTC");
    let morning = await ctx.db.query("checkins").withIndex("by_date_kind", q => q.eq("date", date).eq("kind", "morning")).unique();
    if (morning) await ctx.db.patch(morning._id, { chosen: [ordinary] });
    else await ctx.db.insert("checkins", { date, kind: "morning", chosen: [ordinary], completedPlanned: [], completedAdhoc: [], carried: [] });
    const chosen = async () => (await ctx.db.query("checkins").withIndex("by_date_kind", q => q.eq("date", date).eq("kind", "morning")).unique())!.chosen;
    check((await promoteMeetingPrep(ctx, now)).promoted === 1, "only earlier prep initially enters window");
    check((await chosen())[0] === a, "prep leads ordinary choice");
    check((await ctx.db.get(a))!.waitingSince === undefined, "promotion clears wait clock");
    check((await promoteMeetingPrep(ctx, now + 6 * minute)).promoted === 1, "second pass promotes later prep");
    check((await chosen())[0] === a && (await chosen())[1] === b, "cross-pass chronological priority");
    await ctx.db.patch(a, { status: "next" });
    await removeFromNow(ctx, date, a);
    check((await promoteMeetingPrep(ctx, now + 7 * minute)).promoted === 0, "one-time stamp prevents re-promotion");
    check((await ctx.db.get(a))!.status === "next" && (await chosen())[0] === b, "later deliberate demotion is preserved");
    await replaceMeetingWindow(ctx, { ...window, meetings: [later] });
    check((await readMeetingMirror(ctx)).length === 1 && (await ctx.db.get(a)) !== null, "missing events pruned without deleting tasks");
    throw new ConvexError("MEETING_PROBE_PASSED_ROLLED_BACK:" + checks);
  },
});

/** Run the actual paging helper in the hosted action runtime with synthetic I/O. */
export const calendarRuntimeProbe = internalAction({
  args: {}, returns: v.object({ meetings: v.number(), requests: v.number(), timed: v.boolean() }),
  handler: async () => {
    const now = Date.now();
    let requests = 0, timed = true;
    const request: typeof fetch = async (_url, options) => {
      requests++; timed = timed && !!options?.signal;
      return new Response(JSON.stringify({ items: [{ id: "fixture-" + requests, summary: "Fixture event",
        start: { dateTime: new Date(now + 60_000 * requests).toISOString() },
        end: { dateTime: new Date(now + 120_000 * requests).toISOString() } }],
        ...(requests === 1 ? { nextPageToken: "second" } : {}) }));
    };
    const meetings = await loadCalendarWindow("fixture-only", now, now + 3600_000, request);
    return { meetings: meetings.length, requests, timed };
  },
});

/** Test bounded reads against >1000 stored rows, then roll back the entire fixture. */
export const readCapacityProbe = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const area = await ctx.db.query("areas").withIndex("by_key").first();
    if (!area) throw new ConvexError("Seed an area before running the capacity probe.");
    const prefix = "test:read-capacity-probe:", now = Date.now();
    for (let i = 0; i < 1001; i++) await ctx.db.insert("tasks", { title: "TEST history row", areaId: area._id,
      status: "done", origin: "adhoc", source: "test", doneAt: now, updatedAt: now, dedupeKey: prefix + i });
    const history = () => ctx.db.query("tasks").withIndex("by_dedupe", q => q.gte("dedupeKey", prefix).lt("dedupeKey", prefix + "\uffff"));
    let rejected = false;
    try { await boundedRows(ctx, history(), "Fixture history"); }
    catch (error) { rejected = error instanceof ConvexError && String(error.data).includes("exceeds 1000 rows"); }
    if (!rejected) throw new ConvexError("READ_CAPACITY_PROBE_FAILED: unbounded partition");
    const page = await history().paginate({ cursor: null, numItems: 20, maximumRowsRead: 200, maximumBytesRead: 1024 * 1024 });
    if (page.page.length !== 20 || page.isDone || !page.continueCursor) throw new ConvexError("READ_CAPACITY_PROBE_FAILED: history page");
    let consumed = 0;
    async function* largeRows() { for (let i = 0; i < 20; i++) { consumed++; yield { text: "x".repeat(1024 * 1024) }; } }
    rejected = false;
    try { await boundedRows({}, largeRows(), "Fixture bytes"); }
    catch (error) { rejected = error instanceof ConvexError && String(error.data).includes("4 MiB"); }
    if (!rejected || consumed > 5) throw new ConvexError("READ_CAPACITY_PROBE_FAILED: byte guard");
    throw new ConvexError("READ_CAPACITY_PROBE_PASSED_ROLLED_BACK");
  },
});

/** Run real batching/scheduling helpers, then roll back fixtures and queued jobs. */
export const wakeBatchProbe = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    let checks = 0;
    const check = (condition: unknown, label: string) => { if (!condition) throw new ConvexError("WAKE_PROBE_FAILED: " + label); checks++; };
    const area = await ctx.db.query("areas").withIndex("by_key").first();
    if (!area) throw new ConvexError("Seed an area before the wake probe.");
    const stateBefore = await ctx.db.query("wakeState").withIndex("by_key", q => q.eq("key", "snooze")).unique();
    if (stateBefore) await ctx.db.delete(stateBefore._id); // restored by rollback
    const settings = await readSettings(ctx), date = dateString(2, settings.timezone);
    const morningBefore = await ctx.db.query("checkins").withIndex("by_date_kind", q => q.eq("date", date).eq("kind", "morning")).unique();
    if (morningBefore) await ctx.db.delete(morningBefore._id);
    const morning = () => ctx.db.query("checkins").withIndex("by_date_kind", q => q.eq("date", date).eq("kind", "morning")).unique();
    const state = () => ctx.db.query("wakeState").withIndex("by_key", q => q.eq("key", "snooze")).unique();
    // Each helper call represents a fresh transaction's capacity, inside this rollback boundary.
    const run = (generation?: number) => wakeDueBatch({ ...ctx }, 2, generation);
    const ids: Id<"tasks">[] = [];
    for (let i = 0; i < 205; i++) ids.push(await ctx.db.insert("tasks", {
      title: "TEST wake batch " + i, areaId: area._id, status: "inbox", waitingSince: 1,
      origin: "planned", source: "test", snoozeUntil: 1, updatedAt: 1,
      dedupeKey: "test:wake-probe:" + i,
    }));
    const first = await run(), firstState = (await state())!;
    check(first.woken === 100 && first.promoted === 100, "first bounded batch");
    const job = await ctx.db.system.get(firstState.scheduledJobId!);
    check(job?.state.kind === "pending", "continuation scheduled atomically");
    check((await run()).woken === 0, "overlapping cron skips active job");
    check((await run(firstState.generation - 1)).woken === 0, "stale generation rejected");
    const firstMorning = (await morning())!;
    const reordered = [...firstMorning.chosen].reverse().slice(1);
    await ctx.db.patch(firstMorning._id, { chosen: reordered });
    const second = await run(firstState.generation), secondMorning = (await morning())!;
    check(second.woken === 100 && second.promoted === 100, "second batch advances");
    check(reordered.every((id, i) => secondMorning.chosen[i] === id), "current ordering preserved");
    check(!secondMorning.chosen.includes(firstMorning.chosen[99]), "deliberate removal preserved");
    await ctx.scheduler.cancel((await state())!.scheduledJobId!);
    const third = await run(), thirdState = (await state())!;
    check(third.woken === 5 && third.promoted === 5, "cron recovers cancelled continuation");
    check(thirdState.generation > firstState.generation, "recovery invalidates old generation");
    check((await morning())!.chosen.length === 200, "maintained head bounded");
    for (const id of ids) {
      const task = (await ctx.db.get(id))!;
      check(task.status === "today" && task.snoozeUntil === undefined && task.waitingSince === undefined, "all backlog tasks progress");
    }
    check((await run(thirdState.generation)).woken === 0 && !(await state())!.scheduledJobId, "empty continuation releases ownership");
    check((await run(thirdState.generation)).woken === 0, "inactive generation rejected");
    // Escaped text must use Convex storage size, not its much larger JSON encoding.
    // The legacy check-in stays byte-for-byte intact while both large batches progress.
    const largeMorning = (await morning())!;
    await ctx.db.patch(largeMorning._id, { summary: "\0".repeat(800000) });
    const beforeLarge = JSON.stringify(await morning());
    const largeA = await ctx.db.insert("tasks", { title: "TEST large wake", note: "\0".repeat(800000), areaId: area._id,
      status: "inbox", origin: "planned", source: "test", snoozeUntil: 1, updatedAt: 1, dedupeKey: "test:wake-probe:large-a" });
    const largeB = await ctx.db.insert("tasks", { title: "TEST large chase", note: "\0".repeat(800000), areaId: area._id,
      status: "waiting", waitingSince: 1, origin: "planned", source: "test", snoozeUntil: 1, updatedAt: 1, dedupeKey: "test:wake-probe:large-b" });
    const largeFirst = await run(), largeState = (await state())!;
    check(largeFirst.woken === 1 && largeFirst.promoted === 1, "byte target ends first large batch");
    check(JSON.stringify(await morning()) === beforeLarge, "oversized legacy check-in untouched");
    const largeSecond = await run(largeState.generation);
    check(largeSecond.woken === 1 && largeSecond.promoted === 0, "second large batch advances");
    const chase = (await ctx.db.get(largeB))!;
    check(chase.status === "waiting" && chase.waitingSince === 1 && chase.snoozeUntil === undefined, "waiting clock survives");
    check((await ctx.db.get(largeA))!.status === "today", "legacy fallback still promotes task");
    check(JSON.stringify(await morning()) === beforeLarge, "legacy fallback stays unchanged across batches");
    check((await state())!.generation > thirdState.generation, "new idle generation never reuses token");
    throw new ConvexError("WAKE_PROBE_PASSED_ROLLED_BACK:" + checks);
  },
});
