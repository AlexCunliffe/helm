# Helm

> Reference implementation, maintained on the author's own schedule.

Helm is a personal task and accountability system. It captures commitments, shows the next action, and records completed work. Claude Code, an MCP server, and a Convex web interface share one task store.

## The three doors

- **Capture:** record an intent with little manual input.
- **Surface:** show the next action in a short brief.
- **Resume:** carry a source link and current context with each task.

```text
Claude Code + skills ── MCP ──┐
Optional session hook ────────┼── Convex task store ── linked knowledge vault
Web interface ───────────────┤
Token HTTP clients ──────────┘
```

## Quickstart

The installation tools are under development. The target flow is:

1. Install Node.js 20 or later.
2. Clone this repository.
3. Install the repository and MCP dependencies.
4. Create a new Convex development project.
5. Configure Helm and install its Claude Code integration.
6. Run the tests before opening a brief.

The completed procedure will be in [docs/install.md](docs/install.md). Current implementation status is in [PROGRESS.md](PROGRESS.md).

## Licence and support

MIT. Copyright (c) 2026 Alex Cunliffe. There is no support commitment or promised roadmap. Pull requests are welcome and may wait for review.
