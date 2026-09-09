# Security model

Helm is a single-user application with shared bearer credentials. It has no accounts or separate reader and editor roles for its function API. Each installer owns a separate Convex project. The repository's development project is not a shared backend.

## Credentials and permissions

| Credential | Permitted access | Stored copies |
| --- | --- | --- |
| `HELM_API_KEY` | All public queries, mutations, and AI actions, including settings and areas | Convex environment; MCP registration; optional hook command; browser localStorage; installer backups |
| `HELM_SURFACE_TOKEN` | `GET /brief` and `POST /ingest` | Convex environment; widgets or webhook clients |
| `ANTHROPIC_API_KEY` | Server-side Anthropic requests | Convex environment |
| Convex account credentials or deployment admin key | Environment values, internal functions, deployment administration, and data | CLI account storage or the administrator's secret store |

A stolen API key grants the owner's application access. It does not grant the Convex administration API. Public functions reject missing or incorrect keys. A deployment without a configured API key also rejects them. `HELM_ALLOW_ANON=1` disables this protection and warns on every public call. The setup wizard removes the opt-out. The old `HELM_REQUIRE_KEY` setting has no effect.

The surface token travels in `X-Helm-Token`. Query-string tokens are rejected. It is not read-only: ingest accepts task content, source metadata, a dedupe key, and a review flag. Ingest defaults to a proposal, but a caller can currently set `needsReview` to false. A matching dedupe key can refresh an existing open task. Treat this as a capture credential. Do not share it with an untrusted party.

HTTP routes present the server's API key to their function calls. A surface caller cannot choose a function name or retrieve environment values. Cross-origin access is allowed for widgets. CORS is not an authentication boundary. Helm adds no application-level rate limits or per-client quotas.

## Arguments and logs

Convex queries receive `apiKey` as a function argument because they cannot read the caller's HTTP authorization header. Mutations and actions use the same contract. Arguments and task content can appear in Convex function logs and dashboard tooling.

Treat Convex dashboard access as full access to the brain and its credentials. Limit project membership. Review access before adding a collaborator. Do not assume log redaction creates a separate security boundary.

The auth helper compares every character without an early prefix return. This reduces a simple timing leak. JavaScript provides no formal constant-time guarantee.

## Browser storage and delivery

The glass stores the API key as `helm:apiKey` in localStorage for its site origin. It uses the key for reads, subscriptions, and edits. A rejected key is removed. A network failure preserves it for retry. Clear site data to remove a remembered key.

Someone who can inspect the browser profile, run a privileged extension, or execute script in the page can obtain the key. It is not an HttpOnly cookie. Use a browser profile you control. Do not unlock Helm on a shared device.

The Convex browser client is bundled into the served page. Loading and using it contacts its own Convex site and cloud endpoints. CSP restricts network connections to those endpoints and blocks external scripts. Inline scripts and styles remain enabled. CSP does not eliminate script-injection risk. Dependencies and generated page changes remain trusted code. Read [the third-party notices](../THIRD_PARTY_NOTICES.md).

## Claude files and backups

The installer puts the API key in the MCP server's environment entry. With session logging enabled, it also puts the key in the hook command. These are plaintext configuration files. Replaced files and backups use owner-only permissions. Previews mask credentials.

Registration runs through the Claude CLI in a temporary home. Only the approved Helm entry is merged into the selected global file. The temporary home is removed. The CLI receives environment assignments as process arguments. A sufficiently privileged local process observer may see them during registration.

Each approved global write creates a backup. Backups may contain old credentials and private instructions. Uninstall retains them. Rotation invalidates old credentials but does not erase their stored copies. Review backup retention on your device. Keep the clone's ignored `.helm-local` records until uninstall is complete. They store recovery paths and hashes, not secret values.

The installer refuses to update an installed file changed by another tool or person. Uninstall preserves later edits too. Reconcile those files manually with their backups before an update. Preserve later edits during reconciliation.

## Session logging

Session logging defaults to off. The installer skips the hook file while it is off. An already installed hook reads preferences before opening a transcript. With logging off, it sends no session content.

When enabled, the hook reads at most the first 256 KiB of a regular transcript file. It selects the first usable user message and truncates it to `hook.titleChars`. It sends a provisional completion with a session-based dedupe key. It includes the working directory only when `hook.includeCwd` is true. The opening message can contain private content. Choose this option deliberately.

Malformed input, invalid files, missing credentials, and network failures are silent. Input and network waits are bounded. This is a best-effort record, not an audit log.

## AI and connectors

Server-side AI actions send selected task text and relevant configured context to Anthropic. They require `ANTHROPIC_API_KEY`. Without it, they fail closed. Core task, settings, and browser functions still work.

Sweep and reconcile run inside your Claude session. They read enabled connectors named in settings. Model use and connector access belong to that session. Source notes and task text are untrusted input. The skills instruct the assistant to treat them as data and obtain authorization before sending messages or writing knowledge files. These instructions do not replace connector permissions or human review.

## Rotate development credentials

Run this command from the clone to preview rotation:

```sh
npm run rotate-key -- --dry-run
```

Run this command to approve rotation:

```sh
npm run rotate-key -- --yes
```

The command creates separate 48-character random hex values for the API key and surface token. It sets them through CLI stdin. It reads them back in memory. It verifies API and HTTP access. It attempts to restore both previous values if verification fails. It prints no secret.

Refresh the MCP registration. Refresh an enabled hook's environment. Unlock the glass with the new API key. Update widgets and ingest clients with the new surface token. Run the regression suite on development. The rotation helper deliberately accepts cloud development deployments only. Follow the deployment instructions for a production migration.

For suspected exposure, revoke or rotate the affected credential. Review deployment access. Review configuration and backups. Inspect unexpected task changes. Do not paste credentials into issues or chat.

## Vulnerability reports

Read [SECURITY.md](../SECURITY.md). Keep exploit details and private task data out of public issues. This reference implementation has no support agreement or guaranteed response time.
