import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, UsageEvent } from '../types.js';

/**
 * Universal escape hatch: any tool, gateway, or invoice you can export can be
 * counted. `lmspend import <file.json>` validates and copies event files
 * into ~/.lmspend/imports/; this adapter reads them back on every report.
 *
 * File format: JSON array of events —
 * [{ "timestamp": "2026-07-01T10:00:00Z", "model": "gpt-5.2", "project": "x",
 *    "inputTokens": 1000, "outputTokens": 200,
 *    "cacheReadTokens": 0, "cacheWriteTokens": 0, "costUsd": 0.05 }]
 * `costUsd` is optional — without it we price from the bundled table.
 */

export const IMPORTS_DIR = join(homedir(), '.lmspend', 'imports');

interface RawImport {
  timestamp?: string;
  model?: string;
  project?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
}

export function parseImportEvents(json: string): UsageEvent[] {
  const arr = JSON.parse(json) as RawImport[];
  if (!Array.isArray(arr)) throw new Error('import file must be a JSON array of events');

  const events: UsageEvent[] = [];
  for (const [i, r] of arr.entries()) {
    if (typeof r.timestamp !== 'string' || Number.isNaN(Date.parse(r.timestamp))) {
      throw new Error(`event ${i}: valid ISO "timestamp" required`);
    }
    const nums = [r.inputTokens, r.outputTokens, r.cacheReadTokens, r.cacheWriteTokens, r.costUsd];
    if (nums.some((n) => n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0))) {
      throw new Error(`event ${i}: token counts and costUsd must be non-negative numbers`);
    }
    if (!r.inputTokens && !r.outputTokens && r.costUsd === undefined) {
      throw new Error(`event ${i}: needs tokens or costUsd`);
    }
    events.push({
      timestamp: new Date(r.timestamp).toISOString(),
      tool: 'imported',
      model: typeof r.model === 'string' && r.model ? r.model : 'unknown',
      project: typeof r.project === 'string' && r.project ? r.project : 'imported',
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      cacheReadTokens: r.cacheReadTokens ?? 0,
      cacheWriteTokens: r.cacheWriteTokens ?? 0,
      ...(r.costUsd !== undefined ? { costOverride: r.costUsd } : {}),
    });
  }
  return events;
}

export const importedAdapter: Adapter = {
  tool: 'imported',

  async detect() {
    if (!existsSync(IMPORTS_DIR)) {
      return { available: false, detail: 'none — add any tool via: lmspend import <file.json>' };
    }
    const files = (await readdir(IMPORTS_DIR)).filter((f) => f.endsWith('.json'));
    return { available: files.length > 0, detail: `${files.length} import file(s)` };
  },

  async *collect(): AsyncGenerator<UsageEvent> {
    if (!existsSync(IMPORTS_DIR)) return;
    for (const file of (await readdir(IMPORTS_DIR)).filter((f) => f.endsWith('.json'))) {
      try {
        yield* parseImportEvents(await readFile(join(IMPORTS_DIR, file), 'utf8'));
      } catch {
        // A bad import file shouldn't break the whole report; doctor will surface it.
      }
    }
  },
};
