#!/usr/bin/env node
/**
 * knowledge-universe/audit.ts
 *
 * Enhancement 38 — Audit trail viewer.
 *
 * Append-only log of page changes.  Each entry is a JSON line so the file
 * can be tailed and rotated without corrupting history.
 *
 * Routes (wired in server.ts):
 *   POST /api/knowledge/audit   body: { slug, action, user?, details? } -> { ok: true }
 *   GET  /api/knowledge/audit?slug=&limit=  -> AuditEntry[]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_FILE = join(__dirname, '.data', 'audit.jsonl');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  slug: string;
  action: string;
  user?: string;
  ts: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a new audit entry.
 */
export async function appendAudit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  const fullEntry: AuditEntry = { ...entry, ts: new Date().toISOString() };
  try {
    const dir = dirname(AUDIT_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(AUDIT_FILE, JSON.stringify(fullEntry) + '\n', { flag: 'a' });
  } catch {
    // ignore write errors
  }
}

/**
 * Read audit entries.  Optionally filter by `slug`.  Returns the most
 * recent `limit` entries (default 100).
 */
export async function getAudit(slug?: string, limit: number = 100): Promise<AuditEntry[]> {
  const entries: AuditEntry[] = [];
  try {
    if (!existsSync(AUDIT_FILE)) return entries;

    const content = readFileSync(AUDIT_FILE, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    const slice = lines.slice(-limit * 2); // read a bit more, then filter

    for (const line of slice) {
      try {
        const entry = JSON.parse(line) as AuditEntry;
        if (!slug || entry.slug === slug) {
          entries.push(entry);
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // ignore read errors
  }

  return entries.slice(-limit);
}
