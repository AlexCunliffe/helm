# Helm — build-session operating manual

This file auto-loads in every Claude Code session rooted here. You are the **builder** of Helm. Read this file. Read design documents 01 through 12 in `docs/`.

Helm is a personal task + accountability system (an "external executive function") for one user. The full design is in `docs/`. This file governs *how you build it*.

## The operating loop

Work a continuous **Plan → Build → Test → Review → commit** loop, one small vertical slice at a time. Never big-bang.

1. **Plan.** Pick the next smallest shippable slice from `docs/10-roadmap.md`. Write the slice plan into `PROGRESS.md` (goal, files, how you'll test, done-criteria). One slice ≈ one capability you can demo.
2. **Build.** Implement it. Follow the data model and patterns in `docs/`. Match existing code style. No scope creep beyond the slice.
3. **Test.** Prove it against a **dev** Convex deployment — `npx convex run <fn>` with real args, assert the result, inspect the data. Add a lightweight test/harness where it pays. A slice isn't done until you've *seen* it work, not assumed it.
4. **Review.** Self-review against the spec and the definition of done below. Run `/code-review` (or a checklist) on the diff. Fix what it finds. Re-test.
5. **Commit** the slice with a clear message. Update `PROGRESS.md` (done, decisions, next). Then loop.

Keep the loop moving. Don't stall on small choices — pick a sensible default, record it in `PROGRESS.md` / `docs/12-open-questions.md`, and continue. Only stop the loop for the human-in-the-loop gates below.

## Guardrails (hard rules)

- **Dev first, prod never without explicit OK.** All build/test on a dev Convex deployment. Production deploys, anything touching real email/Slack *sends*, or anything irreversible/outward-facing → stop and ask.
- **Small slices, green before commit.** Checks/tests pass before every commit. If a slice balloons, split it.
- **Additive, scalable patterns only.** New category = a row in the `areas` table, never a migration. New capture source = a new adapter. New surface = a new client of the read API. See `docs/09-scalability.md`. Never hardcode a closed list where the spec says it must extend.
- **Secrets are pointers.** Never commit keys/tokens/PII. Use `.env.local` (gitignored); Convex secrets via `npx convex env set`.
- **Respect the second-brain split (`docs/08`).** Operational task state → Convex (auto-writes fine). Durable *knowledge* → the markdown vault, and only ever **proposed for confirmation**, never silently auto-written.
- **Cost-aware.** Anything that calls an LLM on a schedule (sweeps, agents) must be watermark-bounded and respect a spend cap. Note token implications in `PROGRESS.md`.

## Human-in-the-loop gates (surface, don't block the rest)

You can build Phases 0–2 end-to-end without the user. These need the user — flag clearly in `PROGRESS.md` and keep building everything else:

- Registering the Helm MCP server into the user's Claude Code config.
- The `SessionEnd` hook install into `~/.claude/settings.json` (global) — propose the exact snippet; let the user apply it.
- Claude Tag wiring (needs the Team plan live + a Slack channel choice).
- Any production deployment or first real send.

## Definition of done (every slice)

1. Does what its `PROGRESS.md` plan said. 2. Tested against dev — observed, not assumed. 3. Matches the data model & scalability rules. 4. Reviewed (self + `/code-review`), findings resolved. 5. No secrets. 6. `PROGRESS.md` updated. 7. Committed.

## Conventions

- TypeScript. Convex **object-form** function syntax with validators (`args`/`returns`). Index every query (no full scans). Follow Convex best practices.
- Naming: `kebab-case` files, `camelCase` functions. One concept, one home.
- Commits: use imperative, scoped messages, such as `feat(capture): add an incremental sweep`.
  Use the commit identity configured for the session.
- Keep `docs/` truthful: if a decision changes, update `docs/11-decisions.md`.

## What "good" looks like

Helm must feel calm and decided. Surface one next action. Prefer low input and clear context.
