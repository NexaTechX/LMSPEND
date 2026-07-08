import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * User config at ~/.lmspend.json:
 * {
 *   "plan": { "name": "Claude Max", "monthly": 200 },
 *   "subscriptions": [{ "name": "Copilot", "monthly": 19 }],
 *   "url": "https://your-dashboard.example.com"
 * }
 * `plan` unlocks ROI mode: usage is framed as API-priced value vs. what the
 * flat plan actually costs. `subscriptions` are other flat fees to include.
 */

export interface FlatFee {
  name: string;
  monthly: number;
}

/** Cursor Team Admin API access (Cursor → Dashboard → Settings → Admin API keys). */
export interface CursorConfig {
  adminApiKey: string;
  /** Filter to just your own usage (recommended so team syncs don't double-count). */
  email?: string;
}

export interface UserConfig {
  plan?: FlatFee;
  subscriptions?: FlatFee[];
  url?: string;
  cursor?: CursorConfig;
}

let cached: UserConfig | null = null;

export function loadConfig(): UserConfig {
  if (cached) return cached;
  try {
    const raw = readFileSync(join(homedir(), '.lmspend.json'), 'utf8');
    const parsed = JSON.parse(raw) as UserConfig;
    cached = {
      plan: validFee(parsed.plan),
      subscriptions: (parsed.subscriptions ?? []).map(validFee).filter((f): f is FlatFee => !!f),
      url: typeof parsed.url === 'string' ? parsed.url : undefined,
      cursor: validCursor(parsed.cursor),
    };
  } catch {
    cached = {};
  }
  return cached;
}

function validCursor(c: unknown): CursorConfig | undefined {
  if (typeof c !== 'object' || c === null) return undefined;
  const cur = c as Record<string, unknown>;
  if (typeof cur.adminApiKey !== 'string' || !cur.adminApiKey) return undefined;
  return {
    adminApiKey: cur.adminApiKey,
    email: typeof cur.email === 'string' && cur.email ? cur.email : undefined,
  };
}

function validFee(f: unknown): FlatFee | undefined {
  if (typeof f !== 'object' || f === null) return undefined;
  const fee = f as Record<string, unknown>;
  if (typeof fee.name === 'string' && typeof fee.monthly === 'number' && fee.monthly >= 0) {
    return { name: fee.name, monthly: fee.monthly };
  }
  return undefined;
}

export function monthlyFlatCost(cfg: UserConfig): number {
  return (cfg.plan?.monthly ?? 0) + (cfg.subscriptions ?? []).reduce((s, f) => s + f.monthly, 0);
}

/** ROI of a flat plan: API-priced value ÷ what you actually pay. */
export function roiMultiple(apiValueUsd: number, cfg: UserConfig): number | null {
  const flat = monthlyFlatCost(cfg);
  if (!cfg.plan || flat <= 0) return null;
  return apiValueUsd / flat;
}
