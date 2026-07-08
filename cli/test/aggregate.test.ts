import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/aggregate.js';
import type { Adapter, UsageEvent } from '../src/types.js';

function fakeAdapter(events: UsageEvent[]): Adapter {
  return {
    tool: 'claude-code',
    async detect() {
      return { available: true, detail: 'fake' };
    },
    async *collect() {
      yield* events;
    },
  };
}

const ev = (over: Partial<UsageEvent>): UsageEvent => ({
  timestamp: '2026-07-05T10:00:00Z',
  tool: 'claude-code',
  model: 'claude-sonnet-5',
  project: 'demo',
  inputTokens: 1000,
  outputTokens: 500,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...over,
});

describe('aggregate', () => {
  it('buckets events by tool, model, project, and day', async () => {
    const agg = await aggregate(
      [fakeAdapter([
        ev({}),
        ev({ project: 'other', timestamp: '2026-07-06T10:00:00Z' }),
      ])],
      '2026-07',
    );
    expect(agg.byTool.size).toBe(1);
    expect(agg.byProject.size).toBe(2);
    expect(agg.byDay.size).toBe(2);
    expect(agg.totalCost).toBeGreaterThan(0);
  });

  it('excludes other months from totals but tracks previous month', async () => {
    const agg = await aggregate(
      [fakeAdapter([
        ev({}),
        ev({ timestamp: '2026-06-15T10:00:00Z', inputTokens: 2_000_000 }),
        ev({ timestamp: '2026-01-15T10:00:00Z', inputTokens: 9_000_000 }),
      ])],
      '2026-07',
    );
    expect(agg.prevMonthCost).toBeGreaterThan(0);
    expect(agg.byDay.has('2026-06-15')).toBe(false);
    expect(agg.byDay.has('2026-01-15')).toBe(false);
  });

  it('respects the tool filter', async () => {
    const agg = await aggregate([fakeAdapter([ev({})])], '2026-07', 'cursor');
    expect(agg.totalCost).toBe(0);
  });
});
