/**
 * Helm schema (docs/03).
 *
 * Principle (docs/09): user-facing categories that change often = tables
 * (`areas` — add a row, no migration); developer enums that change rarely =
 * unions (`status`, `origin`, `size` — additive one-line edits). `source` is a
 * free, registry-documented string so a new capture channel needs no schema
 * edit at all. Every query is index-backed — the tables grow for years.
 */
import { defineSchema, defineTable } from "convex/server";
import {
  areaFields,
  taskFields,
  projectFields,
  checkinFields,
  meetingFields,
} from "./validators";
import { v } from "convex/values";

export default defineSchema({
  // The brain's categories — data-driven & extensible. Add/rename a function
  // later = insert/edit a row; nothing else changes.
  areas: defineTable(areaFields).index("by_key", ["key"]),

  // The core table. Holds forward intentions (origin:planned) and after-the-fact
  // completions (origin:adhoc) — same table, two directions of time.
  tasks: defineTable(taskFields)
    .index("by_status", ["status"])
    .index("by_area", ["areaId"])
    .index("by_waiting", ["status", "waitingSince"])
    .index("by_done", ["doneAt"])
    // Forward seam (docs/03): not yet read — reserved for a Phase-2 snooze-waker
    // cron ("surface a task when its snooze expires"). Cheap to carry; keeps the
    // "it comes to you" seam ready without a later migration.
    .index("by_snooze", ["snoozeUntil"])
    .index("by_dedupe", ["dedupeKey"])
    .index("by_review", ["needsReview"]),

  projects: defineTable(projectFields).index("by_status", ["status"]),

  // Accountability log — one morning + one evening row per day.
  checkins: defineTable(checkinFields).index("by_date", ["date"])
    .index("by_date_kind", ["date", "kind"]),

  // Rolling mirror of today+tomorrow's calendar (4.2, D12) — markers on the
  // day thread + T-30 prep promotion. Replaced per sync window, never grows.
  meetings: defineTable(meetingFields)
    .index("by_start", ["startAt"])
    .index("by_event", ["eventId"]),

  // Singletons: watermarks, config. e.g. key:"sweep:email:lastAt" → timestamp.
  meta: defineTable({ key: v.string(), value: v.any() }).index("by_key", ["key"]),
});
