/** The maintained head of today's explicit order. Tasks outside it stay today. */
import type { MutationCtx } from "../_generated/server";
import { accountRead, payloadFits } from "./bounds";
import type { Id } from "../_generated/dataModel";

export const NOW_ORDER_LIMIT = 200;

export async function prependNow(ctx: MutationCtx, date: string, taskIds: Id<"tasks">[]) {
  if (!taskIds.length) return;
  const morning = accountRead(ctx, await ctx.db.query("checkins")
    .withIndex("by_date_kind", q => q.eq("date", date).eq("kind", "morning")).unique());
  const chosen = [...new Set([...taskIds, ...(morning?.chosen ?? [])])].slice(0, NOW_ORDER_LIMIT);
  // Unsupported legacy text must not stall background task transitions.
  // Preserve that check-in intact; the promoted tasks still have status today.
  if (morning && !payloadFits({ ...morning, chosen }, 256 * 1024)) return;
  if (morning) await ctx.db.patch(morning._id, { chosen, fixtureRunId: undefined });
  else await ctx.db.insert("checkins", { date, kind: "morning", chosen,
    completedPlanned: [], completedAdhoc: [], carried: [] });
}

export async function removeFromNow(ctx: MutationCtx, date: string, taskId: Id<"tasks">) {
  const morning = accountRead(ctx, await ctx.db.query("checkins")
    .withIndex("by_date_kind", q => q.eq("date", date).eq("kind", "morning")).unique());
  if (morning?.chosen.includes(taskId)) await ctx.db.patch(morning._id, {
    chosen: morning.chosen.filter(id => id !== taskId), fixtureRunId: undefined,
  });
}
