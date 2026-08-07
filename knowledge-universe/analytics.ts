#!/usr/bin/env node
/**
 * knowledge-universe/analytics.ts
 *
 * Enhancement 35 — Page-level analytics.
 *
 * Track and retrieve view counts per page slug.  Persists to a JSON file
 * under `.data/` so counts survive restarts.
 *
 * Routes (wired in server.ts):
 *   POST /api/knowledge/analytics   body: { slug }   -> { ok: true }
 *   GET  /api/knowledge/analytics?slug=  -> { slug: views } | { ...all }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '.data', 'analytics.json');

interface AnalyticsStore {
  [slug: string]: number;
}

function readStore(): AnalyticsStore {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch {
    // ignore corrupt file
  }
  return {};
}

function writeStore(store: AnalyticsStore): void {
  try {
    const dir = dirname(DATA_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // ignore write errors
  }
}

/**
 * Increment the view counter for a page.
 */
export async function trackView(slug: string): Promise<void> {
  const store = readStore();
  store[slug] = (store[slug] || 0) + 1;
  writeStore(store);
}

/**
 * Retrieve view counts.  If `slug` is provided, return only that page.
 * Otherwise return the full map.
 */
export async function getAnalytics(slug?: string): Promise<Record<string, number>> {
  const store = readStore();
  if (slug) {
    return { [slug]: store[slug] || 0 };
  }
  return { ...store };
}
