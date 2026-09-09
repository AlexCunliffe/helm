# 09 · Scalability (add without rework)

Helm must absorb new capture sources, new surfaces, and new brain categories without migrations or refactors. The rules:

## The core principle
- **User-facing things that change often → data (tables).** Categories (`areas`) are rows. Add/rename a function = insert/edit a row. No schema change, no migration, no redeploy.
- **Developer enums that change rarely → unions** (`status`, `size`, `origin`). Extending is a one-line additive edit (Convex needs no data backfill for an additive value).
- **`source` is a free string** with a documented registry — a brand-new capture channel needs no schema edit at all.

## Add a capture source
Add an entry to `settings.sources`. Set its MCP server, kind, and source notes. Enable it when the connector is ready. For a custom backend integration, implement the `CaptureSource` adapter described in `docs/05-capture.md`. It emits `CaptureCandidate`s into the same `capture` path. Nothing else changes. (Future: SMS, WhatsApp, voice memo, a Linear webhook…)

## Add a surface
Consume the read API / `GET /brief`. Render. No brain change (`docs/06`). (Future: Apple Watch complication, a hallway LED matrix, a CarPlay glance…)

## Add a brain category
Insert an `areas` row (key, label, color, optional `vaultDomain`). Existing tasks unaffected; new tasks use it immediately.

## Schema evolution
Additive-only by default: new optional fields, new tables. Never repurpose a field's meaning. If a real migration is ever unavoidable, write it as a one-off Convex mutation, test on dev, and record it in `docs/11-decisions.md`.

## Keep the seams honest
Don't collapse these seams for short-term convenience (e.g. hardcoding an area list in a query). If you catch yourself writing a closed list of something the spec says extends — stop, use the data-driven path.

## Read capacities

Complete task queries support at most 1000 rows in each selected index partition. An operation also has a shared task/meeting read budget of 4000 rows and 4 MiB of serialized data. A complete summary fails with a clear capacity error when a bound is exceeded; it does not report a truncated total. Display caps apply after complete bounded reads. Areas retain their separate 100-row limit.

Use MCP `listPage` for larger task history. Keep the filters unchanged. Pass each `continueCursor` as the next `cursor`. Continue until `isDone` is true, including after an empty filtered page. `numItems` is an integer from 1 to 200 and defaults to 50. Each page scans up to the requested rows, with additional 200-row and 1 MiB database read bounds. Filters can produce fewer returned items. Pages use newest creation order; `list` uses priority order. Without a status filter, `listPage` includes closed work too.

The `list` query applies status, area, origin, review, and snooze filters before its final result limit. Use a status and area together to narrow its compound index. A small result limit does not increase the supported candidate capacity. Daily streaks use indexed existence checks, so they do not read the full completion archive.
