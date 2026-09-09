# 08 · Second-brain bridge

Helm (action) and the markdown second-brains (knowledge) are **two stores, each right for its job, linked** — not one shoved into the other.

| | Helm / Convex | Second-brain / markdown |
|---|---|---|
| Holds | Operational state: tasks, what's-next, what-I-did | Durable meaning: decisions, runbooks, people, vendors, project context |
| Shape | Structured, reactive, queryable | Human-readable, portable, git-versioned |
| Truth | Source of truth for **task state** | Source of truth for **understanding** (references live systems) |
| Writes | Auto-writes fine (low-stakes ops facts) | **Proposed & confirmed only** — never silent auto-write |

That last row matters. The vault's own rule (template knowledge guidance) is **global rule yes, auto-write hook no** — curation needs a human, or you erode trust with low-confidence "facts". Helm honours it: the `SessionEnd` hook auto-logs *completions to Convex* (operational, fine), but it must **never** auto-write knowledge into a brain. When a completion smells like durable knowledge or a decision, Helm *proposes* a vault note (or offers a dated journal line) for the user to confirm.

## Bridges (seams in v1, wired incrementally)
- `tasks.vaultRef` / `projects.vaultRef` — relative path/slug to a note (`90-projects/<slug>.md`, an ADR, a person). A task links to its knowledge → cheap re-entry.
- `areas.vaultDomain` — maps a Helm area to a brain domain (`finance → 50-commercial`), so a task knows which brain/domain its knowledge lives in.
- A Helm project ↔ a `90-projects/` note. The note's `sources:` cites Helm/Convex as the system of record for status.
- The evening reconcile can **offer** to append a dated `_captures/journal/` entry summarising the day (opt-in, confirmed) — knowledge accrues without breaking the no-auto-write rule.

## Vault conventions to respect (from the template)
- Frontmatter on every note (`type, title, status, created, updated, summary`), `updated` bumped on edit.
- `kebab-case`, globally-unique slugs; `[[wikilinks]]` in `related:`, relative markdown links in the body.
- Never write secrets; use pointers. Knowledge is *referenced from* live systems, not mirrored.

## Direction of travel
Eventually Helm is the action layer *over* a nest of brains (`<your-vault>`, a work vault, a personal brain). Keep all vault links **relative** and never assume a brain's folder name — same portability rule the template insists on. Don't build deep vault integration in v1; just keep the `vaultRef`/`vaultDomain` seams in place so it's additive later.
