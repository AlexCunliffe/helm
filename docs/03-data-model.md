# 03 · Data model

The authoritative field validators are in [convex/validators.ts](../convex/validators.ts). Table definitions and indexes are in [convex/schema.ts](../convex/schema.ts). Every document also has Convex `_id` and `_creationTime` fields.

User-facing categories are rows. Developer enums are additive unions. See [schema evolution](09-scalability.md).

## Areas

`areas` contains `key`, `label`, `color`, and `order`. `vaultDomain` and `archived` are optional. The `by_key` index resolves a stable slug to an area ID. Renaming a label does not change task references. Retirement preserves existing tasks. The generic set is work, finance, people, admin, home, and personal.

## Tasks

| Group | Fields |
| --- | --- |
| Identity and content | `title`, optional `note`, required `areaId`, optional `projectId` |
| Lifecycle | `status`, `origin`, optional `size`, optional `urgent` |
| Provenance | `source`, optional `sourceRef`, `dedupeKey`, `dedupeAliases` |
| Re-entry | Optional `contextLine`, `kickoffPrompt`, `vaultRef` |
| Waiting and scheduling | Optional `waitingOn`, `waitingSince`, `snoozeUntil`, `wokeAt`, `dueAt` |
| Work and completion | Optional `startedAt`, `doneAt`, `completionNote`, `provisional` |
| Review and maintenance | Optional `needsReview`, required `updatedAt` |
| Relationships | Optional `links`, `mergedInto`, `mergedFrom` |

Statuses are `inbox`, `today`, `next`, `waiting`, `someday`, `done`, and `dropped`. Capture accepts only the first five. Completion operations set `doneAt`. `origin` is `planned` or `adhoc`. `size` is `xs`, `m`, or `l`.

`source` is a free string. Common sources include `manual`, `claude`, `claude-hook`, `ingest`, and configured connector keys. A `sourceRef` can have `url`, `threadId`, and `label`. Adding a source needs no enum migration.

`links` contains task IDs for symmetric connections. A merged-away row is dropped and points to its survivor through `mergedInto`. `mergedFrom` preserves each source's title, optional source reference, and optional dedupe key. `dedupeAliases` preserves additional provenance. Full MCP capture follows merge pointers; restricted HTTP ingest does not.

Task indexes are `by_status`, `by_area`, `by_waiting` (`status`, `waitingSince`), `by_done`, `by_snooze`, `by_dedupe`, and `by_review`.

## Projects

`projects` contains `name`, `areaId`, and `status`. `note` and `vaultRef` are optional. Status is `active`, `paused`, or `done`. The table has a `by_status` index. Project links are a data-model seam; there is no full project-management interface in this release.

## Check-ins

`checkins` contains `date`, `kind`, `chosen`, `completedPlanned`, `completedAdhoc`, and `carried`. The four task collections contain task IDs. `summary` is optional. The optional `fixtureRunId` marks regression-owned rows. Normal check-in writes clear it. Tests refuse existing rows owned by anyone else, and cleanup checks both ownership and the exact saved snapshot. `kind` is `morning` or `evening`. `date` is a `YYYY-MM-DD` calendar date interpreted in the configured timezone. The indexes are `by_date` and `by_date_kind`.

## Meetings

`meetings` contains `eventId`, `title`, `startAt`, `endAt`, and `updatedAt`. `url`, `prepTaskId`, and `prepPromotedAt` are optional. `by_start` supports the rolling calendar window. `by_event` resolves stable event IDs. Sync reconciles a complete bounded snapshot by event ID. It preserves matching row IDs and prep state, repairs duplicate event IDs, and removes old or missing rows. Events are retained by window overlap, including long ongoing meetings.

## Settings and metadata

`meta` contains `key` and `value`, indexed by `by_key`. One row with `key: "settings"` stores the validated owner, context, timezone, workday, caps, sources, and hook configuration. Read [the full field reference](configure.md). The settings mutation validates updates; the generic metadata setter cannot replace this row.

Other metadata includes source watermarks (`sweep:<source>:lastAt`) and legacy interface preferences. For incremental sources, a watermark identifies a fully processed update boundary. For calendar prep, it records the start of the last completed window read and never filters the next event window. It is never a future event start.

## Planned and unplanned work

`planned` is a forward intention. `adhoc` is work captured after it happened. Both appear in the daily completion record. This makes the daily account include the work that displaced the original plan.

Task reads also use additive `by_status_area`, `by_status_done`, and `by_status_provisional_done` indexes for filtered history, daily completions, and streak existence checks. Existing indexes remain available.
