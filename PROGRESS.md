# Progress

## Stage 1 · Clean import

Goal: create a standalone import with generic examples and a fresh history.

Files: backend, MCP server, hook, web interface, scripts, four skills, design documents 01–12, and project metadata.

Checks: source allowlist; privacy denylist outside this repository; JavaScript syntax; regenerated page; no inherited history or local credentials.

Done criteria: all import checks pass and the initial commit contains only public-safe files.

Status: local import checks passed. The external denylist reports zero hits in 54 tracked files. All script and browser-module syntax checks passed. The privacy gate passed clean, mixed-case hit, invalid-pattern, and empty-denylist checks. The page was regenerated from the scrubbed HTML.

The initial import is commit `da79997`, pushed to the private personal repository. The remote owner and private visibility were checked before the push. Discussions are disabled. Issues are enabled.

Additional checks passed: syntax transformation of all 16 backend TypeScript files; exclusions for credentials, generated bindings, and historical documents; credential-pattern, home-path, email, and excluded-document-reference scans. Full type checking requires generated bindings from Stage 2.

GitHub returned HTTP 422 when asked to enable secret scanning: the feature is unavailable for this repository. Secret scanning and push protection are not verified as enabled. Recheck availability before public release.

The Helm completion tool was unavailable in the build session. No stage completion was written to an existing deployment.

## Stage 2 · Development baseline plan

Goal: establish a new, empty development project before feature changes.

Checks: dependency installation; a development-only Convex push; separate random API and surface credentials; generic area seed; full regression harness.

Done criteria: the harness passes on the new development deployment. Optional live AI checks remain pending until an API key is configured.

The current import retains legacy behaviour. Configuration, closed authentication defaults, setup tools, independent review, and fresh-clone acceptance remain to be built and tested. This is not a release-ready tree.


### Stage 2 checkpoint

- Dependencies are installed in the repository and `mcp/`. Package lifecycle scripts were disabled during installation.
- The root dependency audit reports zero known vulnerabilities.
- The MCP dependency audit reports five vulnerable transitive packages: two high and three moderate. Affected packages: `fast-uri`, `ip-address`, `@hono/node-server`, `hono`, and `qs`. Compatible fixes are available. Apply them in a separate tested slice after the imported baseline passes.
- Provisioning created an empty project in the CLI's only available team. Provisioning stopped before local environment configuration or an application push, pending confirmation of the intended team. Remove an unused empty project after team selection is resolved.
- No deployment credentials were minted. No areas were seeded. The regression harness has not run. No baseline or feature slice is claimed complete.

Next action: confirm the development team. Configure the new development project. Set separate random API and surface credentials. Seed the generic areas. Run the full baseline before feature changes.

The initial area seed requires an explicit `areas` argument. The copied API does not provide a no-argument default. Use `work`, `finance`, `people`, `admin`, `home`, and `personal` for the baseline. The seed script is a later slice.

### Remaining acceptance work

All twelve configuration, security, and installation slices remain pending. The final documentation set, independent dimensional reviews, review verification, fresh-clone installation test, and release handover remain pending. Production migration, real user-config installation, and public visibility remain controlled by the deployment owner.


## Stage 2 · Completed

The development team was approved. The isolated development baseline is live. Its identifiers remain only in ignored local configuration.

Observed checks: TypeScript compilation passed. The regression harness passed all 153 checks. HTTP authentication, function authentication, subscriptions, task operations, and fixture cleanup ran on the new deployment. AI actions passed their missing-key checks; live AI checks are pending a separately configured key.

The first baseline run reached 143 checks before an old `sales` fixture failed against the generic seed. Both follow-up fixtures now use `work`. No assertion was weakened. The rerun passed.

Independent 48-character API and surface credentials were generated, set, and compared in memory. No credential was printed or written to a tracked file. Local environment permissions are restricted to the owner.

Stage completions now use the copied MCP server, pointed exclusively at the isolated development deployment. Existing deployments remain untouched.

## Stage 3 · Slice 1 plan: settings document

Goal: provide one validated settings document with safe defaults and partial section updates.

Files: `convex/validators.ts`, `convex/lib/settings.ts`, `convex/settings.ts`, `convex/meta.ts`, and `scripts/regression.mjs`.

Checks: read defaults on an empty settings store; round-trip partial owner, time, caps, source, and hook updates; reject invalid settings and generic-meta bypasses; restore the prior settings; compile and run the full development harness.

Done criteria: the settings API passes these checks without changing consumers yet.

### Slice 1 result

Completed. Empty-store defaults were observed through the development CLI. TypeScript and the full regression harness passed (167 checks). Invalid timezone, time, weekdays, caps, source duplicates, context length, and hook limits are rejected. Generic metadata writes cannot bypass settings validation. Optional caps and evening-watch overrides can be removed. Prior settings are restored after fixtures.

## Stage 3 · Slice 2 plan: settings consumers

Goal: make backend day boundaries, prompt context, display caps, meeting preparation, and the web interface read settings at runtime.

Files: time helpers, settings helpers, queries, check-ins, tasks, meetings, AI actions, web interface, embedded page, and regression fixtures.

Checks: multiple timezone boundaries including daylight-saving transitions; non-default caps and workday; changed prompt context; live web updates; full development regression. Live AI assertions require a separately configured API key and remain an explicit gate until that key is available.

Done criteria: consumers follow configuration without a source edit or page reload.

### Slice 2 result

Completed for the available development credentials. TypeScript and all 176 regression checks pass. Calendar tests cover daylight-saving changes, a fractional offset, and a skipped date. Non-default caps and timezone affect the read API. A browser configured to a different timezone rendered the configured clock and workday. A live settings mutation changed the thread geometry without a reload. No browser errors occurred. Live AI checks remain pending the separately configured API key.

The self-review found two escaped prompt references that the original word-boundary scrub missed. They are removed. The external denylist now catches that form. The new import history will be corrected and checked before the next push.

## Stage 3 · Slice 3 plan: MCP and skills

Goal: expose settings through MCP and make all four skills use the configured owner, timezone, tone, and enabled sources.

Files: MCP server, four interactive skills, scheduled skill templates, and contract tests.

Checks: real MCP get/update calls on development; settings restoration; tool-schema contracts; enabled-calendar-only sweep with isolated connector fixtures when an AI key is available.

Done criteria: skills obtain settings first and only inspect enabled sources through their configured servers.

### Slice 3 result

Completed. All 176 development regression checks pass. Real stdio MCP tests cover settings schemas, partial updates, invalid fields, configured dates, capture, dedupe, and error redaction. Four skill frontmatters validate. Both scheduled procedures match their interactive counterparts.

An independent forward test ran the sweep against the real development Helm MCP and fixture connectors. It called settings first, read the enabled calendar, left the disabled mailbox untouched, captured one pending proposal, and advanced only the calendar watermark. The test restored settings and removed its task fixture. Connector-specific inbox and meeting-expansion rules now live in optional source notes.

## Stage 3 · Slice 4 plan: area seeding

Goal: seed generic areas into an empty deployment with one command. Offer an optional Helm classic preset and custom area input. Preserve existing areas on re-runs.

Files: seed CLI, area presets, backend seed guard, and development fixtures.

Checks: validate presets and custom input; test an empty-store seed and repeat inside a rollback-only development transaction; confirm existing IDs and labels survive; run CLI dry-run and normal repeat; run the full regression harness.

Done criteria: an empty store gets the chosen palette and a repeat never overwrites an existing set. The fresh-clone acceptance stage will exercise the same command before any areas exist.
