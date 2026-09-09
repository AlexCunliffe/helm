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

### Slice 4 result

Completed. TypeScript and the development push pass. All 182 regression checks pass. Both palettes seeded the empty-store transaction correctly; a repeated seed preserved the labels and palette. The transaction rolled back, preserving existing area IDs and values. CLI help, dry-run, and a normal repeat all ran successfully. Existing area sets are left unchanged. Duplicate keys and invalid colors are rejected.

## Stage 3 · Slice 5 plan: settings panel

Goal: edit every settings section and manage areas from the web interface. Apply time changes live. Keep credential changes in the terminal.

Files: web interface, embedded page, nullable cap patches, area validation, and regression fixtures.

Checks: edit workday in the panel; observe geometry without reload; edit timezone through MCP and reopen the panel; save and clear a cap; add, rename, recolor, and retire an area; preserve in-progress form edits; reject invalid area data; inspect desktop and mobile layouts; run the full development regression.

The plan conflicts on key rotation: it limits secrets to CLI changes while requesting a browser rotation action. A clarification was requested. The conservative implementation shows the exact CLI command from the panel and does not grant the browser deployment-admin access.

Done criteria: the settings and area forms persist through their validated APIs and the interface follows the live settings.

### Slice 5 result

Completed with the CLI rotation interpretation described above. All 187 development checks pass. MCP settings checks pass. A real browser verified live workday saves, timezone changes through MCP, cap save/reset, and area add/rename/recolor/retire. Unsaved input survives unrelated settings pushes. The stored key is never shown in the panel. Desktop and mobile screenshots were inspected; the mobile panel has no horizontal overflow.

The browser test caught a save-completion race in the area editor. Form inputs now wait for the save to finish before accepting another edit. The rerun passed with no page errors. Area creation rejects an existing key atomically. Retiring the configured default falls back to another active area. Area reads and writes enforce a 100-area bound.

## Stage 3 · Slice 6 plan: closed authentication

Goal: require the API key by default. Permit anonymous development only through an explicit opt-out that warns on every call.

Files: authentication helper, MCP warning text, development test plumbing, and exhaustive auth checks.

Checks: enumerate every public function from development metadata; supply valid argument shapes; reject missing and wrong keys; remove key-related environment values and verify every public function returns unauthorized; keep the page public and data routes closed; verify repeated opt-out warnings; restore all credentials in memory; run the full regression.

Done criteria: an unconfigured installation cannot read or mutate task data through public functions.

### Slice 6 result

Completed. TypeScript and the development push pass. All 187 regression checks pass. Every one of the 42 public functions rejects missing and incorrect keys. Every one also returns unauthorized with no configured API key. The open page and closed HTTP data routes behave as intended. Two opt-out calls produced two warnings. Credentials and normal access were restored successfully.

The focused restoration test also passed after moving secret values from process arguments to stdin. Regression commands now verify their development target and ignore inherited deployment selectors. Error output redacts fetched secrets. HTTP rejection tests use a dummy query token instead of putting a real token in a URL.

## Stage 3 · Slice 7 plan: key minting and rotation

Goal: mint independent strong credentials and rotate the development API key and surface token from the terminal.

Files: secret helper, rotation command, package script, and CLI integration test.

Checks: dry-run preserves values; minted values are distinct 48-character hex strings; rotation sets and reads them through stdin and memory; new keys work and old keys fail; command output contains neither old nor new keys; full development regression after rotation.

Done criteria: rotation succeeds on development, explains which clients to update, and prints no secret.

### Slice 7 result

Completed. The rotation integration test passed: dry-run preserved both credentials; new values were distinct 48-character hex strings; set/read verification used stdin and memory; new credentials worked; old credentials were rejected; neither old nor new credentials appeared in output. All 187 development regressions passed after rotation.

The command rotates both the function API key and the HTTP surface token. It identifies the clients to update and gives local retrieval commands without printing a value. A failed verification attempts to restore each previous credential.

## Stage 3 · Slice 8 plan: bundled browser client

Goal: serve the browser client within the page, with no external script request.

Files: embed script, local build dependency, page import, HTTP security headers, third-party notices, and regression checks.

Checks: bundle has no external imports; served HTML has no script URL; a real browser unlocks, subscribes, and saves settings using only its deployment hosts; inspect CSP and network requests; run the full development regression.

