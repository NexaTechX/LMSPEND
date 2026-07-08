# PRD — LMSpend (working name)

**One-liner:** One dashboard for everything you spend on AI coding tools — Claude Code, Cursor, Codex, Copilot — with a free CLI that turns your monthly AI bill into a shareable report.

**Status:** Draft v1 · July 2026
**Owner:** Founder (solo)
**Working name:** LMSpend (`lmspend` CLI) — final name TBD

---

## 1. Problem

Developers in 2026 run an average of **2.3 AI coding tools at once** (typical stack: Cursor for editing, Claude Code for agentic work, Copilot for legacy/client projects). Agentic workflows make 10–100x more LLM calls than chat. Consequences:

- Nobody knows what they actually spend across tools. Each vendor shows its own partial number, in its own place, with its own billing cycle.
- Usage-based overages are unpredictable and spiky (one long agentic session can cost $50+).
- Small teams already pay **$200–$500/month** in base subscriptions before overages, and team leads have zero cross-tool visibility, no budgets, and no alerts.
- Pricing changes constantly (Cursor's July 1, 2026 change being the latest), so people can't reason about which tool to route work to.

Existing options are enterprise LLM gateways (Requesty, Helicone, etc.) that require routing your traffic through a proxy. Nothing is local-first, indie-priced, and works with the tools' own logs after the fact.

## 2. Solution

Two products, one funnel:

1. **Free CLI (the growth engine).** Runs locally, reads usage logs the tools already write to disk, and prints a beautiful terminal report: total spend, spend per tool, per model, per project, most expensive day. Ends with a shareable card ("My June AI coding bill: $847"). Zero accounts, zero telemetry by default, open source.
2. **Paid web dashboard (the business).** Sync CLI data to the cloud (opt-in): historical trends, team roll-ups across seats, budget alerts to Slack/email, per-project cost attribution, CSV/expense export.

**Privacy stance (a core selling point):** local-first. The CLI never sends data anywhere unless the user explicitly runs `lmspend sync`. Only aggregate numbers (tokens, costs, project name hashes) leave the machine — never code, never prompts.

## 3. Goals & success metrics

| Goal | Metric | Target |
|---|---|---|
| Viral top-of-funnel | CLI installs (npm) | 5,000 in first 90 days |
| Launch traction | HN front page OR 500+ PH upvotes OR 100K X impressions | 1 of 3 at launch |
| Conversion | Free CLI → paid dashboard | ≥ 3% |
| Revenue | MRR | $1K by month 3, **$5K by month 6** |
| Retention | Paid logo churn | < 6%/month |

**North-star metric:** weekly active CLI report runs (leading indicator of everything else).

## 4. Personas

**P1 — Solo dev / indie hacker ("Sam").** Pays out of pocket for Claude Code + Cursor. Winces at the monthly bill but doesn't know where it goes. Lives on X and HN. Wants: the free report, project-level attribution ("client work vs. side project"), and a number to screenshot. Converts to solo plan for history + monthly email report.

**P2 — Team lead at a 5–20 person startup ("Priya").** Approves the AI tooling budget. Gets surprise overage invoices. Wants: team roll-up, budget alerts before the invoice, per-seat and per-project breakdown for planning and expense reports. This is the real revenue persona.

## 5. Scope

### v1 — Free CLI (weeks 1–2) — P0

- `lmspend report` — current month report in the terminal: total est. spend, breakdown by tool → model → project → day; top-5 most expensive days; deltas vs. last month.
- **Adapters:** Claude Code (P0, local JSONL logs), Codex CLI (P0 if logs accessible, else P1), Cursor (P1 — via its usage export/API), Copilot (P2 — flat rate, config-declared).
- `lmspend report --json` — machine-readable output (lets power users build on it; good HN cred).
- `lmspend share` — renders a share card (text block v1, PNG v1.1) sized for X.
- Cost math from a bundled, versioned pricing table (per-model $/MTok incl. cache pricing). Clearly labeled **estimates**.
- Zero runtime dependencies, no account, no network calls. Open source (MIT).

### v1.5 — Funnel hooks (week 3) — P0

- `lmspend sync` — opt-in upload of aggregates to the dashboard (requires free account).
- Email capture in CLI: "Get this report emailed monthly" (free tier of the dashboard).
- PNG share-card generation.

### v2 — Paid dashboard (weeks 3–6) — P0 for revenue

- Auth (email magic link + GitHub OAuth), billing via Merchant of Record (Dodo Payments — Stripe unavailable in Nigeria; USD pricing unchanged; see [payments.md](payments.md)).
- History & trends (spend over time, by tool/model/project).
- **Budgets & alerts:** "Slack/email me at $X" per team or per project.
- Team workspaces: invite members, roll-up across seats.
- Export: CSV / expense-report PDF.

### Out of scope (explicitly)

- Proxying/routing LLM traffic (that's the gateway market — different product, different trust bar).
- Non-coding LLM spend (API keys for production apps) — maybe later.
- Cost *optimization* recommendations — v3 upsell at best.

## 6. The viral loop (spec'd, not hoped for)

1. Dev sees a share card on X → installs CLI (`npx lmspend`).
2. First run takes < 10 seconds, zero config, immediately shows a surprising number.
3. Report ends with: "Share your bill → `lmspend share`" which copies a formatted card + opens the X intent URL.
4. Card footer contains the install command — every share is an ad.
5. Monthly email report (free) re-engages and re-triggers sharing every month.

**Aggregate content flywheel:** monthly "State of AI Coding Spend" blog post from opt-in anonymized data — citable, linkable, recurring.

## 7. Pricing

| Plan | Price | Includes |
|---|---|---|
| CLI | Free forever, OSS | Local reports, share cards, JSON output |
| Solo | $19/mo | Sync, history, monthly email, budget alerts, 1 seat |
| Team | $49/mo (up to 5 seats) + $8/extra seat | Everything + workspaces, Slack alerts, roll-ups, export |

Path to $5K MRR: ~120 Solo + ~55 Team ≈ $5.0K. At 5,000 CLI installs that's a ~3.5% blended conversion.

All prices in USD worldwide. Billing runs through a Merchant of Record (Dodo Payments at launch, Paddle as scale-up option) because the founder is Nigeria-based and Stripe is unavailable there — the MoR charges customers in USD, handles global sales tax, and pays out in USD. MoR fees (~4–5%) ≈ $250/mo at $5K MRR. Details: [payments.md](payments.md).

## 8. Architecture

- **CLI:** Node + TypeScript, zero runtime deps, published to npm. Reads local logs (e.g. Claude Code JSONL under `~/.claude/projects/`). Pricing table ships in the package; `lmspend update-pricing` pulls the latest JSON from our repo.
- **Dashboard:** Next.js + Postgres (Supabase or Neon) + Dodo Payments (MoR) behind a thin `BillingProvider` interface. Boring on purpose.
- **Sync payload:** aggregates only — `{day, tool, model, projectHash, tokensIn, tokensOut, cacheRead, cacheWrite, estCost}`.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Vendors change log formats | Adapter architecture; OSS community fixes; format-version pinning; CI canary against sample logs |
| A vendor ships native cross-tool reporting | Unlikely (they won't show competitors' costs); moat = cross-tool + team layer |
| Cost estimates are wrong → trust hit | Label as estimates, show the math, let users override pricing table |
| Cursor doesn't expose usable local data | Ship with Claude Code + Codex only; "Cursor coming" waitlist is itself an email capture |
| Privacy skepticism | OSS CLI, no network by default, aggregate-only sync — say it loudly everywhere |

## 10. Milestones

| Week | Deliverable |
|---|---|
| 1–2 | CLI v1 (Claude Code adapter, report, share text card) → soft-launch to X + r/ClaudeAI |
| 3 | Share PNG, email capture, Codex adapter → **Show HN the CLI** |
| 4–6 | Dashboard MVP + MoR billing → coordinated launch (X, HN, Indie Hackers, Product Hunt, subreddits, same day) |
| 7–12 | Cursor adapter, Slack alerts, State-of-Spend report #1 → $1K MRR |
| by month 6 | Team features mature, SEO/content compounding → **$5K MRR** |

## 11. Open questions

- Final name + domain (check npm, domain, X handle availability together).
- Codex CLI local log format — verify before committing to P0.
- Whether to gate PNG share cards behind free account (more email capture vs. more friction on the viral loop — lean: no gate).
