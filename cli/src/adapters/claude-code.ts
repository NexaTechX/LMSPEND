import { createReadStream, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline';
import type { Adapter, UsageEvent } from '../types.js';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/** Claude Code project dirs are slugified absolute paths; last segment ≈ folder name. */
function projectNameFromSlug(slug: string): string {
  const parts = slug.split('-').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : slug;
}

interface RawLine {
  timestamp?: string;
  requestId?: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

export let skippedLines = 0;

export const claudeCodeAdapter: Adapter = {
  tool: 'claude-code',

  async detect() {
    if (!existsSync(PROJECTS_DIR)) {
      return { available: false, detail: `no data found (looked in ${PROJECTS_DIR})` };
    }
    const projects = (await readdir(PROJECTS_DIR, { withFileTypes: true })).filter((d) => d.isDirectory());
    return { available: projects.length > 0, detail: `${projects.length} project(s) with local history` };
  },

  async *collect(): AsyncGenerator<UsageEvent> {
    if (!existsSync(PROJECTS_DIR)) return;
    const seen = new Set<string>();

    const projectDirs = (await readdir(PROJECTS_DIR, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dir of projectDirs) {
      const project = projectNameFromSlug(dir);
      const dirPath = join(PROJECTS_DIR, dir);
      const files = (await readdir(dirPath)).filter((f) => f.endsWith('.jsonl'));

      for (const file of files) {
        const rl = createInterface({
          input: createReadStream(join(dirPath, file), 'utf8'),
          crlfDelay: Infinity,
        });

        for await (const line of rl) {
          if (!line.trim()) continue;
          let rec: RawLine;
          try {
            rec = JSON.parse(line) as RawLine;
          } catch {
            skippedLines++;
            continue;
          }

          const usage = rec.message?.usage;
          const model = rec.message?.model;
          if (!usage || !model || model === '<synthetic>' || !rec.timestamp) continue;

          // Streaming rewrites duplicate assistant records across lines/files:
          // count each (message.id, requestId) pair once.
          if (rec.message?.id && rec.requestId) {
            const key = `${rec.message.id}:${rec.requestId}`;
            if (seen.has(key)) continue;
            seen.add(key);
          }

          yield {
            timestamp: rec.timestamp,
            tool: 'claude-code',
            model,
            project,
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            cacheReadTokens: usage.cache_read_input_tokens ?? 0,
            cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
          };
        }
      }
    }
  },
};
