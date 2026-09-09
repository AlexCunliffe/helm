# 02 · Architecture

## Components
| Layer | Tech | Role |
|---|---|---|
| **Brain** | Convex (dedicated project) | Source of truth for operational state: tasks, projects, check-ins. Reactive; serves every surface. Use a dedicated deployment for task data. |
| **Cockpit** | Claude Code | Capture, brief, **execute**, and auto-log completions. The conversational interface. Talks to the brain via the Helm MCP server. |
| **Ambient teammate** | Claude Tag (Slack) | Continuous channel watcher: chases forgotten threads/tasks, captures and marks-done in Slack, posts brief/reconcile. Connected to the brain via MCP (admin-granted write tools). |
| **Surfaces** | Slack · iPhone widget · desk screen · (web pane) | Read-mostly faces. Read via the stable read API / token-guarded HTTP. |
| **Knowledge** | markdown second-brains | Separate store, linked. See `docs/08`. |

## Data flow
- **In (capture):** Claude Code, Claude Tag, and the intraday sweep all call `capture` / `logCompletion`. Every item lands in `tasks` tagged `origin: planned | adhoc`.
- **Out (surfacing):** all surfaces call the read API (`brief`, `todaysPick`, `dayLog`) or the token HTTP endpoint. The brain pushes nothing itself; Tag + scheduled routines do the pushing.

## Connection model
- **MCP** for the AI actors (Claude Code, Tag) — rich read + write tools.
- **Token-guarded HTTP (`httpAction`)** for dumb surfaces (widget, desk screen) — read-only JSON, no MCP needed.
- The split is deliberate: AI gets tools; glass gets a URL.

## Why Convex (not the markdown vault) for tasks
Tasks need reactivity, queries, watermarks, streaks, and to feed widgets/Tag in real time — structured live state. Knowledge needs portability and human-readable history — markdown. Two stores, each right for its job, linked (`docs/08`).
