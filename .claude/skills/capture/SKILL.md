---
name: capture
description: Capture a task, thought, or commitment into Helm (the user's task brain) with zero friction. Use whenever the user dumps a to-do, says they need to do/chase/check something later, forwards or pastes a request, or mentions they JUST finished/did something. Triggers on "/capture", "capture this", "add a task", "remind me to…", "I need to…", "just did…", "finished…". Requires the `helm` MCP server.
---

# Helm · Capture

Zero-input capture. Turn whatever the user just said into the right Helm row, then get out of the way. Never show a form; never ask a clarifying question you can answer yourself.

## 1. Pick the direction (the load-bearing choice)

- **Already happened** → `logCompletion` (an `adhoc`, done task). Triggers: "just did", "finished", "sorted", "fixed", "sent", "handled", any past-tense "I did X". This is the distraction/rabbit-hole catcher — log it so the day reconciles itself.
- **Still to do** → `capture` (a `planned` task). Triggers: "need to", "must", "remember to", "chase", "later", a forwarded ask, a deadline.

If a single dump contains both, do both. If it lists several tasks, capture each.

## 2. Fill the fields for the user (don't ask)

- **areaKey** — infer an area key from `listAreas`. If genuinely unsure, call `listAreas` once. If still ambiguous, omit it (the brain defaults sensibly) rather than guessing wildly.
- **status** (forward tasks only) — `today` if "today/now/this morning"; `next` if "soon/this week"; `waiting` if blocked on someone (also set `waitingOn`); otherwise leave default (`inbox`). Never pass `done`/`dropped` here — completions go through `logCompletion`.
- **size** — `xs` for a ~2-minute job, `l` for deep/focus work, else `m`.
- **urgent** — true only if the user signals real urgency.
- **contextLine** — ALWAYS write a one-line "where this is at" so re-entry is a 5-second read (e.g. "Sam received the sample invoice; awaiting confirmation"). This is the whole point — kill re-entry cost.
- **kickoffPrompt** — if Claude could execute the task, write a ready-to-run instruction (so "kick off Helm on this" later is a data lookup, not re-thinking). Skip for non-executable/human-only tasks.
- **source** — `"claude"`. Add **sourceRef** (`url`/`threadId`/`label`) if a link or thread is mentioned.
- **dedupeKey** — only when there's a real re-capture risk (e.g. capturing from a named source/thread): use a stable hash like `source:threadId`. For free-text dumps, omit it.

## 3. Confirm calm, not chatty

One terse line per item — no wall, no recap of the fields:

```
✓ Approve sample finance entry → Finance · today
✓ Logged: fixed the report import pattern → Finance (adhoc)
```

If you wrote a `kickoffPrompt`, you may add ` (say "go" to run it)` to the line.

## Notes
- All times are epoch ms. "tomorrow 9am", "Friday" → compute the ms for `dueAt`/`snoozeUntil` in Europe/London.
- Don't over-capture: a passing remark isn't a task. When the user is clearly dumping, capture; when they are thinking aloud, don't.
