/**
 * Test-fixture janitor for the regression harness (scripts/regression.mjs).
 *
 * `internalMutation` — callable only with admin credentials (`npx convex run`),
 * never by MCP/HTTP clients. The harness owns a distinct test-prefixed task
 * namespace. Check-ins require exact snapshots of rows created by that run;
 * date-wide deletion is deliberately refused.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { seedAreaRows } from "./areas";
import { dayRange } from "./lib/time";
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
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_dedupe", (q) =>
        q.gte("dedupeKey", prefix).lt("dedupeKey", prefix + "\uffff"),
      )
      .collect();
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
