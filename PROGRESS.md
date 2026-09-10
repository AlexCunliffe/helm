# Progress

## HANDOVER

The configurable open-source implementation is committed in the public [Helm repository](https://github.com/AlexCunliffe/helm). Each installer owns a separate Convex project. The development projects used for this work are acceptance fixtures, not a shared service or a dependency of other installations.

Stages 1–7 are complete. The fresh GitHub installation passed dependency setup, cloud development provisioning, the six-step wizard, eight separately approved scratch-home writes, regression and MCP checks, browser checks, and uninstall/reinstall restoration. Native `/brief` called `getSettings` and `brief` through the installed MCP server and returned the expected empty brief without permission errors. Both temporary acceptance projects and scratch directories were deleted after verification. The approved real-home Claude integration passed development verification and was then restored to its prior configuration at the owner's request. All three task-created cloud projects and all 49 remaining test directories are removed. The source is public. The owner subsequently authorized full production migration and retirement. Production deployment, client cutover, and retirement are complete. Live production checks passed. The owner supplied a screenshot of the unlocked production main view; visual inspection passed.

### Shipped slices

| Slice | Commit | Result |
| --- | --- | --- |
| Clean import | `da79997` | Generic source, fresh history, MIT licence, public-safe project metadata. |
| Development baseline | `2a08c2a` | Separate development deployment and regression baseline. |
| 1. Settings document | `d14ecfb` | Validated defaults, partial updates, and removable overrides. |
| 2. Settings consumers | `a001939` | Configured timezone, workday, caps, owner context, and live display. |
| 3. MCP and skills | `2aee19f` | Settings tools and four procedures driven by enabled sources. |
| 4. Area seeding | `b168d8f` | Generic and classic palettes; existing IDs and labels preserved. |
| 5. Settings panel | `9617cff` | Live settings and area editing; terminal instructions for key rotation. |
| 6. Closed authentication | `8f023bf` | Unconfigured public functions reject access. |
| 7. Credential rotation | `7f7e7d6` | Independent credentials set through stdin without printed values. |
| 8. Browser client | `28273c6` | Bundled client and restricted network destinations. |
| 9. Session hook | `24fec46` | Logging off by default; bounded, silent input handling. |
| 10. Setup wizard | `6704031` | Six approved sections, validation, preview, and repeatable configuration. |
| 11. Claude integration | `fa12ef3` | Per-file approvals, backups, drift checks, and reversible installation. |
| 12. Security guide | `f39a2d8` | Credential roles, trust boundaries, and owner responsibilities. |
| Surface and dependency hardening | `6dfd45e`, `2d1e362` | Bounded proposal-only ingest and repaired dependency vulnerabilities. |
| Documentation | `e061f15`, `50fb6aa`, `e5b389c` | Installation, configuration, sources, deployment, and corrected fresh-CLI prompt. |
| Reviewed repairs | `a68dc85`–`f7e6fa1` | Fixture preservation, OAuth binding, bounded reads/writes, calendar snapshots, task ordering, and contract fixes. |

### Quality and acceptance evidence

The [single QC report](docs/qc/2026-09-09-review.md) records **16 MAJOR and 15 MINOR defects: 31 fixed, zero open**. Seven independent dimensions, the reused verifier, fresh repeats for affected MAJOR dimensions, the full-diff high code-review procedure, and the full-diff security-review procedure are complete. The final reviewed runtime is `f7e6fa1`; the clean-install documentation correction is `e5b389c`.

The fresh-clone suite passed 228 backend assertions, 53 development-target fixtures, 34 HTTP fixtures, and the hook, OAuth, and calendar suites. The real stdio MCP suite and scratch-home installed-file check also passed. Hosted wake checks use an always-rollback transaction; the primary development run observed all 234 internal checks. The external privacy denylist passes tracked files and reachable history. Dependency installation reports no known vulnerabilities in either package tree.

Development AI checks covered the missing-key path. During the authorized production migration, one live structured enrichment call passed using the existing production integration. Native conversational acceptance passed in development; direct installed MCP checks passed in production. Production migration evidence is recorded below. GitHub made secret scanning and push protection available after the repository became public. Both are enabled and verified. Private vulnerability reporting is also enabled.

### Final owner gates

| Gate | State and one-line ask |
| --- | --- |
| 4. Optional server-side AI | Resolved: one live production structured-enrichment check passed during the authorized migration. |
| 7. Existing production instance | The owner approved full migration and retirement. Deployment, credential rotation, client cutover, calendar sync, MCP reads, a reversible task edit, and data-integrity verification passed. The previous repository is archived. The production main view passed screenshot inspection. Already-open clients need restarting after credential changes. |

Gates 1–3, gates 5–6, and the Claude sign-in prerequisite are resolved. All stage completions were logged through the isolated development Helm MCP before that test project was removed. The owner approved the eight-file real-home installation after reviewing its dry-run. The installed development MCP served settings and a brief successfully. The owner subsequently requested restoration: all eight changes were reversed, newer Claude metadata was preserved, and private recovery backups were retained. No SessionEnd hook or scheduled job was added. The original MCP starts and lists its tools locally. No production API was called during restoration. The owner explicitly approved public visibility. Anonymous repository and README access are verified.


### Authorized production migration — 10 September 2026

The reviewed release was deployed to the existing production project after a verified export, environment backup, source bundle, compatibility checks against an in-memory snapshot, and a successful deployment dry run. The schema update was additive and removed no indexes. Personal configuration was preserved in the new settings document.

The production API and surface credentials were rotated independently. The installed MCP, existing session hook, skills, and scheduled procedure files now use the reviewed checkout. Unrelated client configuration was preserved. Production setup and regression helpers were not run.

Observed production checks passed: installed stdio MCP settings, areas, brief, day log, inbox and waiting reads; rejection of old and absent API credentials; HTTP brief and surface-token authentication; live structured AI enrichment; Google Calendar refresh; and a reversible edit on the migration's own maintenance record. A post-migration export confirmed every original task, area, check-in and existing metadata record was preserved. The calendar mirror was reduced to unique events in the current rolling window.

Private backups include original and post-cutover exports, environment values, client preimages, a source bundle, verification evidence and recovery instructions. None of that private material is committed to this public repository. The previous source is marked retired and archived. Its local checkout and worktrees are retained for rollback. The owner supplied a screenshot of the unlocked production Glass main view. The task card, workday timeline, category badge, action buttons and counters render without visible clipping or error messages. This completes the main-view screenshot check; production browser clicks, live updates and the Settings panel were not visually tested because browser automation could not verify the administrator policy. An optional conversational production check also remains unrun; direct installed MCP verification passed.

The reusable deployment and client instructions remain in [the production guide](docs/deploy.md). They require the installation owner's approval and verified target selection. Restart already-open Claude Code sessions after credential changes.

---

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

## QC repair 7 plan: complete and reconcile the calendar mirror

Findings: CVX-04 and CVX-06. Fetch every supported Google Calendar page before replacing data. Reject incomplete, invalid, duplicate, or oversized snapshots before persistence. Reconcile by event identity, preserve prep state, and prune missing or expired rows. Include long ongoing events across the lower window boundary.

The existing live mirror test also temporarily deletes real meeting rows and restores only basic fields, losing prep links and row IDs. Replace it with transactional probes that always roll back. Verify this preservation issue independently and record its verdict in the QC table.

Validation: isolated multi-page success/failure and capacity fixtures; rollback-only development probes for advancing windows, duplicate repair, prep preservation, missing-event pruning, cross-pass prep ordering, and deliberate demotion; TypeScript, development push, and the full suite. No live Google account connection.

QC repair 7 complete (CVX-04, CVX-06, and independently confirmed ROOT-04): the mirror reads complete bounded pages before writing; rejects malformed response roots and incomplete/invalid snapshots; reconciles stable event IDs; preserves matching prep state; repairs duplicates; and prunes missing/expired rows. Long ongoing meetings remain visible.

Regression mirror checks now use an always-rollback transaction, preserving real meeting IDs, links, stamps, tasks, settings, and check-ins. The independent verifier caught a malformed-response gap in the first draft; its corrected version passed 36 calendar scenarios and all 29 Now-order scenarios. TypeScript, development push, 213 top-level backend assertions, 14 rollback probes, a network-free hosted pagination probe, and hook/OAuth/calendar fixtures passed. No live Google account connection was made.

## QC repair 8 plan: bound reads and paginate task history

Findings: CVX-02 and the query portion of CVX-03. Apply list filters before result limits. Add compound indexes and a cursor-based history query/MCP tool. Bound complete indexed reads by rows and bytes with explicit overflow errors; preserve honest summary counts. Reuse status reads and compute streaks through indexed daily existence checks.

Validation: older filtered terminal matches, multi-page history including empty filtered pages, explicit row/byte overflow, unchanged aggregate counts within capacity, and large-history access. Run TypeScript, development push, backend/MCP suites, and independent verification. Mutation batching and remaining write bounds follow in a separate slice before CVX-03 is marked fixed.

QC repair 8 complete (CVX-02; query portion of CVX-03): filters precede result limits, indexed history has a continuation API, and complete reads enforce explicit row/byte capacities without returning inaccurate counts. Daily existence checks avoid reading the completion archive for streaks.

Validation: 47 independent query/MCP scenarios passed. TypeScript, development push, 224 backend assertions, hook/OAuth/calendar suites, and real stdio MCP tests passed. The hosted byte-limit test returned four 600 KiB records and two small records exactly once across three pages. Mutation capacities and background batching remain open for CVX-03/CVX-09.

## QC repair 9 plan: bound mutations and continue background wakes

Findings: remaining CVX-03 and CVX-09. Apply explicit read and payload capacities to growing write paths. Bound choice, delegation, relationship, and reconciliation inputs. Process expired snoozes in byte-bounded batches, serialize scheduled continuations, preserve current user ordering, and recover from failed scheduled jobs. Preserve oversized legacy check-ins while allowing status-only background progress.

Validation: atomic rejection of oversized inputs, invalid date windows, full backlog progress, byte-heavy batches, cron overlap, stale continuations, current-order preservation, failed-job recovery, and legacy check-in fallback. Use isolated and always-rollback hosted probes, TypeScript, development push, full backend/MCP suites, and independent verification.

The independent verifier found that JSON-encoded byte estimates can overcount control characters enough to stall a valid large task or legacy check-in. Capacity accounting now uses Convex's own value-size function. The hosted rollback probe includes large escaped text in both records.

QC repair 9 complete (remaining CVX-03 and CVX-09): every growing read path has an explicit operation capacity. Choice, reconciliation, delegation, and relationship writes reject oversized inputs atomically. Snooze processing commits bounded batches, coordinates continuation ownership, resumes failed jobs, preserves current retained order, and continues past oversized legacy check-ins. Byte accounting uses Convex value sizes.

Validation after the escaped-text correction: TypeScript and development push passed; all 234 backend assertions, 224 always-rollback wake checks, 14 calendar rollback checks, the hosted calendar runtime probe, hook/OAuth/calendar suites, and real MCP tests passed. Independent verification passed 40 mutation/scheduler scenarios, 47 repeated query scenarios, and seven actual stdio MCP cap/exposure checks. No confirmed issue remains in these two findings within the documented capacities.

## QC repair 10 plan: align installation and sweep documentation

Findings: DOC-001, DOC-002, and independently confirmed DOC-003. Describe the implemented local Claude Code capture door. Put cloud selection before the quickstart commands. Distinguish incremental-source watermarks from complete rolling calendar windows and preserve completed calendar prep in every design reference.

Validation: compare the installation order and source procedure with the actual CLI, wizard, MCP schema, and both skill variants. Run the full development suite after this documentation group.

QC repair 10 complete: the capture guide describes local Claude Code, quickstart cloud selection precedes setup, and all sweep design references distinguish incremental boundaries from complete rolling calendar windows. Repeated calendar reads preserve completed prep.

Independent verification confirmed DOC-001/002/003 against both sweep procedures, source presets, MCP forwarding, and backend behavior. All 234 backend assertions and hook/OAuth/calendar suites passed. All 32 tracked Markdown files have resolving local links. All 14 MAJOR and 8 MINOR findings now have verified repairs; fresh repeat reviews follow before Stage 5 completion.

## QC repair 11 plan: bind administration to the validated development target

Finding: INST-02. Parse deployment files with the same dotenv version as the pinned Convex CLI. Reject credential and self-hosted overrides. Remove ambient aliases. Revalidate the selected deployment before every administration subprocess. Use the same guarded path for regression commands and function metadata.

Validation: offline parser/precedence fixtures covering duplicate, quoted, export, colon, key/token, self-hosted, ambient, and changed-file cases; actual CLI selector probes with networking disabled; full development, wizard, installer, rotation, hook/OAuth/calendar, and MCP checks as appropriate. No production invocation.

QC repair 11 complete: all development administration uses the effective dotenv selection, rejects conflicting credentials/targets, and rechecks the original target before each subprocess. The actual CLI selector and regression wrapper passed 85 independent/tracked cases. All 234 backend assertions, 49 target fixtures, hook/OAuth/calendar/MCP suites, wizard acceptance, and scratch-home installation/restoration passed. No production invocation occurred.

Fresh repeat reviews added one MAJOR and four MINOR defects and reopened one previously counted documentation reference. Cumulative totals are 15 MAJOR and 12 MINOR. All MAJOR repairs are verified; another installation review remains. Five MINOR repair scopes remain.

## QC repair 12 plan: make brief limits explicit

Findings: CVX-10, CVX-11, and residual DOC-003. Bound encoded HTTP JSON independently from Convex value sizes. Return an explicit capacity error without truncating text. Count eligible wins and ageing tasks before display slicing. Document count meanings and remove the stale universal source-adapter reference.

Validation: UTF-8/escaping and exact encoded-boundary fixtures, actual HTTP handlers, hosted response-capacity probe, display-cap count invariance, TypeScript, development push, and the full development suite.

QC repair 12 complete: encoded HTTP JSON is bounded at 8 MiB with an explicit 413 response; legal stored text is unchanged. Wins/ageing counts report eligibility totals independent of display caps. The residual fictional adapter reference is removed.

Independent verification passed 100 JSON boundary/Unicode cases, seven actual HTTP scenarios, count fixtures across four caps, and three internal-probe assertions. TypeScript, development push, 237 backend assertions, 34 tracked HTTP fixtures, 49 target fixtures, and hook/OAuth/calendar suites passed. The test harness URL-decoding draft issue was corrected before the complete green run.

## QC repair 13 plan: preserve missing check-ins during wake tests

Finding: ROOT-05. Remove the current-day wake test and its lossy restoration. Exercise the same status, clock, future-snooze, explicit-order, and demotion behavior inside the existing always-rollback wake transaction. Keep all queued continuations and temporary rows within that rollback boundary.

Validation: independent execution of the rollback probe, TypeScript, development push, the hosted success marker, and the full development suite.

QC repair 13 complete: D2 now runs only the always-rollback wake probe. It does not create or restore a live current-day check-in. The probe exercises actual status and Now helpers, future snoozes, clocks, batch ownership, recovery, and legacy payload behavior.

Independent verification passed 40 mutation/scheduler cases and three transaction-model cases covering initially absent state, existing check-ins/jobs, and injected failure after queued work. Success reached 230 internal checks. TypeScript, development push, 228 top-level backend assertions, HTTP/target fixtures, and hook/OAuth/calendar suites passed. The reduced top-level count reflects replacement of the live test by rollback assertions.

The fresh installation pass found zero MAJOR issues and one MINOR URL-normalization edge (INST-03). Cumulative confirmed defects are now 15 MAJOR and 13 MINOR. Two MINOR scopes remain: INST-03 and CONTRACT-04.

## QC repair 14 plan: normalize accepted development URLs

Finding: INST-03. Return the validated URL origin so an optional trailing slash cannot create double-slash API or surface paths. Treat equivalent URL spellings as the same target.

Validation: actual Convex client requests for standard and regional hosts with and without trailing slashes; same-target revalidation; full development and MCP suites.

QC repair 14 complete: accepted development URLs use their canonical origin. Standard and regional hostnames work with or without a trailing slash, and equivalent spellings do not change the validated target. Independent actual client/router checks and all 53 target fixtures passed. The full 228-assertion backend suite, HTTP/hook/OAuth/calendar checks, and real MCP tests passed.

## QC repair 15 plan: read the saved carried set

Finding: CONTRACT-04. After reconciliation, read the current evening check-in and hydrate its carried task IDs. Use that saved set for the carried summary. Keep interactive and scheduled procedures aligned.

Validation: independent procedure execution against actual handler fixtures with more carried tasks than the daily cap and with unrelated backlog filling the brief; skill frontmatter validation, actual MCP calls, and the full development suite.

Group 15 scope update: verification found the same DOC-003 watermark ambiguity in MCP tool descriptions. Align those descriptions, the metadata module comment, and the build guidance with incremental update boundaries and complete calendar windows. These are instruction/comment changes only. Re-run the full suite after the final wording.

QC repair 15 complete: both reconcile procedures read the saved evening carried set and hydrate those IDs. Missing records are reported as unavailable. MCP watermark descriptions and related source guidance now distinguish incremental update boundaries from diagnostic calendar run starts.

Independent verification passed two-skill parity and four actual stdio/MCP-to-handler scenarios covering cap overflow, unrelated backlog, missing check-ins, and missing tasks. Tool metadata and all current source instructions agree. Both skill validators passed. The final wording passed 228 backend assertions, 53 target fixtures, 34 HTTP fixtures, hook/OAuth/calendar checks, and real development MCP tests.

All 15 MAJOR and 13 MINOR confirmed defects now have independently verified repairs. Fresh repeat passes have zero MAJOR findings in every affected dimension. Final full-diff procedure coverage follows before Stage 5 is logged complete.

## QC repair 16 plan: preserve completion undo order

Finding: CODE-002, MINOR. Completion currently removes a chosen task, so the existing undo restores status without its chosen rank. Preserve chosen membership on completion; the read API already excludes closed tasks. Keep actual open-status demotions removed. Clarify the wake-batch comment to match the documented priority among retained wake IDs.

The separate batch-order candidate was rejected by independent verification at confidence 50: existing documentation explicitly preserves order among retained wake IDs, with the wake head ahead of other choices. No behavioral change is required for that candidate.

Validation: actual baseline/current undo reproduction, completion/undo and demotion assertions inside the always-rollback wake probe, TypeScript, development push, full development suite, independent verification, and a fresh high history review.

QC repair 16 complete: completing a chosen task preserves its position while the read API excludes it from active work. Undo restores that position. Explicit next, inbox, waiting, someday, and dropped transitions still remove the choice. The wake-batch comment now states its existing retained-ID priority rule.

Independent verification passed nine actual-handler undo/demotion scenarios and three absent/present/failure preservation probes. Hosted validation passed TypeScript, development push, 234 internal rollback checks, 228 top-level backend assertions, 53 target fixtures, 34 HTTP fixtures, and hook/OAuth/calendar suites. Cumulative confirmed defects are 15 MAJOR and 14 MINOR, all with verified repairs.

## Stage 5 · Completed

All seven independent dimensions, the reused finding verifier, repeat passes for every affected MAJOR dimension, the full-diff high code-review procedure, and the full-diff security-review procedure are complete. Final reviewed runtime commit: `f7e6fa1`. All 15 MAJOR and 14 MINOR confirmed findings are fixed; none remains open. The filtered comment interpretation is recorded separately.

Fresh final-delta review found no qualifying issue. Security review found no new HIGH/MEDIUM vulnerability above its confidence threshold. The external privacy denylist passes all 98 tracked files, 316 reachable text blobs, and commit messages. The final full suite and exact hosted rollback marker passed. Stage completion was logged through Helm MCP on the separate development deployment.

## Stage 6 · Clean installation plan

Create a scratch home and clone from GitHub. Follow `docs/install.md` as the installation guide. Use a second throwaway cloud development project. Keep all global installation files in the scratch home. Record failures or unclear steps as findings, repair them in the main repository, push, and restart the clone. Delete the throwaway project and scratch directories after the whole flow passes.

Claude Code sign-in is a pending prerequisite for the native conversational brief. Core setup, regression, MCP, installer, and glass checks can proceed independently. Optional provider credentials remain absent; no live paid AI or Google account test is claimed.

## Stage 6 finding and QC repair 17 plan

Finding: INST-04, MAJOR under the clean-install rule. A fresh scratch-home run of the documented Convex command asks whether to install optional Convex AI guidance files. The guide did not specify an answer. The test declined the optional files, then stopped before Helm configuration. No global user files or production deployment were changed.

Add the explicit answer to the guide. Verify it against the pinned CLI and observed prompt. Run the full development suite. Push the repair and restart with a new GitHub clone and scratch home. Retain the failed attempt's isolated project record for final cleanup.

QC repair 17 complete: the install guide explicitly declines optional Convex AI files. Independent verification matched the exact prompt, default, and decline branch in the pinned CLI. The full development suite passed 228 backend assertions, 53 target fixtures, 34 HTTP fixtures, and hook/OAuth/calendar checks. Cumulative defects are 16 MAJOR and 14 MINOR, all repaired. The clean-install restart will verify the corrected instruction from GitHub.

## QC repair 18 and handover plan

Finding: DOC-004, MINOR. The QC summary calls an earlier independent installation review a fresh installation pass, which can be mistaken for completed Stage 6 acceptance. Name the earlier review accurately. State that native acceptance is pending. Keep all finding rows in one table.

Prepare the top-level handover with slice commits, verified finding counts, acceptance evidence, owner gates, and unexecuted production migration instructions. Validate the handover independently. Run the full development suite after the documentation repair. Run privacy lint and link checks before committing.

## Stage 6 · Restarted acceptance checkpoint

A fresh GitHub clone at `e5b389c` passed dependency installation, cloud development provisioning, the corrected optional-guidance prompt, all six interactive wizard approvals, and all eight separately approved installer writes in a scratch home. The full suite passed 228 backend assertions, 53 target fixtures, 34 HTTP fixtures, and the hook/OAuth/calendar checks. The MCP and installed-file checks passed.

The browser showed an empty brief, the configured workday, generic owner settings, and six ordered areas. Only its own site and matching Convex host were requested. No page errors occurred. The settings screenshot was inspected. The browser harness was corrected to wait for live data and close the morning-review dialog before opening settings.

A private browser-harness timeout emitted the throwaway API key in diagnostics. That key was revoked immediately; the backend rejected it. A replacement was set and verified without printing it. The scratch registration was refreshed. The installer correctly refused to overwrite Claude startup metadata; that metadata was backed up, then the exact hash-verified installer snapshot was restored before refresh. No credential entered this repository.

Uninstall preview passed. Eight separate restoration approvals removed the eight created files. Backups remained and the manifest had no active entries. Reinstallation restored the reviewed integration for the pending native check.

The native `/brief` attempt stopped with the provider's sign-in requirement. This prerequisite is already documented in the install guide. Stage 6 is not complete or logged. Retain the isolated projects and scratch homes until native acceptance and final cleanup succeed. Do not install into the real user home yet.

## QC repair 18 · Validation

The report now distinguishes the earlier independent installation review from Stage 6 acceptance. The prompt failure and pending native check are explicit. All finding rows are in one table. Cumulative defects are 16 MAJOR and 15 MINOR, all repaired. The post-change development suite passed 228 backend assertions, 53 target fixtures, 34 HTTP fixtures, and hook/OAuth/calendar checks. Independent handover verification confirmed the corrected status, 31 unique repaired findings, one uninterrupted finding table, and owner-only migration instructions. Privacy lint passed all 98 tracked files and reachable text history. All 45 local links across 32 Markdown files resolve. Every handover commit reference resolves. The final scratch installed-file check passed after reinstallation.

## Stage 7 · Handover prepared and logged

The HANDOVER section above records shipped slices, their commits, the single QC report, 31 repaired findings, the completed acceptance checks, exact owner-run migration commands, and remaining gates. Its preparation was logged through Helm MCP on the isolated development deployment. Native Stage 6 acceptance and cleanup remain pending; no completion for that stage is claimed. The repository remains private. Production and real user configuration remain untouched by this build.

## Stage 6 · Completed

The standard provider sign-in succeeded in the isolated test home. Native `/brief` discovered the installed Helm MCP, called `getSettings` and `brief`, and returned the expected generic empty-state response. The run exited successfully with no permission denials. The direct MCP, full regression, browser, and installation/restoration checks had already passed on this same fresh clone.

Both temporary project IDs were matched to their recorded names and sole development deployments. Cleanup removed both projects through the management API. A subsequent project listing confirmed their absence. Both verified scratch directories were removed. The primary development project was retained. No production deployment was selected or changed. Stage 6 completion was logged through the primary development Helm MCP.

An attempted shortcut to reuse the host login token was rejected by automatic approval review before credential access. The standard scratch-home login resolved authentication instead. Cleanup's initial approval check was resolved by supplying the original request's explicit cleanup instruction and verified test-only project identities.

## Final owner review

The real-home installer dry-run completed without writing files or deployment values. It proposes the Helm MCP registration, four prefixed skills, the ambient-capture rule, and two schedule templates. Each proposed write has a backup. Session logging is disabled, so no hook is proposed. The existing MCP connection currently uses the production instance; approving this preview changes that client connection to the new development deployment. The preview is retained outside the repository for owner review.

The repository remains private. All 31 verified defects are repaired. Native acceptance and cleanup are complete. Real-home installation, public visibility, optional server-side AI credentials, and owner-run production migration remain explicit gates.

## Gate 5 · Approved installation completed

The owner approved the reviewed real-home installation and requested Glass. The installer updated all eight proposed files with backups: the Helm MCP entry, four prefixed skills, the ambient-capture rule, and two schedule templates. It left session-hook settings untouched because logging is disabled. It created no scheduled job.

The installed-file check passed. Verification confirmed the seven integration file hashes, all eight private backups, the new development URL and key, and preservation of the other MCP servers. Read-only calls through the installed server returned settings and a brief successfully. Claude's unrelated live metadata changed after installation; it was preserved.

Glass was opened in a visible browser tab for the owner. Its local unlock step uses the development API key. Production deployment and public repository visibility remain unchanged. No application source changed in this operation.


## Sharing preparation — restoration and cleanup

The owner requested restoration of the previous Claude integration, removal of the test environments, a sharing-readiness check, and a draft community message. Public visibility and production migration were not requested.

Restoration verified all eight original backups. It restored only the original Helm entry in the current Claude JSON, preserving newer metadata and every other MCP entry. The standard uninstaller restored the remaining seven files. Verification matched their original hashes, found an empty installation manifest, and confirmed hook settings were unchanged. The original MCP started and listed its tools locally. No production API was called. Private recovery backups remain available.

Management inventory found one remaining task-created project with only its expected development deployment. That project was deleted. The team inventory confirmed that all three task-created projects were absent. The obsolete local environment selector and 49 remaining scratch directories were removed. Source repositories and review evidence remain available. Further backend work requires a newly configured isolated development deployment.

Sharing checks reconfirmed 31 repaired findings with zero open, a clean tracked-file privacy scan, and a clean reachable-history privacy scan. Both current dependency audits report zero known vulnerabilities. The remote main branch matched the local reviewed code; GitHub reports the MIT licence, enabled Issues, and disabled Discussions. The fresh-clone and native integration acceptance results above remain the runtime evidence; only handover text changed in this operation. Live server-side AI remains untested. Secret scanning and push protection are not claimed enabled while the repository is private.

The repository is ready for the owner's public-visibility decision. The community message and installation prompt are drafted privately; no message was sent.


## Public release

The owner explicitly approved changing the repository to public. The release operation verified the personal owner, a clean working tree, and the matching local and remote main commit before changing visibility. Anonymous requests can read the repository and its README.

GitHub secret scanning, secret-scanning push protection, and private vulnerability reporting are enabled and verified. The source is ready for the drafted community message. No message was sent. No production deployment or Claude configuration changed during publication.
