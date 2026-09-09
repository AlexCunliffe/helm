---
name: brief
description: Show the user's Helm brief — the one thing to do right now, today's 3, what they are waiting on, 2-min wins, ageing nudges, and their streak. Use on "/brief", "what's my brief", "what should I do now", "what's next", "what am I waiting on", "what's on today", or any morning "where am I" question. Also answers Helm queries like "what's in finance?" and acts on "done X" / "snooze X". Requires the `helm` MCP server.
---

# Helm · Brief

Decide for the user. Surface the one next thing and a short, calm picture — never a wall of 60. Keep the brief short enough to resume work without manual upkeep.

## Default: the morning brief

Call `brief` and render it glanceably, in this order (omit empty sections):

```
🎯 Right now — <pick.title>   ·   <Area>
   <pick.contextLine>
   (say "go" to kick it off)        ← only if pick has a kickoffPrompt

📋 Today (<n>)
   • <title> · <Area>
   • …

⏳ Waiting (<n>)   ← oldest first
   • <title> — on <waitingOn>, <Nd>

⚡ 2-min wins
   • <title>

🔔 Ageing — <title> (<Nd> untouched)   ← gentle nudge, only if present

🔥 <streak>-day streak · <inbox> to review
```

Rules:
- Lead with **Right now**. That single line is the product.
- Keep the whole thing to one screen. Trim, don't dump.
- Format epoch-ms times to Europe/London and to friendly ages ("3d", "2 weeks").
- If everything is empty (fresh system), say so warmly and offer: "Nothing queued — dump anything on your mind and I'll capture it." Don't fabricate.

## Acting on it (no second tool-name needed by the user)

- **"go" / "kick it off"** → run the pick's `kickoffPrompt` end-to-end; show anything irreversible before acting; when done call `logCompletion`.
- **"done <thing>"** → find it (via `brief`/`list`) and `markDone`.
- **"done <thing>, follow up: <instruction>"** → `markDone`, then `capture` the follow-up: title from the instruction, the original's area, status `next`, source `followup`, a contextLine referencing what the completed task established, `dedupeKey: followup:<originalId>:<short-slug-of-instruction>` (semantic — a re-fire can't double, a different follow-up still mints); `connect` it to the original (provenance); if the instruction carries timing ("in 3 days"), `snooze` it until then — the waker returns it to Now.
- **"snooze <thing> till <when>"** → `snooze` with the Europe/London ms; **"wake <thing>"** → `wake`.
- **"push <thing> to next/someday"** → `defer`.
- **"those are the same / merge <a> into <b>"** → `merge` (default `targetId` = the **older** task so the original added-date survives; say which one was kept).
- **"link <a> and <b> / these are related"** → `connect`; **"unlink"** → `disconnect`. Related tasks show as a cluster — mention linked siblings when surfacing one of them.

## Follow-up questions (NL queries)

Answer by reading the right query, then summarising — lead with overdue/waiting, group by area:
- "what am I waiting on?" → `waiting`.
- "what's in finance?" / "show me ops" → `list { areaKey }`.
- "what's in my inbox / to review?" → `inbox`; offer one-tap `confirmProposed` per item.
- "what did I do today?" → `dayLog` (planned + adhoc), with the count.

Stay calm and decided. One focus, low visual load.