Done criteria: loading and using the page requires only the Helm site and its matching Convex client endpoint.

### Slice 8 result

Completed. The local bundle has no external imports. Upstream licenses for Convex and its bundled helpers are included in `THIRD_PARTY_NOTICES.md` and in the served script. TypeScript and the development push pass. All 188 regression checks pass.

A real browser unlocked the bundled page, opened its live subscription, and saved settings. Every observed request used the Helm site or its matching Convex client host. No page errors occurred. The CSP blocks other network destinations and external scripts. The root dependency audit remains clear.

## Stage 3 · Slice 9 plan: optional session hook

Goal: read hook preferences before reading session content. Log nothing by default. Include a directory only when explicitly enabled.

Files: session-end hook, isolated HTTP fixtures, and development hook tests.

Checks: default-off behavior; enabled logging; configured title length; directory opt-in; malformed input; missing session ID; invalid transcript path; network failures; silence and bounded shutdown; real development capture and fixture cleanup.

Done criteria: default settings cause no session content to leave the hook, and enabled logging follows the configured limits.

### Slice 9 result

Completed. All 188 backend regressions pass, followed by the hook fixture and live development suites. Defaults produce no completion and send no session content. Enabled logging respects the configured title length, directory opt-in, provisional status, and session dedupe.

Malformed or oversized input, missing IDs, invalid files, missing keys, explicit opt-out, server errors, and stalled responses all remain silent. The hook reads at most a bounded transcript head and rejects non-regular files. Test transcripts and development task fixtures were removed. No global hook was installed.

## Stage 3 · Slice 10 plan: setup wizard

Goal: configure owner, context, time, areas, sources, and security through six explicit steps. Support dry-run and repeatable non-secret answer files.

Files: setup CLI, prompt helper, admin-only snapshot/validation queries, area application helper, and wizard tests.

Checks: six step summaries and confirmations; dry-run leaves data, credentials, and files unchanged; saved answers apply end to end; re-run preserves keys and row IDs; invalid answers fail before writes; no secret output or secret file; full development regression with non-default area names.

Because authentication is now closed, the wizard collects approvals before applying changes. It creates missing credentials first, then applies the approved data. This keeps the six user-facing steps while allowing the first installation to authenticate. Existing credentials remain unchanged on a re-run.

Done criteria: the approved configuration is applied and verified without exposing secrets or modifying user-global files.

### Slice 10 result

Completed. The development push and TypeScript check pass. Wizard acceptance passed twice. All six approvals can be declined without changes. Approving only the owner step preserves the declined sections. Dry-run preserves configuration, credentials, and local files. Invalid settings and secret-shaped answer fields fail before writes or disclosure.

The wizard created missing API and surface credentials, applied a custom configuration, and preserved credentials and area IDs on a re-run. The full regression and hook suites passed with custom area names. Test configuration and credentials were restored. No user-global files were changed.

## Stage 3 · Slice 11 plan: Claude installer

Goal: install and remove Claude integration through per-file previews, confirmations, and backups. Keep all acceptance runs inside a scratch home directory.

Files: install and uninstall commands, shared file-safety and manifest helpers, namespaced skill copies, ambient-capture template, and scratch-home acceptance tests.

Checks: show every proposed global write; decline without writes; dry-run and check preserve all files; register MCP through the Claude CLI in an isolated staging home; preserve unrelated configuration; skip disabled hooks; retain backups; detect drift; refuse to overwrite later user edits on uninstall; restore the original files; redact credentials in all output.

Done criteria: a scratch installation works and uninstall restores the prior configuration. The installer makes no deployment changes; the approved setup wizard owns that tier.

### Slice 11 result

Completed. All installer acceptance checks pass in scratch homes. The actual Claude CLI registered a staged MCP entry. The installed server answered settings and brief calls. Every global file had a preview and approval. Declining all changes preserved the files. Dry-run and check made no writes. Re-runs were idempotent. The disabled hook file stayed untouched. The enabled hook preserved unrelated hooks. Backups and private file modes were verified.

Uninstall restored the original bytes and removed files created by Helm. A later user edit was preserved and reported for manual reconciliation. Symbolic-link paths were rejected before any installation write. A custom Claude config directory also passed. API keys and existing secret values were absent from output. Installation records contain recovery paths and hashes, not key values. The full backend regression passed all 188 checks, followed by the hook suites.

