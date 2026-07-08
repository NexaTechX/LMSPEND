import type { Aggregates, Bucket } from './types.js';
import { usd } from './render.js';
import { loadConfig, monthlyFlatCost, roiMultiple } from './config.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function top(map: Map<string, Bucket>, n: number): Array<[string, Bucket]> {
  return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, n);
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[m - 1]} ${y}`;
}

/** 1200x675 (X card ratio) dark SVG share card. No project names — privacy. */
export function renderShareSvg(agg: Aggregates): string {
  const models = top(agg.byModel, 3);
  const maxCost = models.length ? models[0][1].cost : 1;
  const topDay = top(agg.byDay, 1)[0];
  const cfg = loadConfig();
  const roi = roiMultiple(agg.totalCost, cfg);
  const planFlat = monthlyFlatCost(cfg);

  const deltaPct = agg.prevMonthCost > 0
    ? ((agg.totalCost - agg.prevMonthCost) / agg.prevMonthCost) * 100
    : null;
  const deltaText = deltaPct === null ? '' :
    `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}% vs last month`;
  const deltaColor = deltaPct !== null && deltaPct >= 0 ? '#f85149' : '#3fb950';

  const barRows = models.map(([model, b], i) => {
    const y = 380 + i * 62;
    const w = Math.max(8, (b.cost / maxCost) * 560);
    return `
    <text x="80" y="${y}" fill="#8b949e" font-size="24" font-family="ui-monospace,Consolas,monospace">${esc(model)}</text>
    <rect x="80" y="${y + 12}" width="${w.toFixed(0)}" height="18" rx="4" fill="#2f81f7"/>
    <text x="${80 + w + 16}" y="${y + 27}" fill="#e6edf3" font-size="22" font-family="ui-monospace,Consolas,monospace">${usd(b.cost)}</text>`;
  }).join('');

  return `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="675" fill="#0d1117"/>
  <rect x="40" y="40" width="1120" height="595" rx="24" fill="#161b22" stroke="#30363d" stroke-width="2"/>

  <text x="80" y="130" fill="#8b949e" font-size="30" font-family="ui-monospace,Consolas,monospace">${roi !== null ? 'My AI coding month' : 'My AI coding bill'} — ${esc(monthLabel(agg.month))}</text>

  <text x="80" y="260" fill="#e6edf3" font-size="110" font-weight="bold" font-family="ui-monospace,Consolas,monospace">${usd(agg.totalCost)}</text>
  ${roi !== null
    ? `<text x="80" y="310" fill="#e8b45a" font-size="28" font-family="ui-monospace,Consolas,monospace">${esc(`of API-priced value on a ${usd(planFlat)}/mo plan — ${roi.toFixed(1)}x ROI`)}</text>`
    : deltaText ? `<text x="80" y="310" fill="${deltaColor}" font-size="28" font-family="ui-monospace,Consolas,monospace">${esc(deltaText)}</text>` : ''}
  <text x="720" y="255" fill="#484f58" font-size="24" font-family="ui-monospace,Consolas,monospace">estimated, at API prices</text>

  ${barRows}

  ${topDay ? `<text x="80" y="590" fill="#8b949e" font-size="24" font-family="ui-monospace,Consolas,monospace">most expensive day: ${esc(topDay[0])} (${usd(topDay[1].cost)})</text>` : ''}

  <text x="1120" y="590" text-anchor="end" fill="#2f81f7" font-size="26" font-weight="bold" font-family="ui-monospace,Consolas,monospace">npx lmspend</text>
</svg>
`;
}
