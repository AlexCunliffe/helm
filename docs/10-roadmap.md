# 10 · Implementation status

Helm is a reference implementation. Maintenance follows the author's own schedule. There is no promised roadmap.

The imported implementation includes task capture, completion logging, daily briefs, check-ins, watermarks, a session hook, an MCP server, and a web interface. It also includes merge, connect, delegation, optional calendar sync, and optional AI actions.

Configuration and installation work is in progress. See [PROGRESS.md](../PROGRESS.md) for observed checks and current work.

## Build order

1. Add settings and connect the consumers.
2. Add configuration tools and generic skills.
3. Add area seeding and a settings panel.
4. Close authentication by default.
5. Add key rotation and a bundled browser client.
6. Add an opt-in session hook.
7. Add setup and installation tools.
8. Complete the documentation.
9. Complete independent review.
10. Test installation from a fresh clone.

Run the loop in [CLAUDE.md](../CLAUDE.md) for each slice. Test each slice on a development deployment.
