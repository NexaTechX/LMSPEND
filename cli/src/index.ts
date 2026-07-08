#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { copyFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { claudeCodeAdapter, skippedLines } from './adapters/claude-code.js';
import { clineAdapter, rooCodeAdapter } from './adapters/cline.js';
import { codexAdapter, codexSkippedLines } from './adapters/codex.js';
import { cursorAdapter } from './adapters/cursor.js';
import { IMPORTS_DIR, importedAdapter, parseImportEvents } from './adapters/imported.js';
import { aiderAdapter, geminiAdapter, opencodeAdapter } from './adapters/stubs.js';
import { aggregate } from './aggregate.js';
import { loadConfig } from './config.js';
import { loadPricing } from './pricing.js';
import { renderJson, renderReport, renderShareCard } from './render.js';
import { renderShareSvg } from './share-card.js';
import { publishShare, sync } from './sync.js';
import { startWatch } from './watch.js';

const ADAPTERS = [
  claudeCodeAdapter,
  codexAdapter,
  clineAdapter,
  rooCodeAdapter,
  cursorAdapter,
  geminiAdapter,
  aiderAdapter,
  opencodeAdapter,
  importedAdapter,
];
const DEFAULT_URL = 'https://lmspend.example.com'; // TODO: real domain at launch

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

