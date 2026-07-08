# LMSpend

One dashboard for everything you spend on AI coding tools — Claude Code, Cursor, Codex — with a free, local-first CLI that turns your monthly AI bill into a shareable report.

## Repo layout

| Path | What |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements — problem, personas, scope, pricing, metrics, milestones |
| [docs/CLI-SPEC.md](docs/CLI-SPEC.md) | v1 CLI spec — commands, adapters, cost math, success criteria |
| [docs/landing-page-copy.md](docs/landing-page-copy.md) | Full landing page copy, ready to drop into a page |
| [docs/launch-plan.md](docs/launch-plan.md) | Zero-ad-spend launch playbook (X, HN, Indie Hackers, PH) |
| [docs/payments.md](docs/payments.md) | Billing decision: USD pricing via Merchant of Record (Nigeria-compatible, no Stripe) |
| [cli/](cli/) | The CLI — TypeScript, zero runtime deps; adapters for Claude Code, Codex, Cline, Roo Code + universal `import`; ROI mode, share cards, opt-in sync |
| [dashboard/](dashboard/) | Next.js paid dashboard — sync API, spend UI, Kora billing, share links, alert emails (see its README) |

## Run the CLI

```bash
cd cli
npm install
npm run dev            # = lmspend report for the current month
npm run dev share      # shareable card
npm run dev tools      # adapter detection status
```

## Business snapshot

- Free CLI = viral top-of-funnel (shareable "my AI coding bill" cards)
- Paid dashboard = revenue: Solo $19/mo, Team $49/mo (USD, cards via Kora — individual-business friendly for Nigeria) — history, budgets, alerts, share links
- Target: $5K MRR by month 6, $0 paid acquisition
- Before launch: pick final name (npm + domain + X handle), verify Codex log format, verify pricing.json against vendor pages
