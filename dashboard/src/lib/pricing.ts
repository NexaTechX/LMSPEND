import table from './pricing.json';
import type { SpendBucket } from './store';

/**
 * Verified pricing table (kept in sync with cli/pricing.json). Used to show
 * the per-model cost math in the dashboard — the same breakdown as the CLI's
 * `lmspend --explain`. Some tools (e.g. Cursor) report invoice-exact cost
 * instead of token×rate; we detect that and label it rather than mislead.
 */

interface Rate {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

interface Table {
  updatedAt: string;
  models: Record<string, Rate>;
  families: Record<string, Rate>;
  fallback: Rate;
}

const t = table as Table;

export const pricingUpdatedAt = t.updatedAt;

export function priceFor(model: string): { rate: Rate; approximate: boolean } {
  const m = model.toLowerCase();
  for (const [id, rate] of Object.entries(t.models)) {
    if (m.includes(id)) return { rate, approximate: false };
  }
  for (const [family, rate] of Object.entries(t.families)) {
    if (m.includes(family)) return { rate, approximate: true };
  }
  return { rate: t.fallback, approximate: true };
}

export interface MathLine {
  label: string;
  tokens: number;
  rate: number; // $ per million
  cost: number;
}

export interface ModelMath {
  lines: MathLine[];
  computed: number;
  actual: number;
  approximate: boolean;
  /** True when the stored cost doesn't match token×rate — i.e. the tool reported it directly. */
  toolReported: boolean;
}

const M = 1_000_000;

export function explainModel(model: string, b: SpendBucket): ModelMath {
  const { rate, approximate } = priceFor(model);
  const lines: MathLine[] = [
    { label: 'input', tokens: b.inputTokens, rate: rate.input, cost: (b.inputTokens / M) * rate.input },
    { label: 'output', tokens: b.outputTokens, rate: rate.output, cost: (b.outputTokens / M) * rate.output },
    { label: 'cache read', tokens: b.cacheReadTokens, rate: rate.cacheRead, cost: (b.cacheReadTokens / M) * rate.cacheRead },
    { label: 'cache write', tokens: b.cacheWriteTokens, rate: rate.cacheWrite, cost: (b.cacheWriteTokens / M) * rate.cacheWrite },
  ];
  const computed = lines.reduce((s, l) => s + l.cost, 0);
  // Tolerance: 2% or 1 cent. Beyond that, the cost came from the tool, not our table.
  const toolReported = Math.abs(computed - b.cost) > Math.max(0.01, b.cost * 0.02);
  return { lines, computed, actual: b.cost, approximate, toolReported };
}
