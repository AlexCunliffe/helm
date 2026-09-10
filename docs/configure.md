# Configure Helm

Settings live in one Convex `meta` row with `key: "settings"`. Areas live in their own table. The wizard, web Settings panel, and MCP `updateSettings` tool use the same validated configuration. Reopen the panel after an external edit. Active form drafts are preserved while you work.

Use the wizard for a guided change:

```sh
npm run setup
```

Preview the current configuration without writing:

```sh
npm run setup -- --dry-run
```

The wizard has no user-global writes. Each approved step changes development data or environment values. The Claude installer handles global files separately.

## Saved answers

Copy the non-secret example:

```sh
cp examples/settings.example.json settings.local.json
```

Edit `settings.local.json`. Keep it out of Git. Do not put credentials in it. The filename is ignored by this repository. A different filename may not be ignored.

Preview the answers:

```sh
npm run setup -- --from settings.local.json --dry-run
```

Apply the answers after review:

```sh
npm run setup -- --from settings.local.json --yes
```

`--yes` requires `--from`. It approves all six steps. Without `--yes`, each step asks for confirmation. Omitted sections retain their current values. Owner, workday, hook, and cap objects merge with current values. `sources` replaces the source list. `areas` replaces the selected active set: omitted active areas are retired, not deleted. `areaPreset` selects `generic` or `classic` when an explicit `areas` list is absent. With neither field, existing active areas are kept; an empty deployment gets the generic set.

Use `caps: null` in an answer file to remove all cap overrides. Use `workday.eveningWatchFrom: null` to remove that override. Use an empty string to clear optional text. Individual cap resets are supported by the panel or MCP patch; use `null` for that cap in `updateSettings`.

The wizard rejects unknown top-level fields and secret-shaped content before previewing it. This is a guard against mistakes, not a credential scanner. Keep all secrets out of answers, source notes, and settings.

## Owner and context

| Field | Default | Limit and effect |
| --- | --- | --- |
| `owner.name` | Empty | Up to 120 characters; full name used by skills and AI context |
| `owner.shortName` | Empty | Up to 60 characters; preferred short name |
| `owner.role` | Absent | Up to 160 characters; optional AI context |
| `owner.business` | Absent | Up to 400 characters; optional AI context |
| `owner.tone` | Plain, concise, and calm. | Up to 400 characters; wording guidance |
| `founderContext` | Empty | Up to 800 characters; recurring context for AI actions |

Do not store secrets in these fields. Optional AI actions can send relevant context to Anthropic. Read [security](security.md).

## Time

| Field | Default | Rule and effect |
| --- | --- | --- |
| `timezone` | `Europe/London` before setup | Valid IANA timezone, up to 100 characters; dates, daily boundaries, and display clocks |
| `workday.start` | `08:00` | `HH:MM`; start of the workday thread |
| `workday.end` | `17:00` | `HH:MM`; must follow start on the same date |
| `workday.days` | `[1,2,3,4,5]` | One to seven distinct integers; Monday is 1 and Sunday is 7 |
| `workday.eveningWatchFrom` | Absent | `HH:MM` at or after workday end; absent uses workday end |

A first wizard run suggests the operating system's timezone. Existing settings keep their timezone. Day-boundary calculations use the configured timezone, including daylight-saving transitions. Working days control the glass's working-day context and guide the skills. They do not create a schedule for a source sweep.

## Display and timing limits

All cap overrides are optional integers. Clear an override to restore its default. Display caps limit returned sections; they do not limit the number of stored tasks.

