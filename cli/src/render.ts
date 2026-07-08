import type { Aggregates, Bucket } from './types.js';
import { loadPricing, priceFor } from './pricing.js';
import { loadConfig, monthlyFlatCost, roiMultiple } from './config.js';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR && !process.argv.includes('--no-color');
const c = {
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
};

export function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function sortedByCost(map: Map<string, Bucket>, limit = 10): Array<[string, Bucket]> {
  return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, limit);
}

function section(title: string, rows: Array<[string, Bucket]>, extra?: (b: Bucket) => string): string[] {
  if (!rows.length) return [];
  const nameWidth = Math.max(...rows.map(([k]) => k.length), 12) + 2;
  const lines = [c.bold(title)];
  for (const [name, b] of rows) {
    const tail = extra ? `  ${c.dim(extra(b))}` : '';
    lines.push(`  ${name.padEnd(nameWidth)}${usd(b.cost).padStart(10)}${tail}`);
  }
  lines.push('');
  return lines;
}

/** ROI framing + flat subscriptions from ~/.lmspend.json. */
function roiLines(agg: Aggregates): string[] {
  const cfg = loadConfig();
  const subs = cfg.subscriptions ?? [];
  if (!cfg.plan && subs.length === 0) return [];

  const flat = monthlyFlatCost(cfg);
  const lines = [c.bold('  what you actually pay (flat)')];
  if (cfg.plan) lines.push(`  ${cfg.plan.name.padEnd(20)}${usd(cfg.plan.monthly).padStart(10)}`);
  for (const s of subs) lines.push(`  ${s.name.padEnd(20)}${usd(s.monthly).padStart(10)}`);
  if (cfg.plan && subs.length > 0) {
    lines.push(`  ${'total flat'.padEnd(20)}${usd(flat).padStart(10)}`);
  }

  const roi = roiMultiple(agg.totalCost, cfg);
  if (roi !== null) {
    lines.push(
      `  ${'API-priced value'.padEnd(20)}${usd(agg.totalCost).padStart(10)}` +
        c.dim('  what this usage would cost at list prices'),
      `  ${c.bold(c.yellow(`ROI: ${roi.toFixed(1)}× your flat cost`))}`,
    );
  }
  lines.push('');
  return lines;
}

/** --explain: show the exact math per model so anyone can audit the estimate. */
function explainLines(agg: Aggregates): string[] {
  const pricing = loadPricing();
  const lines = [c.bold('  the math (per million tokens)'), ''];
  for (const [model, b] of sortedByCost(agg.byModel, 20)) {
    const { pricing: p, approximate } = priceFor(model);
    const M = 1_000_000;
    lines.push(`  ${model}${approximate ? c.yellow(' (~family/fallback rate)') : ''}`);
    lines.push(c.dim(`    input       ${fmtTokens(b.inputTokens).padStart(8)} × $${p.input}/M      = ${usd((b.inputTokens / M) * p.input)}`));
    lines.push(c.dim(`    output      ${fmtTokens(b.outputTokens).padStart(8)} × $${p.output}/M      = ${usd((b.outputTokens / M) * p.output)}`));
    lines.push(c.dim(`    cache read  ${fmtTokens(b.cacheReadTokens).padStart(8)} × $${p.cacheRead}/M      = ${usd((b.cacheReadTokens / M) * p.cacheRead)}`));
    lines.push(c.dim(`    cache write ${fmtTokens(b.cacheWriteTokens).padStart(8)} × $${p.cacheWrite}/M      = ${usd((b.cacheWriteTokens / M) * p.cacheWrite)}`));
    lines.push(`    subtotal    ${usd(b.cost).padStart(10)}`);
    lines.push('');
  }
  lines.push(c.dim(`  pricing table ${pricing.updatedAt} — override any rate in the table, or PRs welcome.`));
  lines.push('');
  return lines;
}

