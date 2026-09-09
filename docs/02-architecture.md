# 02 · Architecture

| Layer | Implementation | Role |
| --- | --- | --- |
| Brain | A dedicated Convex project per installation | Tasks, areas, settings, meetings, check-ins, and watermarks |
| Conversational client | Claude Code with the Helm stdio MCP server | Capture, brief, execution assistance, and reconcile |
| Web interface | The bundled glass at `/glass` | Reactive reads and authenticated task/settings edits |
| Optional session hook | A local Node process | Provisional completion logging when enabled |
| HTTP clients | Widgets and structured webhook clients | Brief reads and bounded ingest proposals with a surface token |
| Knowledge store | A separate markdown vault | Durable knowledge linked through relative references |

Claude Code and the glass use the function API key. HTTP clients use the separate surface token. The Convex account remains the deployment-administration authority. Read [security](security.md).

Capture and completion records share the tasks table. `origin: planned` identifies forward work. `origin: adhoc` identifies work recorded after it happened. Reactive queries serve the glass. Client-driven skills provide conversational briefs and source sweeps.

Backend crons wake snoozed tasks, promote linked meeting preparation, and optionally mirror Google Calendar. They do not schedule the source sweep. Scheduled-task templates must be activated separately in Claude Code.

Slack delivery, dedicated phone widgets, desk screens, and other clients are extension points. This repository does not install them or send messages to them. A new client can consume the existing API without changing the data model.

Tasks need structured live state. Knowledge needs portable, curated documents. Keep these stores separate and linked. See [the knowledge boundary](08-second-brain-bridge.md).