The CLI registration runs inside an isolated temporary home because the CLI also initializes preference metadata. Only the approved MCP entry is merged into the selected configuration. No real user-global files were opened or installed during acceptance. Backups remain after uninstall. Files edited outside the installer require manual reconciliation before a later update.

## Stage 3 · Slice 12 plan: security documentation

Goal: document the actual trust boundary, credential storage, logging exposure, hook content, dependency boundary, and development rotation procedure.

Files: docs/security.md and SECURITY.md.

Checks: compare each claim with auth, HTTP, browser, MCP, hook, AI, installer, and rotation code; run the documented non-mutating rotation command; preserve the distinction between API and surface credentials.

Done criteria: the threat model states what each credential can do and identifies its stored copies without promising stronger isolation than the code provides.

### Slice 12 result

Completed. The security model was checked against the implementation. It describes API and surface permissions, function-argument logging, browser storage, plaintext Claude configuration and backups, hook content, AI data flow, and key rotation. The documented rotation preview passed without changes. The approved rotation command was exercised in slice 7.

The review exposed an HTTP boundary to tighten: the surface token currently accepts a review flag and shares capture dedupe keys with other sources. This is documented honestly and will be restricted before independent QC. The MCP dependency audit also reports five affected transitive packages with compatible fixes available.

## Stage 3 · Follow-up plan: restrict HTTP ingest

Goal: let the surface token create or refresh unreviewed ingest proposals only. Prevent it from modifying accepted tasks or another source's tasks.

Files: HTTP route, internal ingest mutation, regression fixtures, and security documentation.

Checks: reject malformed and oversized input; force proposal status and source; namespace external dedupe keys; repeat a proposal without duplication; preserve accepted and unrelated tasks; retain existing authentication tests; deploy and run the full development regression.

Done criteria: the surface token retains brief access and bounded proposal submission without broader task-edit authority.

### HTTP ingest result

Completed. The development push and TypeScript check pass. All 199 regression checks pass, followed by both hook suites. The surface token cannot select task status, bypass review, reuse another source's dedupe key, alter an accepted task, or follow a merge into another task. Repeating an unreviewed inbox proposal remains idempotent. Invalid field shapes, unsafe source URLs, and oversized bodies are rejected. Both fixture namespaces are purged after testing.

The internal proposal mutation uses a bounded indexed lookup. HTTP ingest accepts a 32 KiB body, validates its selected fields, and never forwards unrestricted task-write arguments. Security documentation now describes this narrower boundary.

## Stage 3 · Follow-up plan: MCP dependency advisories

Goal: remove the five known transitive dependency advisories through compatible package updates.

Files: MCP lockfile and any necessary dependency metadata.

Checks: inspect the exact package changes; keep application dependencies stable where possible; run the MCP stdio contract, scratch installer acceptance, and full development regression; repeat the dependency audit.

Done criteria: the audit reports no known vulnerabilities and the installed MCP contract still works.

The compatible dependency update changed exactly five packages and cleared the audit. MCP and scratch installer acceptance passed. The full regression exposed a pre-existing cron race: meeting prep can be promoted by the minute cron before the manual promotion call. The test now checks the correct resulting task state and a valid promotion count, rather than requiring the manual call to win the race. The separate one-time promotion assertion remains.

### MCP dependency result

Completed. Exactly five transitive packages changed: the Hono Node adapter, fast-uri, Hono, ip-address, and qs. Direct dependency versions stayed unchanged. The MCP audit now reports zero known vulnerabilities. Real stdio MCP checks and scratch-home installer acceptance pass. After fixing the observed test race, all 199 backend checks and both hook suites pass.

## Stage 3 result

All twelve planned build slices and the two security follow-ups are complete. The stage was logged through Helm MCP on development. Live AI checks still require the owner's optional Anthropic key; missing-key behavior passes. No production deployment or real user-global configuration was changed. The repository remains private. Generic repository topics are configured.

## Stage 4 plan: documentation and privacy reread

Goal: provide a complete installation path, a settings reference, source examples, development-to-production instructions, and accurate design documents.

