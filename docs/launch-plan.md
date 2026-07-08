# Launch Plan — LMSpend

Goal: $5K MRR in ~6 months, $0 paid spend. Mechanism: free viral CLI → build-in-public audience → coordinated multi-channel launch → recurring content flywheel.

## Phase 0 — Before writing much code (week 0)

- [ ] Pick final name; check simultaneously: npm package, .dev/.com domain, X handle, GitHub org.
- [ ] Create X account; bio = one-liner; pin a "building this" thread.
- [ ] Verify Codex CLI local log format (decides P0 vs P1 adapter).

## Phase 1 — Build in public (weeks 1–4, while building CLI)

Audience target before any launch: 500–2,000 X followers who want the tool.

Post 3–5x/week on X. Content that works (from research):
- Your own spend screenshots ("Claude Code cost me $61 yesterday. Worth it? Thread.")
- Reverse-engineering findings ("Here's what's inside Claude Code's local JSONL logs")
- Pricing-chaos commentary (Cursor July 1 change reactions = free reach right now)
- Build progress with real terminal output, not mockups

Communities — be useful FIRST, never drop links early:
- r/ClaudeAI, r/cursor, r/ChatGPTCoding, r/ExperiencedDevs (spend threads appear weekly)
- Indie Hackers: start a build log
- Relevant Discords (Cursor, Anthropic dev communities)

## Phase 2 — Soft launch: free CLI only (week 3–4)

The CLI launches ALONE. No paywall visible anywhere. Sequence:
1. X thread: "I built a free CLI that shows what you actually spend across Claude Code / Cursor / Codex. Here's my number: $847/mo." (your real card as the image)
2. Same day: r/ClaudeAI + r/cursor posts (different tone — helpful, not promotional)
3. 2–3 days later, after fixing first bugs: **Show HN: LMSpend – see what you actually spend on AI coding tools**
   - HN title formula: plain, technical, no hype words
   - First comment: technical write-up — how log parsing works, the dedup problem, cost-estimation math, privacy design. HN 2026 rewards technical depth.
   - Respond to every comment for the first 4 hours (this decides ranking)
4. Inside CLI from day one: "Get this report emailed monthly →" (email capture)

Success bar: 1,000+ installs, 200+ emails, 300+ GitHub stars.

## Phase 3 — Revenue launch: dashboard (weeks 6–8)

Coordinated same-day launch, 4–6 channels, same core message, different tone per channel:

| Channel | Asset |
|---|---|
| X | Thread with CLI traction numbers + dashboard demo GIF |
| Product Hunt | Full listing; first comment = founder story; line up 10–15 supporters to engage (engage, not vote-beg) in hour 1; launch 12:01am PT Tue–Thu |
| Indie Hackers | Transparent numbers post: "5,000 installs, 0 revenue. Today I launch the paid layer." |
| Show HN (2nd) | Only if dashboard has a technical story; otherwise skip — don't burn HN goodwill |
| Subreddits | "I launched the paid version of that spend CLI" follow-ups where the CLI post did well |
| Email list | Launch email with founder discount (20% off 3 months, 72h window) |

## Phase 4 — Compounding (months 2–6)

- **Monthly "State of AI Coding Spend" report** from opt-in anonymized aggregates — the citable, backlink-earning content engine. Post as blog + X thread + IH post every month.
- SEO pages: "claude code pricing calculator", "cursor vs claude code cost", "how much does ai coding cost" — high-intent queries with thin competition.
- Ship Cursor adapter = second launch moment ("LMSpend now supports Cursor").
- Every pricing change by any vendor = a same-day blog post + thread (recurring free reach).
- Monthly email report re-triggers share loop every month.

## Anti-goals

- No paid ads (premise of the whole plan).
- No launching everything at once on day 1 with zero audience — that's the failure mode >50% of solo projects hit.
- No engagement-bait or fake numbers — this audience detects it and it's fatal on HN.
