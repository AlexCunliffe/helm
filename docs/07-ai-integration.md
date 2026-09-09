# 07 · AI integration — do we need server-side AI in Convex?

**Short answer: not for v1. Keep the brain pure data; the AI lives at the edges (Claude Code, Claude Tag, scheduled routines) — which are already Claude.** Cheaper, simpler, and avoids duplicating LLM orchestration server-side. But we design two AI-adjacent capabilities now, and one clean extension point for later.

## 1. Per-task `kickoffPrompt` (data, not server AI) — ships in v1
When *any* Claude captures a task, it also writes a `kickoffPrompt`: a ready-to-run instruction to execute it. Then "kick off Claude on this todo" is a **data lookup + client execution** — Claude Code runs it, Tag runs it autonomously, a button fires it. No server LLM.

Example stored on a finance task:
> "Read the sample invoice. Draft the adjustment. Show the draft before posting. After approval, record the completion."

## 2. Natural-language query = client-side — ships in v1
"What's overdue in finance?" / "what am I waiting on?" is answered by Claude Code or Tag reading via the MCP `list`/`brief`/`waiting` queries and summarising. The brain exposes good indexed queries; the **LLM is the client**. No NL endpoint in Convex.

## 3. Reserved extension point: `convex/agents/` (off by default) — later
For when you want the **brain itself** to act autonomously with no human present. Two concrete future uses:
- An overnight cron that picks the day's `xs` (2-min) wins and kicks off a Claude Code **cloud routine** (via API) to clear them.
- The generic `POST /ingest` webhook (forward an email in) needing **server-side parsing** of raw text → structured task.

Both belong in an isolated `convex/agents/` module that calls the Anthropic API / Convex Agent component, gated behind an explicit feature flag + spend cap. **Not built in v1** — but the data model (`kickoffPrompt`, `meta`, `ingest`) is shaped so it slots in without rework.

## Draftable kickoff prompts (hand to the user / wire to buttons)
- **Execute a task:** "You are Helm's executor. Task {id}: {title}. Context: {contextLine}. Source: {sourceRef.url}. Do it end-to-end; show me anything irreversible before acting; when done call `logCompletion`."
- **Query:** "You are Helm. Via the helm MCP, read my open tasks and answer: {question}. Lead with anything overdue or waiting-on-others; group by area."
- **Morning sweep:** "Run the Helm sweep: pull new email/Slack/calendar/Granola since the watermark, propose tasks (`needsReview`), then DM me a one-line 'N new — keep?'."
- **Evening reconcile:** "Build today's Helm reconcile: `dayLog` planned + adhoc; write the `checkin`; DM me 'here's everything you did today' + the 2 that carried."

## Verdict
Server-side AI is **not needed now**; it's **designed-for-later** as an isolated module. The immediate "kick off Claude on todos / query todos" need is fully met by stored kickoff prompts + client execution.
