#!/usr/bin/env node
/**
 * knowledge-universe/sync.ts
 *
 * Enhancement 31 — Incremental markdown sync to knowledge universe.
 *
 * Watch a directory tree for `.md` file changes and auto-ingest them.
 * Uses Node's `fs.watch` with recursive traversal and debounces rapid
 * bursts of changes.
 *
 * Route (wired in server.ts):
 *   POST /api/knowledge/sync/start -> { ok: true, watching: <path> }
 *   POST /api/knowledge/sync/stop  -> { ok: true }
 */

import { watch, stat } from 'node:fs';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeHandler = (filePath: string) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

let watchers: { dir: string; watcher: ReturnType<typeof watch> }[] = [];
let debounce: ReturnType<typeof setTimeout> | null = null;
let onChange: ChangeHandler | null = null;

function watchRecursive(dir: string): void {
  try {
    const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.md')) return;
      if (eventType !== 'change' && eventType !== 'rename') return;

      const fullPath = join(dir, filename);
      stat(fullPath, () => {
        if (onChange) {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => onChange!(fullPath), 400);
        }
      });
    });

    watchers.push({ dir, watcher });
  } catch {
    // ignore directories we can't watch
  }
}

/**
 * Start watching `dir` for markdown changes.
 */
export function startWatch(dir: string, handler: ChangeHandler): () => void {
  stopWatch();
  onChange = handler;
  watchRecursive(dir);
  return stopWatch;
}

/**
 * Stop all active watchers.
 */
export function stopWatch(): void {
  for (const w of watchers) {
    try { w.watcher.close(); } catch {}
  }
  watchers.length = 0;
  if (debounce) clearTimeout(debounce);
  debounce = null;
  onChange = null;
}

/**
 * Return whether the watcher is currently active.
 */
export function isWatching(): boolean {
  return watchers.length > 0;
}
