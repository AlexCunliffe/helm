# Deploy to production

Production is separate from the development installation. The owner controls this step. These production commands are provided for the owner to run; they are not part of the development test suite. Do not run the regression suite against production.

Read [security](security.md). Complete the development installation and tests first. Use fresh production credentials. Keep development credentials separate.

## Select the project

Use the clone that contains the reviewed release. Check `.env.local`. Confirm that it selects the project whose production deployment you intend to update. A development deployment and a production deployment belong to the same Convex project. A new development project does not point to an older project's production deployment.

For an existing installation, save its current deployment configuration and data backup before changing code. Copy its project-selection values into this clone's ignored `.env.local` only after verifying the project. Do not copy secrets into tracked files. Do not run setup or development tests against an existing installation that contains important data.

## Deploy reviewed code

Build the embedded page:

```sh
npm run glass:embed
```

Deploy to the selected project's production deployment:

```sh
npx convex deploy
```

Read the target shown by the CLI before confirming it. Stop if it is not the intended project. The deployment keeps existing data. New settings are additive; a missing settings document uses defaults until configured.

## Set production credentials

Create a fresh API key without printing it:

```sh
node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))' | npx convex env set --prod HELM_API_KEY
```

Create a separate surface token:

```sh
node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))' | npx convex env set --prod HELM_SURFACE_TOKEN
```

Remove the anonymous-access opt-out:

```sh
npx convex env remove --prod HELM_ALLOW_ANON
```

These commands also rotate credentials for an existing production installation. Connected clients will reject the old values. Update those clients in the same maintenance window. The old `HELM_REQUIRE_KEY` value is ignored.

If server-side AI is required, set a production Anthropic key through the Convex CLI. Keep the value out of shell history and chat. Optional Google Calendar credentials are also per-deployment. They are not copied from development. Leave those integrations unconfigured if you do not need them.

## Configure production data

Find the production client and site URLs in the Convex dashboard. Open the production site URL with `/glass` appended. Read the production API key locally:

```sh
npx convex env get --prod HELM_API_KEY
```

Unlock the page with that value. Open Settings. Set owner, context, timezone, workday, sources, and hook preferences. Add at least one active area if the production database is empty. Existing areas and tasks remain in place when code is deployed.

The setup, seed, test, rotation, and Claude installer helpers in this repository intentionally target cloud development. Use the production page and explicit production administration commands for this step. Do not change `.env.local` to disguise a production deployment as development.

## Point clients at production

Back up the Claude config files before editing them. Use the paths shown by the installer's earlier dry-run. If `CLAUDE_CONFIG_DIR` is set, use that directory's `.claude.json`; otherwise use `~/.claude.json`.

In the Helm entry under `mcpServers`, replace `HELM_CONVEX_URL` with the production client URL. Replace `HELM_API_KEY` with the new production API key. Keep the command and clone path unchanged. Preserve other MCP servers. Do not paste a key into the conversation.

If the SessionEnd hook is installed and wanted, back up its settings file. Replace only the Helm hook's URL and API key. Preserve other hooks. Keep `hook.logSessions` off until the client configuration is correct.

Restart Claude Code. Open a brief. Verify that it shows the intended production data. Open the production glass. Verify the workday and areas. Update HTTP widgets and ingest clients with the production site URL and new surface token.

The local installer record still describes the previous development installation. Its drift check will report the manual production change. Do not rerun the development installer over that configuration. Keep the backups and reconcile the Helm entries manually if you later uninstall.

## Existing-instance migration

Keep the existing production project and its data. Change the clone that supplies its reviewed code. Verify the project selection before deployment. Deploy the new code. Rotate production credentials. Configure settings through the production page. Update the MCP server and hook to run files from the new clone. Verify a brief and a reversible task edit.

Retain the previous clone and backups until verification is complete. Retire the old repository only after the owner approves. Publishing this source repository is a separate decision from migrating an instance.