Files: README.md; docs/install.md, configure.md, sources.md, deploy.md; a wizard preview; design documents 01 through 12; supporting non-secret examples.

Checks: read all design documents for meaning and privacy; compare paths, fields, functions, and defaults with code; run documented development and scratch-home commands; inspect the wizard preview; verify links; run the external denylist.

Production and real global installation commands are documentation-only until the deployment owner approves them. This preserves the explicit production and global-configuration gates. Record those exceptions instead of executing forbidden commands to satisfy a documentation check.

### Stage 4 result

Completed. README now contains the six-line quickstart and points to the full installation path. The configuration guide covers every settings field and area rules. Source documentation includes validated email and calendar examples. Production instructions distinguish project selection, deployment, fresh credentials, data configuration, and client migration.

All design documents 01 through 12 were read for privacy and meaning. Outdated query-string tokens, planned-only descriptions of implemented features, automatic-send examples, and assumptions about a particular vault were removed. The schema reference now includes meetings, settings, completion timing, review, and relationship fields. Two screenshots show real wizard dry-run output with generic answers and the deployment identifier hidden. Both were visually inspected.

The documented clone, dependency installs, development push and reconfiguration, interactive wizard, saved-answer flow, seed, credential read, and embed commands were exercised. Installation, drift checks, and uninstall were exercised through their documented npm commands in a scratch home. All local Markdown links resolve. Source JSON examples pass deployment validation. Development settings and areas were restored after these checks. Production commands remain deliberately unexecuted under the owner's gate. Actual conversational Claude execution still depends on an authenticated client; the registered MCP brief call passed.

## Stage 5 plan: independent quality review

Goal: review the committed codebase with fresh reviewers in seven dimensions. Verify every finding independently. Apply the installed code-review and security-review procedures to the diff since the initial import.

Checks: security and auth; Convex correctness; data model; MCP, skills, and hook contracts; installation; privacy including history; documentation accuracy. Every finding must cite a file and line. Reviewers report findings without fixing them. Production commands and real user-global writes remain prohibited. Destructive or configuration-changing command checks use the approved development deployment and scratch homes only.

Done criteria: publish the verified finding table, fix every confirmed or plausible major and minor issue, rerun affected tests, and repeat any dimension with a major finding until none remains.

## QC repair 1 plan: preserve development check-ins

Finding: ROOT-02. Replace date-wide fixture cleanup with exact owned-row snapshots. Use a unique task namespace for each run. Select dates only after checking that they contain no check-ins or completions. Refuse cleanup if a recorded check-in changed. Remove the auth suite's unnecessary date deletion.

Validation: deploy to the selected development deployment, run the full regression and hook suites, and verify that date-wide and stale-snapshot cleanup both fail without deleting their fixtures. No production or global configuration changes.

The independent repair verifier found an ownership race in the first draft. The final design tags fixture-owned check-ins, rejects attempts to adopt an existing user row, clears ownership on normal edits, and requires matching ownership plus a full snapshot for cleanup. Fixture reconciliation also rejects unrelated completions. The same preservation group fixes CODE-001: restoration explicitly clears every cap introduced by the test before restoring the saved overrides in one mutation.

QC repair 1 complete (ROOT-02 and CODE-001): regression-owned check-ins cannot adopt user records, normal edits revoke fixture ownership, cleanup rejects changed snapshots, and test-added caps are cleared during restoration. The exact UUID-scoped hook fixture namespace is accepted by cleanup. The one failed synthetic hook fixture and its scratch directory were removed after that compatibility check.

Validation: independent verifier passed 16 ownership/race/restoration assertions; TypeScript passed; development push passed; full suite passed 204 assertions and both hook suites, including cleanup. The full baseline QC ledger is in [docs/qc/2026-09-09-review.md](docs/qc/2026-09-09-review.md). Remaining confirmed findings stay open there.

## QC repair 2 plan: bind OAuth callbacks and protect credentials

Findings: SEC-01 and SEC-02. Restrict the optional calendar helper to the selected cloud development deployment. Bind its listener to loopback. Validate per-run state and PKCE. Reject unrelated callbacks without consuming the valid flow. Store the refresh token through CLI stdin. Redact every exchange and storage failure. Report success only after verified storage.

Validation: isolated success, invalid-state, replay, PKCE, provider failure, missing-refresh-token, and storage failure fixtures. Run the helper's help command and the full development suite. No live Google account or production deployment is involved.