function baseUrl(args: string[]): string {
  return flagValue(args, '--url') ?? process.env.LMSPEND_URL ?? loadConfig().url ?? DEFAULT_URL;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith('--') ? args[0] : 'report';

  const month = flagValue(args, '--month') ?? currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    console.error(`Invalid --month "${month}" — expected YYYY-MM`);
    process.exit(1);
  }
  const toolFilter = flagValue(args, '--tool');

  switch (command) {
    case 'report': {
      const agg = await aggregate(ADAPTERS, month, toolFilter);
      console.log(
        args.includes('--json')
          ? renderJson(agg)
          : renderReport(agg, { explain: args.includes('--explain') }),
      );
      break;
    }

    case 'share': {
      const agg = await aggregate(ADAPTERS, month, toolFilter);
      const card = renderShareCard(agg);
      console.log('\n' + card + '\n');

      if (args.includes('--card')) {
        const file = `lmspend-${month}.svg`;
        await writeFile(file, renderShareSvg(agg), 'utf8');
        console.log(`Card image written: ${file} (open in a browser, screenshot, attach)\n`);
      }

      if (args.includes('--publish')) {
        try {
          const link = await publishShare(agg, baseUrl(args));
          console.log(`Share link (with preview card): ${link}`);
          console.log(`Post it: https://x.com/intent/post?text=${encodeURIComponent(card + '\n\n' + link)}\n`);
          break;
        } catch (err) {
          console.error(`Couldn't publish: ${err instanceof Error ? err.message : err}`);
          console.error('Falling back to text card.\n');
        }
      }

      console.log(`Post it: https://x.com/intent/post?text=${encodeURIComponent(card)}\n`);
      break;
    }

    case 'sync': {
      const apiKey = flagValue(args, '--key') ?? process.env.LMSPEND_KEY;
      if (!apiKey) {
        console.error('Missing API key: pass --key <key> or set LMSPEND_KEY.');
        console.error('Get one at the dashboard → Settings → API keys.');
        process.exit(1);
      }
      console.log('Syncing aggregates only — costs, token counts, hashed project names.');
      console.log('Never code, never prompts, never file paths.\n');
      const agg = await aggregate(ADAPTERS, month, toolFilter);
      const result = await sync(agg, baseUrl(args), apiKey);
      console.log(`Synced ${result.month} for ${result.user}.`);
      if (typeof result.percentile === 'number') {
        console.log(`You're in the top ${result.percentile}% of synced AI coding spenders this month.`);
      }
      break;
    }

    case 'import': {
      const file = args[1];
      if (!file || file.startsWith('--')) {
        console.error('Usage: lmspend import <events.json>');
        console.error('Format: JSON array of { timestamp, model?, project?, inputTokens?, outputTokens?, cacheReadTokens?, cacheWriteTokens?, costUsd? }');
        process.exit(1);
      }
      let events;
      try {
        events = parseImportEvents(readFileSync(file, 'utf8'));
      } catch (err) {
        console.error(`Invalid import file: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
      await mkdir(IMPORTS_DIR, { recursive: true });
      const dest = join(IMPORTS_DIR, `${Date.now()}-${basename(file)}`);
      await copyFile(file, dest);
      console.log(`Imported ${events.length} event(s) → ${dest}`);
      console.log('They now appear in every report under tool "imported".');
      break;
    }

    case 'watch': {
      const url = baseUrl(args);
      const apiKey = flagValue(args, '--key') ?? process.env.LMSPEND_KEY;
      if (!apiKey) {
        console.error('Missing API key: pass --key <key> or set LMSPEND_KEY.');
        process.exit(1);
      }

      // Confirm the account may stream in real time (paid + toggled on).
      try {
        const res = await fetch(`${url.replace(/\/$/, '')}/api/me`, {
          headers: { authorization: `Bearer ${apiKey}` },
        });
        const me = (await res.json()) as { realtime?: boolean; plan?: string; error?: string };
        if (!res.ok) throw new Error(me.error ?? `status ${res.status}`);
        if (!me.realtime) {
          console.error('Real-time tracking is off for this account.');
          console.error(me.plan === 'free'
            ? 'It is a paid feature — upgrade, then enable "Real-time tracking" in Settings.'
            : 'Enable "Real-time tracking" in your dashboard Settings, then rerun.');
          process.exit(1);
        }
      } catch (err) {
        console.error(`Could not verify account: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }

      console.log('● live — watching local logs, syncing on every change. Ctrl+C to stop.\n');
      const handle = await startWatch(ADAPTERS, month, url, apiKey, {
        onSync: (total, res) => {
          const t = new Date().toLocaleTimeString();
          const pct = typeof res.percentile === 'number' ? ` · top ${res.percentile}%` : '';
          process.stdout.write(`  ● $${total.toFixed(2)} this month · synced ${t}${pct}\n`);
        },
        onError: (err) => {
          process.stdout.write(`  ○ sync failed: ${err instanceof Error ? err.message : err} (still watching)\n`);
        },
      });
      const shutdown = () => { handle.stop(); console.log('\nstopped.'); process.exit(0); };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      await new Promise(() => { /* run until interrupted */ });
      break;
    }

    case 'doctor': {
      const pricing = loadPricing();
      const cfg = loadConfig();
      console.log('');
      console.log(`  node            ${process.version} (${process.platform})`);
      console.log(`  pricing table   ${pricing.updatedAt} (${Object.keys(pricing.models).length} models)`);
      console.log(`  config          ~/.lmspend.json ${cfg.plan || cfg.subscriptions?.length || cfg.url ? 'found' : 'not found (optional)'}`);
      if (cfg.plan) console.log(`                  plan: ${cfg.plan.name} $${cfg.plan.monthly}/mo`);
      console.log('');
      for (const a of ADAPTERS) {
        const { available, detail } = await a.detect();
        console.log(`  ${available ? '✓' : '·'} ${a.tool.padEnd(14)} ${detail}`);
      }
      const agg = await aggregate(ADAPTERS, month, toolFilter);
      console.log('');
      console.log(`  ${month}: ${agg.byModel.size} model(s), ${[...agg.byTool.values()].reduce((s, b) => s + b.events, 0)} usage events, ${skippedLines + codexSkippedLines} malformed line(s) skipped`);
      if (agg.approximatePricing.size) {
        console.log(`  models on approximate rates: ${[...agg.approximatePricing].join(', ')}`);
      }
      console.log('\n  If a tool shows no data but should: check the paths above exist,');
      console.log('  then open an issue with your tool version (never attach the logs themselves).\n');
      break;
    }

    case 'tools': {
      console.log('');
      for (const a of ADAPTERS) {
        const { available, detail } = await a.detect();
        console.log(`  ${available ? '✓' : '·'} ${a.tool.padEnd(14)} ${detail}`);
      }
      console.log('');
      break;
    }

    case 'help':
    default:
      console.log(`
lmspend — see what you actually spend on AI coding tools

Usage:
  lmspend [report]        current-month report (default)
  lmspend share           shareable card for X
  lmspend sync            opt-in: upload monthly aggregates to your dashboard
  lmspend watch           live: keep syncing as you code (paid, enable in Settings)
  lmspend import <file>   count any other tool via a JSON events file
  lmspend doctor          diagnose detection, config, and pricing
  lmspend tools           supported tools & detection status
  lmspend help            this help

Flags:
  --month YYYY-MM            report a specific month
  --tool <name>              filter to one tool
  --json                     machine-readable output
  --explain                  show the exact cost math per model
  --card                     (share) also write an SVG card image
  --publish                  (share) create a public share link with preview card
  --url <dashboard url>      dashboard for sync/publish (or LMSPEND_URL / config)
  --no-color                 plain output

Config (~/.lmspend.json, optional):
  { "plan": { "name": "Claude Max", "monthly": 200 },
    "subscriptions": [{ "name": "Copilot", "monthly": 19 }],
    "cursor": { "adminApiKey": "key_...", "email": "you@company.com" } }
  With a plan set, reports show ROI: API-priced value vs what you actually pay.
  With cursor set, Cursor spend is pulled from its Admin API (invoice-exact).

Local-first: no network calls except sync/--publish, which send aggregates only.
`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
