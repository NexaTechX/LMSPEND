import type { Adapter, Aggregates, Bucket, UsageEvent } from './types.js';
import { eventCost } from './pricing.js';
import { skippedLines } from './adapters/claude-code.js';

function emptyBucket(): Bucket {
  return { cost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, events: 0 };
}

function add(map: Map<string, Bucket>, key: string, e: UsageEvent, cost: number): void {
  const b = map.get(key) ?? emptyBucket();
  b.cost += cost;
  b.inputTokens += e.inputTokens;
  b.outputTokens += e.outputTokens;
  b.cacheReadTokens += e.cacheReadTokens;
  b.cacheWriteTokens += e.cacheWriteTokens;
  b.events += 1;
  map.set(key, b);
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function aggregate(
  adapters: Adapter[],
  month: string,
  toolFilter?: string,
): Promise<Aggregates> {
  const agg: Aggregates = {
    month,
    totalCost: 0,
    prevMonthCost: 0,
    byTool: new Map(),
    byModel: new Map(),
    byProject: new Map(),
    byDay: new Map(),
    skippedLines: 0,
    approximatePricing: new Set(),
  };
  const prev = prevMonth(month);

  for (const adapter of adapters) {
    if (toolFilter && adapter.tool !== toolFilter) continue;
    for await (const e of adapter.collect()) {
      const m = monthOf(e.timestamp);
      if (m !== month && m !== prev) continue;

      let cost: number;
      if (typeof e.costOverride === 'number' && Number.isFinite(e.costOverride) && e.costOverride >= 0) {
        cost = e.costOverride; // the source tool computed this itself
      } else {
        const priced = eventCost(
          e.model, e.inputTokens, e.outputTokens, e.cacheReadTokens, e.cacheWriteTokens,
        );
        cost = priced.cost;
        if (priced.approximate) agg.approximatePricing.add(e.model);
      }

      if (m === prev) {
        agg.prevMonthCost += cost;
        continue;
      }

      agg.totalCost += cost;
      add(agg.byTool, e.tool, e, cost);
      add(agg.byModel, e.model, e, cost);
      add(agg.byProject, e.project, e, cost);
      add(agg.byDay, e.timestamp.slice(0, 10), e, cost);
    }
  }

  agg.skippedLines = skippedLines;
  return agg;
}
