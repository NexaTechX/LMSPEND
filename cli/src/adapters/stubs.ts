import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, Tool, UsageEvent } from '../types.js';

/**
 * Tools we detect but can't yet parse reliable local usage from. Honest
 * "found it, adapter coming" beats silently wrong numbers. Until then:
 * flat-rate tools go in ~/.lmspend.json subscriptions; anything with an
 * export goes through `lmspend import`.
 */

function stub(tool: Tool, label: string, probePaths: string[], note: string): Adapter {
  return {
    tool,
    async detect() {
      const found = probePaths.some((p) => existsSync(p));
      return {
        available: false,
        detail: found ? `${label} detected — ${note}` : 'not detected',
      };
    },
    // eslint-disable-next-line require-yield
    async *collect(): AsyncGenerator<UsageEvent> {
      return;
    },
  };
}

const home = homedir();

export const geminiAdapter = stub(
  'gemini-cli', 'Gemini CLI',
  [join(home, '.gemini')],
  'adapter coming; meanwhile use `lmspend import`',
);

export const aiderAdapter = stub(
  'aider', 'Aider',
  [join(home, '.aider'), join(home, '.aider.conf.yml')],
  'adapter coming; meanwhile use `lmspend import`',
);

export const opencodeAdapter = stub(
  'opencode', 'OpenCode',
  [
    join(home, '.local', 'share', 'opencode'),
    join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'opencode'),
  ],
  'adapter coming; meanwhile use `lmspend import`',
);
