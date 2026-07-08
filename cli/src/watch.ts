import { existsSync, watch as fsWatch, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter } from './types.js';
import { aggregate } from './aggregate.js';
import { sync, type SyncResult } from './sync.js';

/**
 * Real-time tracking: watch the local log directories and re-sync within
 * seconds of a coding turn finishing. A periodic timer also re-syncs so
 * API-based sources (Cursor) stay fresh even without a local file change.
 */

const DEBOUNCE_MS = 3000;
const PERIODIC_MS = 60_000;

function watchDirs(): string[] {
  const h = homedir();
  const dirs = [
    join(h, '.claude', 'projects'),
    join(h, '.codex', 'sessions'),
  ];
  if (process.platform === 'win32') {
    dirs.push(join(process.env.APPDATA ?? join(h, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage'));
  } else if (process.platform === 'darwin') {
    dirs.push(join(h, 'Library', 'Application Support', 'Code', 'User', 'globalStorage'));
  } else {
    dirs.push(join(h, '.config', 'Code', 'User', 'globalStorage'));
  }
  return dirs.filter(existsSync);
}

export interface WatchHandle {
  stop(): void;
}

export interface WatchCallbacks {
  onSync(totalUsd: number, result: SyncResult): void;
  onError(err: unknown): void;
}

export async function startWatch(
  adapters: Adapter[],
  month: string,
  url: string,
  apiKey: string,
  cb: WatchCallbacks,
): Promise<WatchHandle> {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const doSync = async () => {
    if (running) return; // coalesce overlapping syncs
    running = true;
    try {
      const agg = await aggregate(adapters, month);
      const res = await sync(agg, url, apiKey);
      cb.onSync(agg.totalCost, res);
    } catch (err) {
      cb.onError(err);
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(doSync, DEBOUNCE_MS);
  };

  await doSync(); // initial push on start

  const watchers: FSWatcher[] = [];
  for (const dir of watchDirs()) {
    try {
      watchers.push(fsWatch(dir, { recursive: true }, schedule));
    } catch {
      // recursive watch unsupported on some platforms; periodic timer still covers it
    }
  }
  const periodic = setInterval(doSync, PERIODIC_MS);

  return {
    stop() {
      if (debounce) clearTimeout(debounce);
      clearInterval(periodic);
      for (const w of watchers) {
        try { w.close(); } catch { /* already closed */ }
      }
    },
  };
}
