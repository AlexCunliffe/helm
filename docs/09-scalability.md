# 09 · Scalability (add without rework)

Helm must absorb new capture sources, new surfaces, and new brain categories without migrations or refactors. The rules:

## The core principle
- **User-facing things that change often → data (tables).** Categories (`areas`) are rows. Add/rename a function = insert/edit a row. No schema change, no migration, no redeploy.
- **Developer enums that change rarely → unions** (`status`, `size`, `origin`). Extending is a one-line additive edit (Convex needs no data backfill for an additive value).
- **`source` is a free string** with a documented registry — a brand-new capture channel needs no schema edit at all.

## Add a capture source
Implement the `CaptureSource` adapter (`docs/05`) and register it in the sweep's source list. It emits `CaptureCandidate`s into the same `capture` path. Nothing else changes. (Future: SMS, WhatsApp, voice memo, a Linear webhook…)

## Add a surface
Consume the read API / `GET /brief`. Render. No brain change (`docs/06`). (Future: Apple Watch complication, a hallway LED matrix, a CarPlay glance…)

## Add a brain category
Insert an `areas` row (key, label, color, optional `vaultDomain`). Existing tasks unaffected; new tasks use it immediately.

## Schema evolution
Additive-only by default: new optional fields, new tables. Never repurpose a field's meaning. If a real migration is ever unavoidable, write it as a one-off Convex mutation, test on dev, and record it in `docs/11-decisions.md`.

## Keep the seams honest
Don't collapse these seams for short-term convenience (e.g. hardcoding an area list in a query). If you catch yourself writing a closed list of something the spec says extends — stop, use the data-driven path.