| Field under `caps` | Default | Allowed range | Effect |
| --- | --- | --- | --- |
| `today` | 3 | 1–20 | Daily selection and brief limit |
| `wins` | 5 | 0–100 | Small-action suggestions |
| `ageing` | 5 | 0–100 | Ageing-task suggestions |
| `waiting` | 10 | 0–100 | Waiting section in the brief |
| `upcoming` | 5 | 0–100 | Upcoming section in the brief |
| `newToday` | 50 | 1–200 | Recent captures |
| `waitingAgeingDays` | 5 | 0–3650 | Waiting-age threshold |
| `openAgeingDays` | 14 | 0–3650 | Open-task age threshold |
| `meetingPrepLeadMin` | 30 | 0–1440 | Lead time for linked meeting-prep promotion |
| `focusMinutes` | 25 | 1–240 | Browser focus timer |

## Sources

`sources` defaults to an empty array. It supports at most 40 entries. Read [source setup and examples](sources.md).

| Field in each source | Rule |
| --- | --- |
| `key` | Unique lowercase slug; start with a letter; use letters, digits, `_`, or `-`; up to 64 characters |
| `label` | Non-empty display name; up to 120 characters |
| `kind` | `email`, `chat`, `calendar`, `meetings`, `tracker`, or `custom` |
| `mcpServer` | Exact connector server name; up to 120 characters; set it before enabling the source |
| `enabled` | Boolean; disabled entries are skipped |
| `notes` | Optional read rules, filters, timestamps, and dedupe guidance; up to 2,000 characters |

Changing a source entry does not install or authorize its connector. It does not configure the separate server-side calendar mirror.

## Session hook

| Field | Default | Effect |
| --- | --- | --- |
| `hook.logSessions` | `false` | Permit provisional completion logging from Claude sessions |
| `hook.includeCwd` | `false` | Include the working directory in a logged completion |
| `hook.titleChars` | 140 | Integer from 1 to 500; maximum message-derived title length |

Enable logging in Settings or the wizard. Run the Claude installer to add the hook. An installed hook reads current preferences before reading a transcript. Turn logging off to stop content submission without removing the hook. The installer skips the hook file while logging is off. Read the privacy details in [security](security.md).

## Areas

The generic preset has Work, Finance, People, Admin, Home, and Personal. The classic preset has Operations, Finance, Production, Customer service, Sales, Projects, and Personal. Both are editable starting points.

| Field | Rule |
| --- | --- |
| `key` | Stable lowercase slug; up to 64 characters; do not change a key to rename its label |
| `label` | Non-empty; up to 120 characters |
| `color` | Six-digit hex color, such as `#5B8DEF` |
| `order` | Integer from 0 to 10,000 |
| `vaultDomain` | Optional relative knowledge-domain reference; up to 200 characters |
| `archived` | Retirement flag managed by the area editor or API |

Keep at least one active area. The system permits at most 100 total areas, including retired ones. Retiring an area preserves linked tasks. Use the Settings panel to add, rename, recolor, or retire areas. Use saved answers or the area API to set order and vault-domain values.

For a configured deployment with no areas, preview the seed:

```sh
npm run seed -- --dry-run
```

Seed an empty area table:

```sh
npm run seed
```

The seed command leaves an existing area table unchanged. Use the wizard to apply a preset to an existing installation.

## Secrets

Keep deployment credentials in Convex environment values. The setup wizard creates missing Helm keys and preserves existing ones. It can set an optional Anthropic key through hidden input. It never prints or saves that input. The Settings panel's Rotate key action shows a terminal command. It does not hold a deployment-admin credential.

Read [security](security.md) before rotation. Read [deployment](deploy.md) before moving to production.

## Development target selection

Use the generated development selector and matching client URL in `.env.local`. Standard dotenv quoting is accepted. Remove `CONVEX_DEPLOY_KEY`, `CONVEX_DEPLOYMENT_TOKEN`, `CONVEX_DEPLOYMENT_KEY`, `CONVEX_SELF_HOSTED_URL`, and `CONVEX_SELF_HOSTED_ADMIN_KEY` from that file. Remove the assignments even when they are empty. Use the signed-in Convex account. Restart an active setup or administration command after changing its deployment selector or client URL.
