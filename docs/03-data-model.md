# 03 · Data model (Convex)

Principle: **user-facing categories that change often = tables** (add a row, no migration). **Developer enums that change rarely = unions** (a one-line additive edit). See `docs/09`.

## Tables

### `areas` — the brain's categories (data-driven, extensible)
```ts
areas: defineTable({
  key: v.string(),        // "finance" — stable slug used by clients
  label: v.string(),      // "Finance"
  color: v.string(),      // hex for surfaces
  vaultDomain: v.optional(v.string()), // e.g. "50-commercial" — bridge to a second-brain domain
  order: v.number(),
  archived: v.optional(v.boolean()),
}).index("by_key", ["key"])
```
Generic default set: work, finance, people, admin, home, personal. Adding/renaming a function later = insert/edit a row. Nothing else changes.

### `tasks` — the core
```ts
tasks: defineTable({
  title: v.string(),
  note: v.optional(v.string()),
  areaId: v.id("areas"),
  projectId: v.optional(v.id("projects")),

  status: v.union(/* "inbox","today","next","waiting","someday","done","dropped" */),
  origin: v.union(v.literal("planned"), v.literal("adhoc")), // adhoc = unplanned, logged after the fact
  size: v.optional(v.union(v.literal("xs"), v.literal("m"), v.literal("l"))), // 2-min / focus / deep
  urgent: v.optional(v.boolean()),

  source: v.string(),     // "claude"|"slack"|"email"|"calendar"|"granola"|"manual"|future — free, registry-documented
  sourceRef: v.optional(v.object({
    url: v.optional(v.string()),
    threadId: v.optional(v.string()),
    label: v.optional(v.string()),
  })),
  contextLine: v.optional(v.string()),   // Claude-written "where this is at" — kills re-entry cost
  kickoffPrompt: v.optional(v.string()), // ready-to-run instruction to execute it (docs/07)
  vaultRef: v.optional(v.string()),      // relative path/slug to a second-brain note (docs/08)

  waitingOn: v.optional(v.string()),
  waitingSince: v.optional(v.number()),
  snoozeUntil: v.optional(v.number()),
  dueAt: v.optional(v.number()),
  doneAt: v.optional(v.number()),

  needsReview: v.optional(v.boolean()),  // proposed by the sweep, awaiting one-tap confirm
  dedupeKey: v.optional(v.string()),     // idempotent capture
  updatedAt: v.number(),

  // merge + connect (Phase 5, docs/03-data-model.md)
  links: v.optional(v.array(v.id("tasks"))),   // connect: symmetric adjacency (clusters = connected components)
  mergedInto: v.optional(v.id("tasks")),       // set on a merged-away (dropped) source — traceable, not lost
  mergedFrom: v.optional(v.array(v.object({    // provenance of everything folded into this task
    title: v.string(),
    sourceRef: v.optional(sourceRef),
    dedupeKey: v.optional(v.string()),
  }))),
  dedupeAliases: v.optional(v.array(v.string())), // re-sweep-safe merge (docs/03-data-model.md)
})
  .index("by_status", ["status"])
  .index("by_area", ["areaId"])
  .index("by_waiting", ["status", "waitingSince"])
  .index("by_done", ["doneAt"])
  .index("by_snooze", ["snoozeUntil"])
  .index("by_dedupe", ["dedupeKey"])
  .index("by_review", ["needsReview"])
```

### `projects`
```ts
projects: defineTable({
  name: v.string(),
  areaId: v.id("areas"),
  status: v.union(v.literal("active"), v.literal("paused"), v.literal("done")),
  note: v.optional(v.string()),
  vaultRef: v.optional(v.string()),      // → 90-projects/<slug>.md
}).index("by_status", ["status"])
```

### `checkins` — accountability log
```ts
checkins: defineTable({
  date: v.string(),                      // "2026-06-24" (Europe/London)
  kind: v.union(v.literal("morning"), v.literal("evening")),
  chosen: v.array(v.id("tasks")),        // today's 3
  completedPlanned: v.array(v.id("tasks")),
  completedAdhoc: v.array(v.id("tasks")),
  carried: v.array(v.id("tasks")),
  summary: v.optional(v.string()),
}).index("by_date", ["date"])
```

### `meta` — singletons (watermarks, config)
```ts
meta: defineTable({ key: v.string(), value: v.any() }).index("by_key", ["key"])
// e.g. key:"sweep:email:lastAt" → timestamp (docs/05)
```

## The load-bearing field: `origin`
`planned` = a forward task. `adhoc` = unplanned work captured *after* it happened (status goes straight to `done`, `doneAt` set). Same table, two directions of time. This is what makes "what did I actually do today?" answerable (`dayLog` + evening reconcile).
