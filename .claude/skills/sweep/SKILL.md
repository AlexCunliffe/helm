---
name: sweep
description: Run the user's Helm intraday capture sweep — pull NEW items since the last watermark from email, Slack, calendar, and Granola, propose them as Helm tasks (needsReview), advance the watermarks, and ping one line for one-tap confirm. Use on "/sweep", "run the sweep", "catch me up", "any new tasks", or as the ~90-minute scheduled routine. Requires the `helm` MCP plus the user's email/Slack/calendar/Granola MCPs.
---

# Helm · Intraday sweep

Capture is continuous, not a once-a-morning event. Pull what's new, propose it, and let the user confirm in one tap — never a form. Watermark-bounded so every run is small and cheap (docs/05).

## The loop (per source, then summarise)

Run each adapter below. They share one shape — a **CaptureCandidate**:
`{ title, note?, suggestedArea?, sourceRef:{url?,threadId?,label?}, dedupeKey, suggestedSize? }`.

For each source `S` in **email · slack · calendar · granola**:

1. `since = getWatermark(S)` (epoch ms; 0 = first run → use a sane look-back, e.g. last 24h, not all history).
2. Pull only items newer than `since` from S's own MCP (see adapters). Track the newest item's timestamp `maxAt`.
3. For each item → build a candidate and call helm **`capture`** with (most sources are one candidate per item; **granola fans out** — one meeting → *N* action-item candidates, see its adapter):
   `needsReview: true`, `source: S`, the `sourceRef`, a `dedupeKey`, an inferred `areaKey`, a one-line `contextLine`, and a `kickoffPrompt` if actionable by Claude.
   - **`dedupeKey` is mandatory and stable** — `S:<threadId|eventId|messageId>`. This makes re-sweeps safe: an already-captured thread won't double (the brain upserts by it).
4. `advanceWatermark(S, maxAt)` (only if you processed through `maxAt`; monotonic, so safe to repeat).

Then one calm ping (no wall):
```
🧹 Swept — N new proposed (email 2 · slack 1 · granola 1)
   Review: /brief → inbox, or say "keep all" / "drop <n>".
```
Confirm = `confirmProposed(id)` per kept item (one tap); drop = `setStatus(id,"dropped")`.

## Half-dupes: merge, don't drop (Phase 5)

`dedupeKey` only guards same-thread re-sweeps. When the same underlying thing arrives via **two different keys** (two alert emails on one incident, an email + a Granola action item), a semantic dupe slips through. When you spot one — a new proposal that duplicates an existing **open** task:

- **`merge({ sourceId: <newer>, targetId: <older> })`** — one task survives with the original added-date, the context folds in, and (the point) the dupe's `dedupeKey` becomes an alias of the survivor, so every future re-sweep of *that thread* refreshes the survivor instead of re-proposing.
- Don't just drop the dupe: drop suppresses its thread but leaves the context split and unrefreshable. Merge closes the loop.
- Same entity but genuinely **different actions** (a reply task + an artwork task for one customer) → **`connect`**, not merge — both stay live, linked as a cluster.
- Mention it in the ping when you did it: `(merged 1 dupe into "<title>")`.

## Adapters (v1)

- **email** — messages still in the **inbox (unarchived)** that need a reply/action since `since`. Use the configured source rules to identify actionable mail. `title` = the ask ("Reply to <sender>: <subject>"); `sourceRef.url` = message link, `threadId` = thread; infer area from content. Skip newsletters/receipts.
- **slack** — mentions + DMs since `since` that imply a task. `title` = the ask; `sourceRef` = permalink + channel/thread; `dedupeKey = slack:<ts>`.
- **calendar** — today's/tomorrow's events that need prep. `title` = "Prep for <event>"; `dedupeKey = calendar:<eventId>`; `suggestedSize` ~ "m". Watermark mainly guards against re-proposing the same event.
- **granola** — meetings **fan out**: one meeting yields *N* candidates (one per action item), not one candidate per meeting. This is the one adapter where the generic "one item → one candidate" loop does **not** apply — follow this two-step procedure explicitly:
  1. **Enumerate** new meetings since `since`. `list_meetings` takes a `time_range` enum, not epoch-ms — map `since` to `custom` with `custom_start`/`custom_end` as ISO dates (on a first run, `since=0` → look back ~24h). Keep only meetings whose start is newer than `since`; track the newest as `maxAt`.
  2. **Extract** action items: for each new meeting, call `get_meetings(meeting_ids)` to pull the AI summary + notes (which is where action items live — `list_meetings` returns titles/metadata only and will collapse to one bland "meeting" task if used alone). Read out the discrete action items / follow-ups / commitments. **Emit one `capture` candidate per action item**, with `title` = the action, `sourceRef.url` = the meeting link, and an inferred area.
  - If a meeting genuinely has no action items, propose nothing (don't fall back to a "had a meeting" task). Restraint over noise.
  - **dedupeKey — semantic, not positional.** Use `granola:<meetingId>:<slug-of-action>` (a short stable slug of the action text), not `:<itemIdx>`. Positional indices reshuffle between re-sweeps and re-propose duplicates; before proposing, also skip any action already present in the Helm inbox for that meeting. If one already slipped through under a different key, `merge` it into the survivor (see "Half-dupes" below) — that aliases the stray key so it can't re-propose. See the granola-dedupe memory.

## Scalability (docs/09)
A new source = a new adapter here + a new `source` string. No schema change — `source` is a free, registry-documented string and `capture` is the single write path. (Future: SMS, WhatsApp, a Linear webhook…)

## Cost & cadence
- Watermark-bounded → each run processes only the delta. Note token use in `PROGRESS.md` once it's running for real.
- Suggested schedule (Europe/London): every ~90 min, 09:00–18:00, plus a wider morning catch-up. the user sets this with `/schedule`.
- The confirm ping is local (the inbox) in v1. Posting it to **Slack** is Phase 3 (Claude Tag / a real send) — don't send outward yet.

## Restraint
Propose, don't over-propose. A receipt, a "thanks", a calendar block with nothing to prepare — skip. Better to miss one than to wall the user with noise.
