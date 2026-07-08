# CLI v1 Spec — `lmspend`

Free, open-source (MIT), zero-runtime-dependency Node CLI. Local-first: no network calls, no account, no telemetry.

## Commands

### `lmspend` / `lmspend report`

Default command. Prints the current-month report.

Flags:
- `--month YYYY-MM` — report for a specific month (default: current)
- `--json` — machine-readable output instead of the terminal report
- `--tool <claude-code|codex|cursor>` — filter to one tool
- `--no-color` — plain output (also respects `NO_COLOR` env)

Report sections, in order:
1. Header: month, estimated total, % delta vs. previous month
2. By tool (table: tool, est. cost, tokens in/out, sessions)
3. By model (table: model, est. cost, input/output/cache tokens)
4. By project (top 10, with per-project cost; project = workspace folder name)
5. Top 5 most expensive days
6. Footer: pricing-table version + "estimates" disclaimer + share nudge

### `lmspend share`

Renders a share card for the current month:
- v1: formatted text block copied to clipboard + X intent URL printed
- v1.1: PNG (1200×675, X card size) written to cwd

Card contains: month, total, top tool, top model, most expensive day, install command footer (`npx lmspend`). **Never** contains project names.

### `lmspend tools`

Lists supported adapters and whether their data was found on this machine (helps debugging + shows roadmap: "Cursor — coming soon").

### `lmspend update-pricing`

Fetches latest pricing table JSON from the GitHub repo (the only command that touches the network, and it says so).

## Adapters

Common interface — each adapter returns normalized `UsageEvent`s:

```ts
interface UsageEvent {
  timestamp: string;      // ISO
  tool: 'claude-code' | 'codex' | 'cursor';
  model: string;          // raw model id
  project: string;        // workspace/project name (kept local, hashed on sync)
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}
```

### Claude Code (P0 — implemented in scaffold)

- Source: `~/.claude/projects/<project-slug>/*.jsonl` (Windows: `%USERPROFILE%\.claude\projects\...`)
- Parse each line as JSON; keep records with `message.usage` (assistant turns)
- Fields: `message.model`, `message.usage.{input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}`, `timestamp`
- **Dedup:** identical `message.id` + `requestId` pairs appear multiple times across files (streaming re-writes) — count each pair once
- Skip synthetic models (`<synthetic>`) and records without usage
- Project name: decoded from the project directory slug

### Codex CLI (implemented)

- Source: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- Model/cwd tracked from `session_meta` / `turn_context` lines; one event per
  `token_count` line using `payload.info.last_token_usage` (per-turn deltas);
  `cached_input_tokens` billed at cache-read rates
- Defensive: malformed lines skipped and counted (surfaced by `doctor`)

### Cline / Roo Code (implemented)

- Source: VS Code globalStorage (`saoudrizwan.claude-dev` / `rooveterinaryinc.roo-cline`),
  `tasks/*/ui_messages.json` → `say: "api_req_started"` entries
- Uses the extension's own computed `cost` when present (`costOverride` on the event)

### Universal import (implemented)

- `lmspend import <events.json>` — validates and stores under `~/.lmspend/imports/`;
  events appear in every report as tool `imported`
- Event: `{ timestamp, model?, project?, inputTokens?, outputTokens?, cacheReadTokens?, cacheWriteTokens?, costUsd? }`
- This is the escape hatch for ANY tool or gateway with an export

### Cursor (waitlist)

- No stable local usage logs; needs their usage CSV export or admin API
- `lmspend tools` points at the /cursor waitlist page (email capture)

### Gemini CLI / Aider / OpenCode (detection stubs)

- Detected and reported honestly as "adapter coming — use import meanwhile";
  wrong numbers are worse than absent numbers

### Copilot / flat-rate subscriptions (implemented)

- Declared in `~/.lmspend.json` (`{"subscriptions": [{"name": "Copilot", "monthly": 19}]}`)
- Shown in the report's "what you actually pay (flat)" section and included in ROI math

## Cost estimation

- Bundled pricing table: `pricing.json` — per-model `$ / MTok` for input, output, cache read, cache write (5-min & 1-h where applicable), plus `updatedAt` version date
- `cost = in*p.in + out*p.out + cacheRead*p.cacheRead + cacheWrite*p.cacheWrite` (per million tokens)
- Unknown model → fall back to family match (prefix), else a conservative default; report marks these with `~`
- Always labeled "estimated"; subscription users see "what this usage would cost at API prices" framing (that's the shareable number)

## Non-functional

- First run < 10s on a year of logs; stream-parse, don't load whole files
- Zero runtime deps (dev deps: typescript, tsx, vitest only)
- Node ≥ 20; Windows/macOS/Linux paths all handled
- Never crash on malformed lines — skip and count (`--json` includes `skippedLines`)

## Success criteria for v1 ship

- Fresh machine with Claude Code history → `npx lmspend` shows a correct-looking report with zero config
- Report renders correctly in a standard 80-col terminal
- `--json` output is stable enough to script against