export function renderReport(agg: Aggregates, opts: { explain?: boolean } = {}): string {
  const lines: string[] = [];
  const pricing = loadPricing();

  const deltaPct = agg.prevMonthCost > 0
    ? ((agg.totalCost - agg.prevMonthCost) / agg.prevMonthCost) * 100
    : null;
  const delta = deltaPct === null
    ? ''
    : deltaPct >= 0
      ? c.red(` (+${deltaPct.toFixed(0)}% vs last month)`)
      : c.green(` (${deltaPct.toFixed(0)}% vs last month)`);

  lines.push('');
  lines.push(`  ${c.bold(`AI Coding Spend — ${agg.month}`)}`);
  lines.push(`  ${c.bold(c.cyan(`est. total: ${usd(agg.totalCost)}`))}${delta}`);
  lines.push('');

  lines.push(...roiLines(agg));

  lines.push(...section('  by tool', sortedByCost(agg.byTool),
    (b) => `${fmtTokens(b.inputTokens + b.cacheReadTokens + b.cacheWriteTokens)} in / ${fmtTokens(b.outputTokens)} out`));
  lines.push(...section('  by model', sortedByCost(agg.byModel),
    (b) => `${fmtTokens(b.inputTokens + b.cacheReadTokens + b.cacheWriteTokens)} in / ${fmtTokens(b.outputTokens)} out`));
  lines.push(...section('  by project (top 10)', sortedByCost(agg.byProject)));

  const days = sortedByCost(agg.byDay, 5);
  if (days.length) {
    lines.push(c.bold('  most expensive days'));
    for (const [day, b] of days) {
      lines.push(`  ${day.padEnd(14)}${usd(b.cost).padStart(10)}`);
    }
    lines.push('');
  }

  if (opts.explain) lines.push(...explainLines(agg));

  if (agg.approximatePricing.size) {
    lines.push(c.dim(`  ~ approximate pricing used for: ${[...agg.approximatePricing].join(', ')}`));
  }
  lines.push(c.dim(`  Estimates at API list prices (pricing table ${pricing.updatedAt}). Audit them: --explain`));
  lines.push(c.dim(`  Share your bill: lmspend share`));
  lines.push('');
  return lines.join('\n');
}

export function renderShareCard(agg: Aggregates): string {
  const cfg = loadConfig();
  const roi = roiMultiple(agg.totalCost, cfg);
  const topModel = sortedByCost(agg.byModel, 1)[0];
  const topDay = sortedByCost(agg.byDay, 1)[0];

  const rows = roi !== null && cfg.plan
    ? [
        `My AI coding month — ${agg.month}`,
        ``,
        `${usd(agg.totalCost)} of API-priced value`,
        `on my ${usd(monthlyFlatCost(cfg))}/mo plan → ${roi.toFixed(1)}× ROI`,
        topModel ? `Top model: ${topModel[0]}` : '',
        ``,
        `Get yours: npx lmspend`,
      ]
    : [
        `My AI coding bill — ${agg.month}`,
        ``,
        `Total (est.): ${usd(agg.totalCost)}`,
        topModel ? `Top model: ${topModel[0]} (${usd(topModel[1].cost)})` : '',
        topDay ? `Most expensive day: ${topDay[0]} (${usd(topDay[1].cost)})` : '',
        ``,
        `Get yours: npx lmspend`,
      ];
  return rows.filter((r) => r !== '').join('\n');
}

export function renderJson(agg: Aggregates): string {
  const cfg = loadConfig();
  const roi = roiMultiple(agg.totalCost, cfg);
  const toObj = (m: Map<string, Bucket>) => Object.fromEntries(m);
  return JSON.stringify(
    {
      month: agg.month,
      estimatedTotalUsd: +agg.totalCost.toFixed(4),
      previousMonthUsd: +agg.prevMonthCost.toFixed(4),
      plan: cfg.plan ?? null,
      roiMultiple: roi === null ? null : +roi.toFixed(2),
      byTool: toObj(agg.byTool),
      byModel: toObj(agg.byModel),
      byProject: toObj(agg.byProject),
      byDay: toObj(agg.byDay),
      approximatePricingModels: [...agg.approximatePricing],
      skippedLines: agg.skippedLines,
      disclaimer: 'Estimates at API list prices from bundled pricing table.',
    },
    null,
    2,
  );
}
