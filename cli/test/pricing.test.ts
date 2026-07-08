import { describe, expect, it } from 'vitest';
import { eventCost, priceFor } from '../src/pricing.js';

describe('priceFor', () => {
  it('matches exact model ids', () => {
    const { pricing, approximate } = priceFor('claude-sonnet-5');
    expect(approximate).toBe(false);
    expect(pricing.input).toBeGreaterThan(0);
  });

  it('matches full model ids containing a known id', () => {
    const { approximate } = priceFor('claude-fable-5-20260101');
    expect(approximate).toBe(false);
  });

  it('falls back to family rates for unknown versions', () => {
    const { approximate } = priceFor('claude-sonnet-9');
    expect(approximate).toBe(true);
  });

  it('falls back to default for fully unknown models', () => {
    const { pricing, approximate } = priceFor('mystery-model-3000');
    expect(approximate).toBe(true);
    expect(pricing.input).toBeGreaterThan(0);
  });
});

describe('eventCost', () => {
  it('computes cost per million tokens', () => {
    const { pricing } = priceFor('claude-sonnet-5');
    const { cost } = eventCost('claude-sonnet-5', 1_000_000, 0, 0, 0);
    expect(cost).toBeCloseTo(pricing.input, 6);
  });

  it('includes all four token classes', () => {
    const { pricing } = priceFor('claude-sonnet-5');
    const { cost } = eventCost('claude-sonnet-5', 1_000_000, 1_000_000, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(
      pricing.input + pricing.output + pricing.cacheRead + pricing.cacheWrite,
      6,
    );
  });

  it('is zero for zero tokens', () => {
    expect(eventCost('claude-sonnet-5', 0, 0, 0, 0).cost).toBe(0);
  });
});
