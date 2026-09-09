# 06 · Surfaces

The glass is the implemented web interface. Convex serves it at `/glass`. It subscribes to the same brain used by MCP and permits task edits with the API key. Settings changes update the workday geometry and display limits. The browser clock uses the configured timezone.

The page presents a current task, a day thread, waiting and upcoming work, recent captures, and completion history. Focus, snooze, completion, merge, connection, and delegation controls write through validated backend functions. The Settings panel edits preferences and areas. Its rotation action shows a terminal command.

Read-only widgets can consume `GET /brief` with the surface token. A phone widget, desk screen, Slack delivery, or another client is a separate integration; none is installed by this repository. External delivery requires the owner's authorization and scheduling setup.

## Add a surface

1. Choose the minimum API access the surface needs.
2. Read the existing brief or another supported query.
3. Render the result.
4. Keep the credential out of URLs.

A read-only surface should use the HTTP brief. The surface token also permits bounded ingest proposals, so it must still be protected. An editing client requires the more powerful API key. Read [security](security.md).

The interface preserves source links and short re-entry context. Deferral is an ordinary choice. Completed unplanned work belongs in the daily record alongside planned work.
