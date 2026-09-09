# 04 · Functions & API (the MCP surface)

One small set, exposed to Claude Code and Claude Tag via the Helm MCP server, plus token HTTP for surfaces.

## Mutations (writes)
- `capture(input)` — raw or structured → upsert a `tasks` row by `dedupeKey`. Resolves area (key → id), fills size, source, sourceRef, contextLine, kickoffPrompt. Default status `inbox` (or `today`/`next` if clearly stated). `needsReview:true` when proposed by a sweep.
- `logCompletion(input)` — create an `adhoc` + `done` task (`doneAt = now`). The distraction catcher. Accepts `provisional:true` (from the hook) so the evening pass can refine/merge.
- `markDone(id)` · `snooze(id, until)` · `wake(id)` (clears the snooze) · `defer(id, status)` · `setStatus(id, status)` · `update(id, patch)` · `confirmProposed(id)` (clears `needsReview`).
- `seedAreas(list)` / `upsertArea(...)` — manage categories.

## Queries (reads)
- `brief()` — today's 3 (chosen or auto-picked) + waiting-on-others (oldest first) + 2-min wins + ageing flags. The morning payload.
- `todaysPick()` — the single "right now" task.
- `dayLog(date)` — everything `doneAt` within the day, planned + adhoc — the evening reconcile payload.
- `inbox()` — `needsReview` items awaiting confirm.
- `waiting()` — status = waiting, by `waitingSince`.
- `list(filter)` — generic, indexed, for NL queries from the client.

## HTTP (`httpAction`, token-guarded)
- `GET /brief?token=…` → JSON for the iPhone widget / desk screen (read-only).
- `POST /ingest?token=…` → generic capture webhook (reserved; server-side parse is the first place server AI could enter — `docs/07`).

Auth: a shared secret in Convex env (`HELM_SURFACE_TOKEN`), never in the repo. MCP actors authenticate via the MCP server config.

## Packaging
Ship a tiny **Helm MCP server** (stdio) exposing the mutations/queries above as tools, pointed at the Convex deployment. The build session produces the exact `claude mcp add …` / config snippet for the user to register — it does **not** self-install (human-in-the-loop gate).

## Design notes
- Keep mutations thin and total; push composition into the client (Claude). The brain stays "dumb data + good queries" (`docs/07`).
- Every query is index-backed — no full collection scans (the table will grow for years).
- All times are epoch ms; format to Europe/London at the edges.
