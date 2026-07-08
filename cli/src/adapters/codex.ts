import { createReadStream, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Adapter, UsageEvent } from '../types.js';

/**
 * OpenAI Codex CLI — session rollouts at ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
 *
 * Each line is JSON `{ timestamp, type, payload }`. We track the active model
 * and cwd from `session_meta` / `turn_context` lines, and emit a UsageEvent per
 * `token_count` line using `payload.info.last_token_usage` (per-turn deltas,
 * not the cumulative totals). Cached input is billed at cache-read rates.
 *
 * Parsing is defensive: unknown shapes are skipped and counted, never fatal —
 * `lmspend doctor` reports the skip count.
 */

const CODEX_DIR = join(homedir(), '.codex');
const SESSIONS_DIR = join(CODEX_DIR, 'sessions');

interface RolloutLine {
  timestamp?: string;
  type?: string;
  payload?: {
    type?: string;
    model?: string;
    cwd?: string;
    info?: {
      last_token_usage?: {
        input_tokens?: number;
        cached_input_tokens?: number;
        output_tokens?: number;
      };
    };
  };
}

export let codexSkippedLines = 0;

function projectFromCwd(cwd: string | undefined): string {
  if (!cwd) return 'unknown';
  return basename(cwd.replace(/[\\/]+$/, '')) || 'unknown';
}

async function* jsonlFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonlFiles(full);
    else if (entry.name.endsWith('.jsonl')) yield full;
  }
}

export async function* collectCodexFromDir(sessionsDir: string): AsyncGenerator<UsageEvent> {
  if (!existsSync(sessionsDir)) return;

  for await (const file of jsonlFiles(sessionsDir)) {
    let model = 'gpt-5.1-codex'; // overwritten by session_meta/turn_context when present
    let project = 'unknown';

    const rl = createInterface({
      input: createReadStream(file, 'utf8'),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      let rec: RolloutLine;
      try {
        rec = JSON.parse(line) as RolloutLine;
      } catch {
        codexSkippedLines++;
        continue;
      }

      const p = rec.payload;
      if (!p) continue;

      if (p.type === 'session_meta' || p.type === 'turn_context') {
        if (typeof p.model === 'string' && p.model) model = p.model;
        if (typeof p.cwd === 'string' && p.cwd) project = projectFromCwd(p.cwd);
        continue;
      }

      if (p.type === 'token_count' && rec.timestamp) {
        const u = p.info?.last_token_usage;
        if (!u) continue;
        const input = u.input_tokens ?? 0;
        const cached = Math.min(u.cached_input_tokens ?? 0, input);
        const output = u.output_tokens ?? 0;
        if (input === 0 && output === 0) continue;

        yield {
          timestamp: rec.timestamp,
          tool: 'codex',
          model,
          project,
          inputTokens: input - cached,
          outputTokens: output,
          cacheReadTokens: cached,
          cacheWriteTokens: 0,
        };
      }
    }
  }
}

export const codexAdapter: Adapter = {
  tool: 'codex',

  async detect() {
    if (!existsSync(CODEX_DIR)) return { available: false, detail: 'not detected' };
    if (!existsSync(SESSIONS_DIR)) {
      return { available: false, detail: 'Codex found, but no session logs yet' };
    }
    let count = 0;
    for await (const _f of jsonlFiles(SESSIONS_DIR)) count++;
    return { available: count > 0, detail: `${count} session log(s)` };
  },

  async *collect(): AsyncGenerator<UsageEvent> {
    yield* collectCodexFromDir(SESSIONS_DIR);
  },
};
