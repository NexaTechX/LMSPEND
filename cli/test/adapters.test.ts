import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectCodexFromDir } from '../src/adapters/codex.js';
import { parseCursorEvents } from '../src/adapters/cursor.js';
import { parseImportEvents } from '../src/adapters/imported.js';
import { aggregate } from '../src/aggregate.js';
import type { Adapter, UsageEvent } from '../src/types.js';

describe('codex adapter', () => {
  it('parses rollout token_count events with model/cwd context', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lmspend-codex-'));
    const day = join(dir, '2026', '07', '05');
    await mkdir(day, { recursive: true });
    const lines = [
      JSON.stringify({ timestamp: '2026-07-05T09:00:00Z', type: 'session_meta', payload: { type: 'session_meta', model: 'gpt-5.2-codex', cwd: 'C:/work/myapp' } }),
      'not json at all',
      JSON.stringify({ timestamp: '2026-07-05T09:01:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 1000, cached_input_tokens: 400, output_tokens: 200 } } } }),
      JSON.stringify({ timestamp: '2026-07-05T09:02:00Z', type: 'event_msg', payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 0, output_tokens: 0 } } } }),
    ];
    await writeFile(join(day, 'rollout-1.jsonl'), lines.join('\n'), 'utf8');

    const events: UsageEvent[] = [];
    for await (const e of collectCodexFromDir(dir)) events.push(e);

    expect(events).toHaveLength(1);
    expect(events[0].tool).toBe('codex');
    expect(events[0].model).toBe('gpt-5.2-codex');
    expect(events[0].project).toBe('myapp');
    expect(events[0].inputTokens).toBe(600); // input minus cached
    expect(events[0].cacheReadTokens).toBe(400);
    expect(events[0].outputTokens).toBe(200);
  });
});

describe('import parsing', () => {
  it('accepts valid events and normalizes them', () => {
    const events = parseImportEvents(JSON.stringify([
      { timestamp: '2026-07-01T10:00:00Z', model: 'gpt-5.2', inputTokens: 100, outputTokens: 50 },
      { timestamp: '2026-07-02T10:00:00Z', costUsd: 1.23 },
    ]));
    expect(events).toHaveLength(2);
    expect(events[0].tool).toBe('imported');
    expect(events[1].costOverride).toBe(1.23);
  });

  it('rejects events without timestamp or without any value', () => {
    expect(() => parseImportEvents(JSON.stringify([{ inputTokens: 5 }]))).toThrow(/timestamp/);
    expect(() => parseImportEvents(JSON.stringify([{ timestamp: '2026-07-01T00:00:00Z' }]))).toThrow(/tokens or costUsd/);
    expect(() => parseImportEvents(JSON.stringify({ not: 'array' }))).toThrow(/array/);
  });
});

describe('cursor adapter parser', () => {
  it('uses Cursor invoice-exact chargedCents as costOverride', () => {
    const events = parseCursorEvents([
      {
        timestamp: '1751500800000', userEmail: 'me@co.com', model: 'claude-sonnet-5',
        chargedCents: 237, isChargeable: true,
        tokenUsage: { inputTokens: 12000, outputTokens: 3400, cacheReadTokens: 8000, cacheWriteTokens: 500 },
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].tool).toBe('cursor');
    expect(events[0].costOverride).toBeCloseTo(2.37, 6); // 237 cents
    expect(events[0].model).toBe('claude-sonnet-5');
    expect(events[0].inputTokens).toBe(12000);
  });

  it('skips free/no-op events (no cost, no tokens)', () => {
    expect(parseCursorEvents([{ timestamp: '1751500800000', chargedCents: 0 }])).toHaveLength(0);
  });

  it('ignores events with a missing/invalid timestamp', () => {
    expect(parseCursorEvents([{ chargedCents: 100 } as never])).toHaveLength(0);
  });
});

describe('costOverride in aggregation', () => {
  it('prefers the tool-computed cost over the pricing table', async () => {
    const adapter: Adapter = {
      tool: 'cline',
      async detect() { return { available: true, detail: '' }; },
      async *collect() {
        yield {
          timestamp: '2026-07-05T10:00:00Z', tool: 'cline', model: 'whatever',
          project: 'p', inputTokens: 1_000_000, outputTokens: 0,
          cacheReadTokens: 0, cacheWriteTokens: 0, costOverride: 0.5,
        };
      },
    };
    const agg = await aggregate([adapter], '2026-07');
    expect(agg.totalCost).toBeCloseTo(0.5, 6);
    expect(agg.approximatePricing.size).toBe(0); // no table lookup happened
  });
});
