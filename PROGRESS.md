# Progress

## Stage 1 · Clean import

Goal: create a standalone import with generic examples and a fresh history.

Files: backend, MCP server, hook, web interface, scripts, four skills, design documents 01–12, and project metadata.

Checks: source allowlist; privacy denylist outside this repository; JavaScript syntax; regenerated page; no inherited history or local credentials.

Done criteria: all import checks pass and the initial commit contains only public-safe files.

Status: local import checks passed. The external denylist reports zero hits in 54 tracked files. All script and browser-module syntax checks passed. The privacy gate passed clean, mixed-case hit, invalid-pattern, and empty-denylist checks. The page was regenerated from the scrubbed HTML.

The remote repository and fresh development baseline are pending. Only the initial import is ready to commit; runtime baseline verification belongs to Stage 2.

## Stage 2 · Development baseline plan

Goal: establish a new, empty development project before feature changes.

Checks: dependency installation; a development-only Convex push; separate random API and surface credentials; generic area seed; full regression harness.

Done criteria: the harness passes on the new development deployment. Optional live AI checks remain pending until an API key is configured.

The current import retains legacy behaviour. Configuration, closed authentication defaults, setup tools, independent review, and fresh-clone acceptance remain to be built and tested. This is not a release-ready tree.
