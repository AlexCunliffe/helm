/**
 * Test-fixture janitor for the regression harness (scripts/regression.mjs).
 *
 * `internalMutation` — callable only with admin credentials (`npx convex run`),
 * never by MCP/HTTP clients, so it can't be used to delete real data. The
 * harness tags every task fixture with a `test:`-prefixed dedupeKey and pins
 * check-in fixtures to fake past dates; this deletes exactly that footprint.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const purgeTestData = internalMutation({
  args: {
    prefix: v.optional(v.string()), // dedupeKey prefix; default "test:"
    dates: v.optional(v.array(v.string())), // checkin dates ("YYYY-MM-DD") to purge
  },
  returns: v.object({ tasks: v.number(), checkins: v.number() }),
  handler: async (ctx, { prefix = "test:", dates = [] }) => {
    // Range scan on by_dedupe covers every key with the prefix. Tasks without a
    // dedupeKey sort before all strings in the index, so they're never touched.
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_dedupe", (q) =>
        q.gte("dedupeKey", prefix).lt("dedupeKey", prefix + "\uffff"),
      )
      .collect();
    for (const t of tasks) await ctx.db.delete(t._id);

    let checkins = 0;
    for (const date of dates) {
      const rows = await ctx.db
        .query("checkins")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();
      for (const c of rows) {
        await ctx.db.delete(c._id);
        checkins++;
      }
    }
    return { tasks: tasks.length, checkins };
  },
});
