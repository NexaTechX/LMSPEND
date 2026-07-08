import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ModelPricing, PricingTable } from './types.js';

let table: PricingTable | null = null;

export function loadPricing(): PricingTable {
  if (table) return table;
  const here = dirname(fileURLToPath(import.meta.url));
  // pricing.json lives at package root, one level up from dist/ (or src/ in dev)
  const raw = readFileSync(join(here, '..', 'pricing.json'), 'utf8');
  table = JSON.parse(raw) as PricingTable;
  return table;
}

export interface PriceMatch {
  pricing: ModelPricing;
  approximate: boolean;
}

/** Exact model id match, else family prefix match, else fallback (marked approximate). */
export function priceFor(model: string): PriceMatch {
  const t = loadPricing();
  const normalized = model.toLowerCase();

  for (const [id, pricing] of Object.entries(t.models)) {
    if (normalized.includes(id)) return { pricing, approximate: false };
  }
  for (const [family, pricing] of Object.entries(t.families)) {
    if (normalized.includes(family)) return { pricing, approximate: true };
  }
  return { pricing: t.fallback, approximate: true };
}

export function eventCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
): { cost: number; approximate: boolean } {
  const { pricing, approximate } = priceFor(model);
  const M = 1_000_000;
  const cost =
    (inputTokens / M) * pricing.input +
    (outputTokens / M) * pricing.output +
    (cacheReadTokens / M) * pricing.cacheRead +
    (cacheWriteTokens / M) * pricing.cacheWrite;
  return { cost, approximate };
}
