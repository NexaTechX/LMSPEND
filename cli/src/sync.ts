import { createHash } from 'node:crypto';
import type { Aggregates, Bucket } from './types.js';
import { loadConfig, monthlyFlatCost, roiMultiple } from './config.js';
import { sortedByCost } from './render.js';

/**
 * Opt-in sync: sends AGGREGATES ONLY to the dashboard — token counts, costs,
 * hashed project names. Never code, never prompts, never file paths.
 */

function hashProject(name: string): string {
  return createHash('sha256').update(name).digest('hex').slice(0, 12);
}

function toObj(m: Map<string, Bucket>, hashKeys = false): Record<string, Bucket> {
  const out: Record<string, Bucket> = {};
  for (const [k, v] of m) out[hashKeys ? hashProject(k) : k] = v;
  return out;
}

export function syncPayload(agg: Aggregates): string {
  const cfg = loadConfig();
  const roi = roiMultiple(agg.totalCost, cfg);
  return JSON.stringify({
    month: agg.month,
    estimatedTotalUsd: +agg.totalCost.toFixed(4),
    planMonthly: cfg.plan ? monthlyFlatCost(cfg) : null,
    roiMultiple: roi === null ? null : +roi.toFixed(2),
    byTool: toObj(agg.byTool),
    byModel: toObj(agg.byModel),
    byProject: toObj(agg.byProject, true),
    byDay: toObj(agg.byDay),
  });
}

export interface SyncResult {
  ok: boolean;
  month: string;
  user: string;
  percentile?: number; // "top X%" of synced spenders this month
}

export async function sync(agg: Aggregates, url: string, apiKey: string): Promise<SyncResult> {
  const endpoint = `${url.replace(/\/$/, '')}/api/sync`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: syncPayload(agg),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`sync failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as SyncResult;
}

/** Publish an anonymous share card; returns the public URL. Aggregate numbers only. */
export async function publishShare(agg: Aggregates, url: string): Promise<string> {
  const cfg = loadConfig();
  const roi = roiMultiple(agg.totalCost, cfg);
  const topModel = sortedByCost(agg.byModel, 1)[0];
  const topDay = sortedByCost(agg.byDay, 1)[0];

  const res = await fetch(`${url.replace(/\/$/, '')}/api/share`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      month: agg.month,
      totalUsd: +agg.totalCost.toFixed(2),
      topModel: topModel?.[0] ?? null,
      topModelUsd: topModel ? +topModel[1].cost.toFixed(2) : null,
      topDay: topDay?.[0] ?? null,
      topDayUsd: topDay ? +topDay[1].cost.toFixed(2) : null,
      planMonthly: cfg.plan ? monthlyFlatCost(cfg) : null,
      roiMultiple: roi === null ? null : +roi.toFixed(1),
    }),
  });
  const body = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !body.url) {
    throw new Error(`publish failed (${res.status}): ${body.error ?? 'unknown error'}`);
  }
  return body.url;
}
