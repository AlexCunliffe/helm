# 10 · Implementation status

Helm is a reference implementation. Maintenance follows the author's own schedule. There is no promised roadmap.

Implemented capabilities include task capture and completion, daily briefs and check-ins, watermarks, merge and connection, delegation, an optional session hook, a stdio MCP server, and a reactive web interface. Optional server-side AI actions and a Google Calendar mirror require separate credentials.

Configuration includes owner context, timezone and workday, display limits, sources, hook preferences, and editable areas. Setup and Claude installation support previews and repeatable configuration. The installer uses per-file approvals and backups. Uninstall preserves later edits.

Independent review and fresh-clone acceptance are release gates. Read [PROGRESS.md](../PROGRESS.md) for their current evidence and any remaining work. Do not infer that a gate passed from the presence of this document.

Future surfaces, automatic duplicate suggestions, autonomous execution, and deeper vault integration are extension points, not delivery commitments. Follow the loop in [CLAUDE.md](../CLAUDE.md) for changes. Test changes against a development deployment.
