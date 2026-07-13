# LMSpend

[![GitHub](https://img.shields.io/badge/GitHub-NexaTechX%2FLMSPEND-181717?logo=github)](https://github.com/NexaTechX/LMSPEND)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Open-source** cost visibility for AI coding tools — Claude Code, Cursor, Codex, and more — with a free, local-first CLI and an optional hosted dashboard.

- **CLI (free):** read usage from logs already on your machine, estimate spend, print shareable cards
- **Dashboard (hosted SaaS):** sync history, budgets, alerts, team views, share links

Repo: [github.com/NexaTechX/LMSPEND](https://github.com/NexaTechX/LMSPEND) · App: [lmspend.vercel.app](https://lmspend.vercel.app)

## Why open source

AI spend tools that proxy your traffic or demand a cloud account first are a non-starter for many teams. LMSpend is local-first: adapters read vendor logs on disk; your code never leaves the machine unless you opt in to sync.

Opening the source means you can audit the cost math, add adapters, and self-host if you want. We monetize the hosted dashboard (convenience, history, alerts, teams) — not lock-in on the CLI.

## Quick start (CLI)

```bash
npx lmspend              # current-month report
npx lmspend share        # shareable card
npx lmspend tools        # which adapters were detected
```

Or from this repo:

```bash
cd cli
npm install
npm run dev            # = lmspend report for the current month
npm run dev share
npm run dev tools
```

## Repo layout

| Path | What |
|---|---|
| [cli/](cli/) | Free CLI — TypeScript, zero runtime deps; adapters for Claude Code, Codex, Cline, Roo Code + universal `import`; ROI mode, share cards, opt-in sync |
| [dashboard/](dashboard/) | Next.js hosted dashboard — sync API, spend UI, billing, share links, alert emails |
| [docs/PRD.md](docs/PRD.md) | Product requirements |
| [docs/CLI-SPEC.md](docs/CLI-SPEC.md) | CLI commands, adapters, cost math |
| [docs/payments.md](docs/payments.md) | Billing notes |

## Contributing

Issues and PRs are welcome — especially new tool adapters, pricing updates, and CLI UX.

1. Fork [NexaTechX/LMSPEND](https://github.com/NexaTechX/LMSPEND)
2. Create a branch (`git checkout -b feat/my-adapter`)
3. Make a focused change; match existing style
4. Open a PR with a short “why” and how you tested it

For larger changes, open an issue first so we can align on scope.

## Self-hosting vs hosted

| | CLI | Self-hosted dashboard | Hosted (lmspend.vercel.app) |
|---|---|---|---|
| Cost estimates from local logs | ✓ | ✓ | ✓ (via sync) |
| History, budgets, alerts, teams | — | if you run it | ✓ |
| Billing / support | — | you own ops | us |

The CLI stays free. Paid plans fund the hosted product.

## License

**Recommended: [MIT](https://opensource.org/licenses/MIT)** — already declared on the CLI (`cli/package.json`).

MIT fits an open-source CLI + SaaS dashboard well:

- Anyone can use, modify, and redistribute (including commercial use)
- You keep selling the hosted service, support, and team features
- Contributors and enterprises recognize it; low friction to adopt and fork
- Simple to comply with (keep the copyright notice)
