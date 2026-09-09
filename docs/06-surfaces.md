# 06 · Surfaces (it comes to you)

All read-mostly. All read the **same stable API**, so adding a surface never touches the brain.

## v1 / planned
- **Slack brief & nudges** (via Claude Tag + a fixed-time scheduled message) — morning brief, ageing nudges, evening reconcile. Mobile by default (Slack app), so it works AFK.
- **iPhone widget** — Scriptable widget hitting `GET /brief` (token). Top 3 + streak + waiting count. Read-only, glanceable.
- **Desk screen** — a spare tablet / e-ink / Pi pointing at `GET /brief` (a kiosk HTML view). "Focus now / next / N waiting."
- **Web pane (optional)** — a focused dashboard, only if the briefs aren't enough. Host on a subdomain the user already owns, not a new domain.

## Add-a-surface recipe (scalability)
1. Consume `GET /brief` (or a new read query) — never write from a glass surface.
2. Render. Done. No schema or brain change.

## Fixed-time delivery
Claude Tag pushes "when it thinks you need to know"; for an 08:00-sharp ritual, back it with a trivial scheduled message. Belt and braces.
