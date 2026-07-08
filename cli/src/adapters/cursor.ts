import type { Adapter, UsageEvent } from '../types.js';
import { loadConfig } from '../config.js';

/**
 * Cursor — via the official Team Admin API (POST /teams/filtered-usage-events).
 * Cursor returns invoice-exact cost per event in `chargedCents`, so we trust
 * that number directly (costOverride) instead of estimating from tokens.
 *
 * Setup: add to ~/.lmspend.json:
 *   "cursor": { "adminApiKey": "key_...", "email": "you@company.com" }
 * The Admin API key comes from Cursor → Dashboard → Settings → Admin API keys
 * (team admins only). `email` filters to your own usage so a teammate's sync
 * doesn't double-count the same events.
 *
 * No key configured → detected as "not configured" with setup guidance; never
 * guesses, never fails the whole report.
 */

const ENDPOINT = 'https://api.cursor.com/teams/filtered-usage-events';
const WINDOW_DAYS = 95; // trailing window: covers current + previous month for deltas
const PAGE_SIZE = 100;
const MAX_PAGES = 100; // safety cap (10k events)

interface CursorTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
}

interface CursorEvent {
  timestamp?: string | number;
  userEmail?: string;
  model?: string;
  chargedCents?: number;
  isChargeable?: boolean;
  tokenUsage?: CursorTokenUsage;
}

interface CursorResponse {
  pagination?: { hasNextPage?: boolean; currentPage?: number };
  usageEvents?: CursorEvent[];
}

/** Pure parser (unit-testable): Cursor events → normalized UsageEvents. */
export function parseCursorEvents(events: CursorEvent[]): UsageEvent[] {
  const out: UsageEvent[] = [];
  for (const e of events) {
    const ts = e.timestamp;
    const ms = typeof ts === 'string' ? Number(ts) : ts;
    if (!ms || !Number.isFinite(ms)) continue;

    const cents = typeof e.chargedCents === 'number' && Number.isFinite(e.chargedCents) ? e.chargedCents : 0;
    const tu = e.tokenUsage ?? {};
    const hasTokens = (tu.inputTokens ?? 0) + (tu.outputTokens ?? 0) > 0;
    if (cents === 0 && !hasTokens) continue; // skip free/no-op events

    out.push({
      timestamp: new Date(ms).toISOString(),
      tool: 'cursor',
      model: e.model || 'cursor',
      project: 'cursor', // Cursor's API doesn't expose a repo/workspace
      inputTokens: tu.inputTokens ?? 0,
      outputTokens: tu.outputTokens ?? 0,
      cacheReadTokens: tu.cacheReadTokens ?? 0,
      cacheWriteTokens: tu.cacheWriteTokens ?? 0,
      costOverride: cents / 100, // invoice-exact; do not re-estimate
    });
  }
  return out;
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

async function fetchPage(
  apiKey: string, startDate: number, endDate: number, page: number, email?: string,
): Promise<CursorResponse> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { authorization: authHeader(apiKey), 'content-type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, page, pageSize: PAGE_SIZE, ...(email ? { email } : {}) }),
  });
  if (!res.ok) {
    throw new Error(`Cursor API ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
  return (await res.json()) as CursorResponse;
}

export const cursorAdapter: Adapter = {
  tool: 'cursor',

  async detect() {
    const cfg = loadConfig().cursor;
    if (!cfg) {
      return { available: false, detail: 'not configured — add a Cursor Admin API key to ~/.lmspend.json (see /cursor)' };
    }
    try {
      const now = Date.now();
      const res = await fetchPage(cfg.adminApiKey, now - 86_400_000, now, 1, cfg.email);
      const n = res.usageEvents?.length ?? 0;
      return { available: true, detail: `connected via Admin API${cfg.email ? ` (${cfg.email})` : ''} — ${n}+ recent event(s)` };
    } catch (err) {
      return { available: false, detail: `key set but request failed: ${err instanceof Error ? err.message : err}` };
    }
  },

  async *collect(): AsyncGenerator<UsageEvent> {
    const cfg = loadConfig().cursor;
    if (!cfg) return;

    const endDate = Date.now();
    const startDate = endDate - WINDOW_DAYS * 86_400_000;

    for (let page = 1; page <= MAX_PAGES; page++) {
      let res: CursorResponse;
      try {
        res = await fetchPage(cfg.adminApiKey, startDate, endDate, page, cfg.email);
      } catch {
        return; // a mid-report API failure shouldn't crash everything; doctor surfaces it
      }
      for (const ev of parseCursorEvents(res.usageEvents ?? [])) yield ev;
      if (!res.pagination?.hasNextPage) break;
    }
  },
};
