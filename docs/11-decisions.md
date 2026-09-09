# 11 · Decisions

- **D1 · Client platform.** Claude Code is the conversational interface. A Team plan may provide additional collaboration features.
- **D2 · Dedicated storage.** Use a dedicated Convex project for task state.
- **D3 · Planned and unplanned work.** Keep both in the tasks table. Use `origin` to distinguish them.
- **D4 · Knowledge boundary.** Propose vault writes for confirmation. Keep operational task state in Convex.
- **D5 · Incremental capture.** Bound each source sweep with a watermark.
- **D6 · AI at the edges.** Use the conversational client for orchestration. Optional server actions handle small, bounded transformations.
- **D7 · Categories as data.** Store areas in a table. Keep developer enums additive.
- **D8 · Linked stores.** Use relative vault references to connect tasks and knowledge.
- **D9 · Name.** The project is named Helm.
- **D10 · Hosting.** Convex serves the web interface at `/glass`. Embed the page before a development push.
- **D11 · Delegation.** Move selected tasks to waiting. Create one task to prepare the handover.
- **D12 · Calendar.** Optional Google Calendar sync maintains a rolling meeting window. Optional AI actions use a separately configured key.
- **D13 · Surface token.** HTTP clients use a header token. The token currently permits brief reads and capture proposals.
- **D14 · Effort.** Use `size` for effort. Use `startedAt` for the start time.
- **D15 · Function authentication.** The single-user implementation uses an API key argument. The gate is closed by default. `HELM_ALLOW_ANON=1` permits anonymous access and warns on every call. The old `HELM_REQUIRE_KEY` flag has no effect.
- **D16 · Browser client.** The imported page uses a pinned browser-client import. Bundling it into the page is pending.
- **D17 · Merge safety.** Follow `mergedInto` pointers during dedupe lookup. Preserve source keys and merge provenance.

- **D18 · Configuration.** Store owner, time, source, cap, and hook preferences in one validated settings document. The panel and MCP update the same document. Area reads are bounded to 100 rows.
- **D19 · Secret changes.** Keep deployment environment changes in the terminal. The settings panel shows the key-rotation command and only the existing key's last four characters. It holds no deployment-admin credential.
