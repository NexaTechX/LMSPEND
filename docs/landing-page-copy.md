# Landing Page Copy — LMSpend (working name)

> Tone: developer-to-developer, dry, numbers-forward. No marketing fluff — the HN crowd smells it instantly.

---

## Meta

- **Title tag:** LMSpend — Know what you actually spend on AI coding tools
- **Meta description:** One dashboard for your Claude Code, Cursor, and Codex spend. Free open-source CLI, local-first, no proxy. See your real AI coding bill in 10 seconds.

---

## Hero

**H1:** Your AI coding bill, finally in one place.

**Subhead:** You're running 2 or 3 AI coding agents. Each one bills you differently, and none of them will tell you what you spend on the others. LMSpend reads the usage logs already on your machine and shows you the whole picture — per tool, per model, per project.

**Primary CTA (button):** `npx lmspend` — free, open source
**Secondary CTA:** See the team dashboard →

**Trust line under CTA:** Local-first. No account. No proxy. Your code and prompts never leave your machine.

---

## Social proof strip

> (At launch, replace with real numbers/tweets. Placeholder structure:)

⭐ 1,200 GitHub stars · 📦 5,000 installs · 🐦 "This CLI just told me I spent $312 on a side project I abandoned" — @somedev

---

## Problem section

**H2:** Agentic coding is amazing. The invoices are chaos.

Three columns:

1. **Spend is invisible.** A long Claude Code session, a Cursor background agent, a Codex run — each one quietly burns usage. You find out at invoice time.
2. **Every vendor shows a different slice.** Cursor shows Cursor. Anthropic shows Anthropic. Nobody shows the total, and the total is what your card gets charged.
3. **Teams fly blind.** Five seats, three tools, usage-based overages. The person who approves the budget has the least visibility of anyone.

---

## How it works

**H2:** Ten seconds to your real number.

1. **Run it.** `npx lmspend` — no config, no account. It finds the usage logs your tools already write locally.
2. **Read it.** Total estimated spend, broken down by tool → model → project → day. Deltas vs. last month. Your most expensive day, named and shamed.
3. **Share it (if you dare).** `lmspend share` renders a card of your monthly bill for X. Misery loves company.

Code block on page (real output sample):

```
  AI Coding Spend — June 2026            est. total: $847.20  (+31%)

  by tool                     by model
  Claude Code      $612.40    claude-fable-5        $498.10
  Cursor           $198.30    claude-sonnet-5       $114.30
  Codex CLI         $36.50    gpt-5.2-codex          $36.50

  most expensive day: Jun 24 — $94.70 (that refactor, probably)
```

---

## Dashboard section (the paid pitch)

**H2:** For teams: budgets, alerts, and no more invoice surprises.

- **One roll-up for every seat and every tool.** Who's spending what, on which projects.
- **Budget alerts before the invoice.** "Slack me when the team crosses $400." Done.
- **Per-project attribution.** Bill clients accurately. Kill the side project that's eating your margin.
- **Expense-ready exports.** CSV and PDF your finance person will actually accept.

**CTA:** Start free — sync your first month in 2 minutes

---

## Privacy section (do not cut this)

**H2:** Local-first, or it doesn't ship.

- The CLI is open source (MIT) and makes **zero network calls** by default.
- Syncing to the dashboard is opt-in and sends **aggregates only** — token counts, costs, hashed project names. Never code. Never prompts. Never file paths.
- Don't trust us? Read the source. Pipe `--json` into your own tools instead.

---

## Pricing

| | CLI | Solo | Team |
|---|---|---|---|
| Price | **Free forever** | **$19/mo** | **$49/mo** (5 seats) |
| Local reports & share cards | ✓ | ✓ | ✓ |
| History & trends | — | ✓ | ✓ |
| Monthly email report | — | ✓ | ✓ |
| Budget alerts (email/Slack) | — | ✓ | ✓ |
| Team roll-up & workspaces | — | — | ✓ |
| CSV / expense export | — | — | ✓ |
| Extra seats | | | $8/seat |

---

## FAQ

**Is this another LLM proxy/gateway?**
No. We never touch your traffic. The CLI reads usage logs your tools already write to disk, after the fact.

**How accurate are the numbers?**
They're estimates computed from your actual token counts × published model pricing (including cache pricing). We show the math, and you can override the pricing table. Subscription flat fees are added from your config.

**Which tools are supported?**
Claude Code and Codex CLI at launch. Cursor next (join the waitlist). Copilot as a config-declared flat rate.

**Does my employer see my data?**
Only if you join a team workspace, and then only aggregates — never your code or prompts.

**Why is the CLI free?**
Because the report is only valuable if everyone can run it. Teams pay for history, alerts, and roll-ups.

---

## Final CTA

**H2:** Find out what last month actually cost you.

`npx lmspend`

*(Fair warning: the number is usually higher than you think.)*
