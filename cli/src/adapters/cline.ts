import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter, Tool, UsageEvent } from '../types.js';

/**
 * Cline and Roo Code (VS Code extensions) — task history in VS Code's
 * globalStorage. Each task folder has ui_messages.json whose
 * `say: "api_req_started"` entries carry tool-computed usage in their `text`
 * JSON: { tokensIn, tokensOut, cacheWrites, cacheReads, cost }.
 * We trust the extension's own `cost` when present (costOverride).
 */

function vscodeGlobalStorage(): string[] {
  const home = homedir();
  const roots =
    process.platform === 'win32'
      ? [join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage')]
      : process.platform === 'darwin'
        ? [join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage')]
        : [join(home, '.config', 'Code', 'User', 'globalStorage')];
  return roots;
}

const EXTENSIONS: Array<{ id: string; tool: Tool }> = [
  { id: 'saoudrizwan.claude-dev', tool: 'cline' },
  { id: 'rooveterinaryinc.roo-cline', tool: 'roo-code' },
];

interface UiMessage {
  ts?: number;
  type?: string;
  say?: string;
  text?: string;
}

interface ApiReqInfo {
  tokensIn?: number;
  tokensOut?: number;
  cacheWrites?: number;
  cacheReads?: number;
  cost?: number;
  model?: string;
}

async function* collectExtension(storageDir: string, extId: string, tool: Tool): AsyncGenerator<UsageEvent> {
  const tasksDir = join(storageDir, extId, 'tasks');
  if (!existsSync(tasksDir)) return;

  const tasks = await readdir(tasksDir, { withFileTypes: true });
  for (const task of tasks) {
    if (!task.isDirectory()) continue;
    const uiPath = join(tasksDir, task.name, 'ui_messages.json');
    if (!existsSync(uiPath)) continue;

    let messages: UiMessage[];
    try {
      messages = JSON.parse(await readFile(uiPath, 'utf8')) as UiMessage[];
      if (!Array.isArray(messages)) continue;
    } catch {
      continue;
    }

    for (const m of messages) {
      if (m.say !== 'api_req_started' || !m.text || !m.ts) continue;
      let info: ApiReqInfo;
      try {
        info = JSON.parse(m.text) as ApiReqInfo;
      } catch {
        continue;
      }
      const tokensIn = info.tokensIn ?? 0;
      const tokensOut = info.tokensOut ?? 0;
      if (tokensIn === 0 && tokensOut === 0 && !info.cost) continue;

      yield {
        timestamp: new Date(m.ts).toISOString(),
        tool,
        model: info.model ?? 'unknown',
        project: `${tool}-tasks`, // extension storage doesn't record the workspace
        inputTokens: tokensIn,
        outputTokens: tokensOut,
        cacheReadTokens: info.cacheReads ?? 0,
        cacheWriteTokens: info.cacheWrites ?? 0,
        ...(typeof info.cost === 'number' && info.cost >= 0 ? { costOverride: info.cost } : {}),
      };
    }
  }
}

function makeAdapter(extId: string, tool: Tool, label: string): Adapter {
  return {
    tool,
    async detect() {
      for (const root of vscodeGlobalStorage()) {
        const dir = join(root, extId, 'tasks');
        if (existsSync(dir)) {
          const count = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).length;
          return { available: count > 0, detail: `${count} task(s) in VS Code storage` };
        }
      }
      return { available: false, detail: `${label} not detected` };
    },
    async *collect(): AsyncGenerator<UsageEvent> {
      for (const root of vscodeGlobalStorage()) {
        yield* collectExtension(root, extId, tool);
      }
    },
  };
}

export const clineAdapter = makeAdapter('saoudrizwan.claude-dev', 'cline', 'Cline');
export const rooCodeAdapter = makeAdapter('rooveterinaryinc.roo-cline', 'roo-code', 'Roo Code');
