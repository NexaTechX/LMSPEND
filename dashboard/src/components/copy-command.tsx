'use client';

import { useState } from 'react';

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (http, permissions) — the text is selectable anyway.
    }
  }

  return (
    <span className="cmd">
      <span className="dollar">$</span>
      <span>{command}</span>
      <button
        type="button"
        onClick={copy}
        className="btn btn-ghost btn-sm"
        aria-label={`Copy command: ${command}`}
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </span>
  );
}
