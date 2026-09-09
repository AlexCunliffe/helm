# 05 · Capture (throughout the day, zero input)

Capture is **continuous**, not a once-a-morning event.

## Three modes

1. **On-demand** — the user sends a line in local Claude Code → `capture`. This is available after the Helm MCP installation. Claude Tag is a possible later integration; this repository does not wire it.
2. **Ambient capture** — an optional rule in the conversational client proposes task capture while the user works. External watching or sends need separate setup and authorization.
3. **Recurring sweep** — an optional scheduled routine runs at the cadence chosen by the owner, reading enabled sources with their documented incremental or rolling-window procedure.

## The sweep — bounded source reads

- Incremental sources store a watermark in `meta` (`sweep:<source>:lastAt`). Read updates newer than that boundary. Advance it only after the complete source window succeeds.
- Calendar prep reads the complete window covering the current and next dates in the configured timezone. Do not filter that window by event update time or the saved watermark. Follow every page within the supported source/run limits. An unchanged booking can enter the window long after it was created.
- After a complete calendar read, store the run-start time as a diagnostic watermark. Keep it unchanged when a source read or item fails. Never use a future event start as the watermark.
- A source's settings entry names its connector. Its notes define the actual tool calls, filters, paging, timestamps, and stable task identity. An incremental connector accepts an update boundary; a calendar connector accepts start/end bounds. The skill composes those calls; the repository does not supply a universal connector adapter.
- The skill reads `settings.sources`. It uses only enabled entries and their named MCP servers. Source `notes` define tool names, filters, timestamp rules, and expansion into discrete actions. Optional connector presets live in `scripts/lib/sources.mjs`; all start disabled.
- Each candidate calls `capture` with `needsReview:true`. Calendar prep also supplies a stable occurrence/action dedupe key and `reopenCompleted:false`. New proposals stay in the Helm inbox until confirmed. The skill summarizes in the current conversation. It sends no external notification without authorization.

## Implementation choice (v1)
The sweep can run as a **Claude Code scheduled routine** — it reuses the enabled MCP connections named in settings and writes via the Helm MCP. No bespoke backend integration. Later it can move into a Convex cron action if we want it server-resident; the source-specific boundary and identity rules still apply.

## Dedupe & idempotency
`dedupeKey` (e.g. hash of `source + threadId`) makes re-sweeps safe — a thread already captured won't double. Re-running the same fully processed source window reuses its stable keys. Default capture can create a new task after completion; dropped work remains suppressed. Calendar window reads use `reopenCompleted:false`, so repeated reads preserve completed prep without reopening it. A distinct action or recurring occurrence gets its own stable key.

## Cost
The skill limits a source to 100 items and a run to 200 items. It leaves the watermark unchanged when a complete processing boundary is uncertain. These are instruction-level bounds; the client scheduler must enforce any monetary budget. No paid AI call is scheduled by the backend sweep.
