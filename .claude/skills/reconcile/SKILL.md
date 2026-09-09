---
name: reconcile
description: Run the user's Helm evening reconcile — "here's everything you did today" (planned + the unplanned rabbit-holes), what carried to tomorrow, and the streak. Use on "/reconcile", "reconcile my day", "end of day", "what did I get done today", or as a scheduled evening routine. Cleans up the provisional completions the SessionEnd hook logged. Requires the `helm` MCP server.
---

# Helm · Evening reconcile

Give the day an honest, dopamine-positive close. Reconcile shows planned and unplanned work together.

## Steps

1. **Survey the day.** Call `dayLog` for today's itemised list — planned, unplanned, and the hook's raw `provisional:true` entries.

2. **Clean the provisional markers.** The SessionEnd hook logs raw `provisional:true` adhoc completions (source `claude-hook`) — one per Claude Code session. For today's provisional items:
   - Consolidate duplicate completions: retitle the survivor (`update`) and drop the copies (`setStatus … "dropped"`) — dropped rows leave the day's numbers entirely. (Don't reach for the `merge` tool here — it's for **open** dupes and rejects done tasks by design; done-side cleanup is exactly this retitle-and-drop.)
   - Drop anything trivial or noise (`setStatus … "dropped"`).
   - Leave real work in place; the next step confirms it.
   - If the survey surfaces two **open** tasks that are the same underlying thing, that's the `merge` tool's job (`merge { sourceId: newer, targetId: older }` — provenance kept, re-sweep-safe); related-but-distinct pairs can be `connect`ed instead.
   This is operational cleanup only — **never** write knowledge into a second-brain here (docs/08). It's fine to *offer* a dated journal line (next step).

3. **Reconcile + heal.** Call `reconcileOutstanding` (no args). It closes today (evening check-in + counts), **backfills any missed days** since the last reconcile (laptop was shut, weekend away — the record self-heals), and **confirms the surviving provisionals** so they count toward the streak. If it backfilled days, say so in one warm line ("also closed Tuesday retroactively — 3 things"). Then re-read `dayLog` for the final list.

4. **Present the day** — calm, warm, specific:

   ```
   ✅ Today — <date>

   Planned, done (<n>)
     • <title> · <Area>

   Also did — unplanned (<n>)
     • <title> · <Area>

   ↪ Carried to tomorrow (<n>)
     • <title>

   🔥 <streak>-day streak · <total> things shipped today
   ```

5. **Offer (opt-in) a journal line.** Ask if the user wants a one-line dated entry appended to their second-brain `_captures/journal/` summarising the day. Only on a clear yes — knowledge is **proposed, never auto-written** (docs/08). If yes and a brain path is known, append a single dated bullet; otherwise hand them the line to paste.

## Notes
- Idempotent: safe to run more than once an evening; `reconcileDay` upserts.
- Slack posting of this summary is **Phase 3** (Claude Tag / a real send) — for now it's a console/chat summary. Don't send anything outward.
- To automate: the user can `/schedule` this skill for ~18:00 Europe/London.