QC repair 2 complete (SEC-01 and SEC-02): the optional calendar authorization helper now uses loopback, per-run state, PKCE, one-use callbacks, safe credential storage, and redacted failures. Existing secret-setting behavior is preserved.

Validation: helper help command passed; isolated OAuth fixtures passed; an independent verifier passed 32 additional callback, replay, storage, and failure checks; the full development suite passed 204 backend assertions, both hook suites, and OAuth fixtures. No live Google account connection was made.

## QC repair 3 plan: align validation and public errors

Findings: MODEL-01, MODEL-02, MODEL-03, and CVX-08. Make MCP capture advertise only forward statuses. Validate enabled source server names in the shared settings validator. Reject impossible check-in dates before any write or status transition. Use safe ConvexError data for intentional application failures.

Validation: type-check and push development functions; test invalid dates and source entries; inspect the actual MCP tool schema; verify typed application errors; run the full development and MCP suites.

QC repair 3 complete: capture statuses, enabled-source validation, valid calendar dates, and safe expected errors are aligned across entry points. Independent verification passed 32 validation cases and 16 preservation cases. TypeScript, development push, all 210 backend assertions, hook/OAuth suites, and real stdio MCP tests passed.

## QC repair 4 plan: preserve configured area order

Finding: INST-01. Present current areas in display order. Retain their saved order values. Append new areas after the largest retained order. Reject additions beyond the supported order range before any write.

Validation: exercise the actual interactive wizard with isolated prompts, both preset and custom orders, unchanged and appended areas, and dry-run preservation. Run the real development wizard without changing its values. Run the full development suite.

QC repair 4 complete: unchanged interactive setup preserves all saved area orders and the default category. New areas append after the largest retained order, with a safe bound check. Eight bundled and 19 independent isolated scenarios passed. The live 43-prompt wizard preserved exact settings and area values. All 210 backend assertions and hook/OAuth suites passed.

## QC repair 5 plan: make rolling calendar capture complete and repeatable

Finding: CONTRACT-01. Read the complete current/next-date event window without intersecting update watermarks. Use stable occurrence and action identities. Add an atomic capture option that preserves completed tasks during repeated window reads. Keep default reactivation semantics for other sources. Update both skill variants, source presets, and API documentation.

Validation: verify the real MCP schema and completed/dropped/merged capture behavior; exercise an unchanged old booking entering the calendar window; compare scheduled and interactive instructions; run TypeScript, development push, and full backend/MCP suites.

QC repair 5 complete: calendar prep reads the full rolling window independently of update watermarks, uses stable occurrence identities, and atomically preserves completed work on repeated reads. Default capture reactivation remains available for other sources. Both skill variants and references match.

Validation: TypeScript and development push passed; 214 backend assertions, hook/OAuth suites, and real stdio MCP tests passed. Independent verification passed 15 actual-handler, nine stdio-to-mocked-handler, and ten procedural calendar scenarios. The latter verify the written procedure with fixtures; they are not a native conversational sweep run.

## QC repair 6 plan: keep Now actionable and promote imminent prep

Findings: CVX-01, CVX-05, and CVX-07. Filter explicit choices by actionable status. Remove deliberate demotions from the current order. Prepend newly promoted meeting prep in meeting-start order, with a bounded maintained head. Clear waiting timestamps when chooseToday or prep leaves waiting. Add an index for one check-in kind on one date.

Validation: development checks for choice-to-waiting/someday transitions, renewed waiting clocks, prep ahead of existing choices, and deliberate demotion after promotion. Independently verify full-cap behavior and the one-time promotion stamp. Run TypeScript, development push, and the full regression suite.

QC repair 6 complete: waiting and someday choices cannot lead Now; deliberate non-today transitions remove their explicit priority; choose/prep clears stale waiting clocks. Meeting prep leads ordinary choices and retains chronological priority across later cron passes. Deliberate demotions, completions, snoozes, and removal from the order are respected.

An independent verifier found and reproduced the cross-pass ordering edge in the first draft. The corrected implementation passed all 29 independent scenarios. TypeScript, the development push, 220 backend assertions, and hook/OAuth suites passed after the correction. The order helper uses a Convex-compatible module filename.
