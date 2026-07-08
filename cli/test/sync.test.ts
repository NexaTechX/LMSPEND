import { describe, expect, it } from 'vitest';
import { syncPayload } from '../src/sync.js';
import type { Aggregates, Bucket } from '../src/types.js';

const bucket = (cost: number): Bucket => ({
  cost, inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0, events: 1,
});

describe('syncPayload privacy', () => {
  it('hashes project names before upload', () => {
    const agg: Aggregates = {
      month: '2026-07',
      totalCost: 12.5,
      prevMonthCost: 0,
      byTool: new Map([['claude-code', bucket(12.5)]]),
      byModel: new Map([['claude-sonnet-5', bucket(12.5)]]),
      byProject: new Map([['super-secret-client-project', bucket(12.5)]]),
      byDay: new Map([['2026-07-05', bucket(12.5)]]),
      skippedLines: 0,
      approximatePricing: new Set(),
    };
    const payload = syncPayload(agg);
    expect(payload).not.toContain('super-secret-client-project');
    const parsed = JSON.parse(payload) as { byProject: Record<string, unknown> };
    const keys = Object.keys(parsed.byProject);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[a-f0-9]{12}$/); // sha256 prefix, nothing readable
  });
});
