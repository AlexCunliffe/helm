# 05 · Capture (throughout the day, zero input)

Capture is **continuous**, not a once-a-morning event.

## Three modes
1. **On-demand** — the user dumps a line in Claude Code or DMs Claude Tag → `capture`. Always available.
2. **Ambient capture** — an optional rule in the conversational client proposes task capture while the user works. External watching or sends need separate setup and authorization.
3. **Recurring sweep** — a scheduled routine runs **every ~60–90 min during working hours** (plus a wider morning catch-up), pulling *new* items since a watermark from each source.

## The sweep — incremental & cheap
- Per-source watermark in `meta` (`sweep:<source>:lastAt`). Each run processes only items newer than the watermark, then advances it. Bounded work → low token cost.
- Sources via a common **adapter interface** so new ones plug in (`docs/09`):
  ```ts
  interface CaptureSource {
    key: string;                       // "email" | "slack" | "calendar" | "granola" | …
    pull(since: number): Promise<CaptureCandidate[]>;
  }
  type CaptureCandidate = {
    title: string; note?: string; suggestedArea?: string;
    sourceRef: { url?: string; threadId?: string; label?: string };
    dedupeKey: string; suggestedSize?: "xs" | "m" | "l";
  };
  ```
- The skill reads `settings.sources`. It uses only enabled entries and their named MCP servers. Source `notes` define tool names, filters, timestamp rules, and expansion into discrete actions. Optional connector presets live in `scripts/lib/sources.mjs`; all start disabled.
- Each candidate calls `capture` with `needsReview:true`. The result stays in the Helm inbox until confirmed. The skill summarizes in the current conversation. It sends no external notification without authorization.

## Implementation choice (v1)
The sweep is a **Claude Code scheduled routine** (`/schedule`) — it reuses the enabled MCP connections named in settings and writes via the Helm MCP. No bespoke backend integration. Later it can move into a Convex cron action if we want it server-resident; the adapter interface is identical.

## Dedupe & idempotency
`dedupeKey` (e.g. hash of `source + threadId`) makes re-sweeps safe — a thread already captured won't double. Re-running the sweep is always safe.

## Cost
The skill limits a source to 100 items and a run to 200 items. It leaves the watermark unchanged when a complete processing boundary is uncertain. These are instruction-level bounds; the client scheduler must enforce any monetary budget. No paid AI call is scheduled by the backend sweep.
