# Helm

> Reference implementation, maintained on the author's own schedule.

Helm is a personal task and accountability system. It captures commitments, shows the next action, and records completed work. Claude Code, an MCP server, and a Convex web interface share your own task store.

## The three doors

- **Capture:** record an intent with little manual input.
- **Surface:** show the next action in a short brief.
- **Resume:** keep the source link and current context with the task.

```text
Claude Code + skills ── MCP ──┐
Optional session hook ────────┼── Your Convex project ── linked knowledge vault
Web interface ───────────────┤
Token HTTP clients ──────────┘
```

## Quickstart

Use Node.js 20 or later, a Convex account, and an authenticated Claude Code installation. Use macOS, Linux, or WSL. Each installation creates its own Convex project. When `npx convex dev --once` asks, select a new project and a cloud development deployment.

```sh
git clone https://github.com/AlexCunliffe/helm.git helm-oss
cd helm-oss
npm install
npm install --prefix mcp
npx convex dev --once
npm run setup
```

Follow [the installation guide](docs/install.md) to approve the Claude integration, run the checks, and open `/brief`. The guide also covers browser access and uninstall.

Read [configuration](docs/configure.md), [capture sources](docs/sources.md), [security](docs/security.md), and [deployment](docs/deploy.md). See [PROGRESS.md](PROGRESS.md) for observed checks and remaining release gates. Server-side AI is optional and requires your own Anthropic API key.

## Licence and support

MIT. Copyright (c) 2026 Alex Cunliffe. There is no support commitment or promised roadmap. Pull requests are welcome and may wait for review.
