# 07 · AI integration

Claude Code provides conversational reasoning, capture interpretation, source sweeps, and execution assistance. The backend stores task state and supports a small set of optional AI transformations. There is no autonomous backend task executor.

## Stored execution context

`kickoffPrompt` is a ready-to-use instruction stored with a task. Reading or copying it does not call an LLM. A client can use it to resume work with the source reference and context line.

Example:

> Read the sample invoice. Draft the adjustment. Show the draft before posting. After approval, record the completion.

A task prompt does not authorize a send or another irreversible action. Obtain the owner's authorization before crossing that boundary.

## Server-side actions

| Action | Purpose |
| --- | --- |
| `ai:enrichCapture` | Suggest a valid area, size, context, and kickoff prompt |
| `ai:polishNote` | Turn rough work notes into concise re-entry context |
| `ai:parseSearch` | Convert a natural-language request into supported search filters |
| `ai:draftFollowUp` | Suggest the next task after completed work |

These actions use `ANTHROPIC_API_KEY` from the deployment environment. They fail closed when it is absent. Core task storage, queries, settings, MCP, and the glass still work. Relevant task text and configured owner context can be sent to Anthropic. Read [security](security.md).

The regression suite checks missing-key behavior. With a configured key, it also runs live AI assertions. Live calls use the deployment owner's API account.

## Client-driven routines

The four skills begin by reading settings. Sweeps use only enabled sources and their named connectors. Incremental sources use update watermarks. Calendar prep reads the complete current/next-date window and preserves completed prep; its saved run-start watermark is diagnostic. Reconcile records the day's planned and unplanned completions. Neither routine sends an external message or writes a knowledge file without authorization.

Scheduled-task templates are copies of the interactive procedures. Installing them does not activate a schedule. Their model use belongs to the user's Claude session or plan. The backend's minute and calendar crons do not invoke these source sweeps.

## Future extensions

An autonomous executor or raw-message AI webhook parser would need its own permission and spending controls. Those capabilities are not implemented. Keep optional transformations separate from the task write API.
