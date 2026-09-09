# 05 · Capture (throughout the day, zero input)

Capture is **continuous**, not a once-a-morning event.

## Three modes
1. **On-demand** — the user dumps a line in Claude Code or DMs Claude Tag → `capture`. Always available.
2. **Continuous (ambient)** — Claude Tag watches its Slack channel + connected sources and captures/chases in real time (`docs/07-ai-integration`, `docs/02`).
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
- v1 adapters: **email** (unread/flagged), **Slack** (mentions/DMs), **calendar** (today's events → prep tasks), **Granola** (meeting action-items).
- Each candidate → `capture(..., needsReview:true)`. Then a single Slack/Tag ping: "3 new — keep all? / triage". Confirmation is one tap, not data entry.

## Implementation choice (v1)
The sweep is a **Claude Code scheduled routine** (`/schedule`) — it reuses the user's existing email/Slack/calendar/Granola MCP connections and writes via the Helm MCP. No bespoke backend integration. Later it can move into a Convex cron action if we want it server-resident; the adapter interface is identical.

## Dedupe & idempotency
`dedupeKey` (e.g. hash of `source + threadId`) makes re-sweeps safe — a thread already captured won't double. Re-running the sweep is always safe.

## Cost
Watermark-bounded; runs are small. Respect the configured spend cap. Log token use in `PROGRESS.md` once live.
