// Server-side feature loader. Discovers `feat-*.ts` files in this directory at runtime and
// calls each one's default export with the Express router. Feature branches add a single
// self-contained file here -- no edits to runtime.ts -- so parallel waves never conflict.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Router } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadServerFeatures(router: Router): Promise<void> {
  try {
    const files = fs
      .readdirSync(__dirname)
      .filter((f) => f.startsWith('feat-') && (f.endsWith('.ts') || f.endsWith('.js')));
    for (const f of files) {
      try {
        const mod = await import(`./${f}`);
        const reg = (mod as { default?: unknown }).default ?? mod;
        if (typeof reg === 'function') reg(router);
        else if (reg && typeof (reg as { register?: unknown }).register === 'function') {
          (reg as { register: (r: Router) => void }).register(router);
        }
      } catch (err) {
        console.warn(`[features] failed to load ${f}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.warn('[features] loader error:', err instanceof Error ? err.message : err);
  }
}
