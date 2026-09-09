/**
 * Hydration + small predicates shared by the read API (docs/04). Surfaces get a
 * task with its area folded in so they never need a second query (docs/06).
 */
import { QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export type AreaMap = Map<Id<"areas">, Doc<"areas">>;

/** Load every area once, keyed by id, for cheap in-memory hydration. */
export async function loadAreaMap(ctx: QueryCtx): Promise<AreaMap> {
  const areas = await ctx.db.query("areas").collect();
  return new Map(areas.map((a) => [a._id, a]));
}

export type TaskView = Doc<"tasks"> & {
  area: { key: string; label: string; color: string };
  addedAt: number; // when the task was initially added (mirrors _creationTime)
};

/** Fold a task's area in. Falls back gracefully if the area was deleted. */
export function toView(task: Doc<"tasks">, areas: AreaMap): TaskView {
  const a = areas.get(task.areaId);
  return {
    ...task,
    area: a
      ? { key: a.key, label: a.label, color: a.color }
      : { key: "unknown", label: "Unknown", color: "#888888" },
    // Named "date initially added" for surfaces. Retention is already honest:
    // capture upserts via patch, so _creationTime is preserved on re-hit.
    addedAt: task._creationTime,
  };
}

/** Snoozed = parked until a future wake time; hidden from every surface. */
export function isSnoozed(task: Doc<"tasks">, now: number): boolean {
  return task.snoozeUntil !== undefined && task.snoozeUntil > now;
}

/** Terminal tasks are out of play. */
export function isClosed(task: Doc<"tasks">): boolean {
  return task.status === "done" || task.status === "dropped";
}

/** Surface order: urgent → soonest due → stalest (oldest updatedAt rises). */
export function byPriority(a: Doc<"tasks">, b: Doc<"tasks">): number {
  const ua = a.urgent ? 1 : 0;
  const ub = b.urgent ? 1 : 0;
  if (ua !== ub) return ub - ua;
  const da = a.dueAt ?? Infinity;
  const db = b.dueAt ?? Infinity;
  if (da !== db) return da - db;
  return a.updatedAt - b.updatedAt;
}
