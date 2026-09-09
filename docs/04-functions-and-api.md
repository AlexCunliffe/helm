# 04 · Functions and API

All public Convex functions require the API key by default. MCP forwards its configured key. Internal functions require deployment administration access and are not MCP tools. Read [security](security.md).

## Task operations

The MCP tools `capture` and `logCompletion` call `tasks:capture` and `tasks:logCompletion`. Capture defaults to an inbox task with planned origin. It resolves a supplied area key or the default active area. It does not infer size or generate AI text by itself. Log completion creates or completes an item with a completion timestamp.

Lifecycle tools include `markDone`, `snooze`, `wake`, `defer`, `setStatus`, `update`, and `confirmProposed`. Relationship tools include `merge`, `connect`, `disconnect`, and `delegate`. The glass also uses `tasks:start` to record work starting.

Full capture dedupe preserves user triage and refreshes re-entry context. Dropped work remains suppressed. Completed work can lead to a new task by default. Pass `reopenCompleted: false` with a dedupe key to keep completed work closed during rolling calendar reads. This check and capture run in one transaction. Merge lookup follows the surviving task. Restricted HTTP ingest has a separate namespace and narrower update rules.

## Read operations

`brief` returns the configured daily selection, waiting section, small wins, ageing flags, upcoming work, meetings, and counts. `todaysPick` returns one current task. `dayLog` returns completed planned and unplanned work for a configured-zone date. `inbox`, `waiting`, `list`, and `get` support focused reads. The glass also uses `queries:newToday`.

The `listAreas` tool reads categories. `areas:seedAreas` and `areas:upsertArea` are authenticated backend mutations used by local setup and the glass; they are not MCP tools.

## Settings and check-ins

`getSettings` and `updateSettings` read and patch the validated settings document. `chooseToday`, `getCheckin`, `reconcileDay`, and `reconcileOutstanding` maintain the daily account. `getWatermark` and `advanceWatermark` maintain incremental source boundaries.

MCP tool argument schemas are defined in [mcp/helm-mcp.mjs](../mcp/helm-mcp.mjs). Convex argument and return validators remain the backend contract. Times are epoch milliseconds except explicit calendar dates and wall-clock settings.

## HTTP surfaces

| Route | Authentication | Behavior |
| --- | --- | --- |
| `GET /glass` | Page is public; data requires API key | Serve the bundled interface |
| `GET /brief` | `X-Helm-Token` | Return the brief as JSON |
| `POST /ingest` | `X-Helm-Token` | Create or refresh a bounded unreviewed inbox proposal |

Query-string tokens are rejected. Ingest is structured capture, not an AI parser. Its fields and dedupe rules are documented in [sources](sources.md).

## Optional AI

The glass can call `ai:enrichCapture`, `ai:polishNote`, `ai:parseSearch`, and `ai:draftFollowUp`. They require the API key and a configured server-side Anthropic key. Their outputs are suggestions or transformations; task writes remain explicit operations. See [AI integration](07-ai-integration.md).
