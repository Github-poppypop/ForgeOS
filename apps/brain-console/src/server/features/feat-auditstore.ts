// Durable audit-log store with size-based rotation.
//
// This is ADDITIVE and conflict-free: it does NOT touch feat-auditexport.ts or
// runtime.ts. The existing audit export (GET /api/audit/export) remains as-is.
// What this adds:
//   * Durable append-only persistence to logs/audit.jsonl
//   * SIZE-BASED rotation: when the current file exceeds ~5MB it is rotated to
//     audit.N.jsonl, keeping up to 5 generations (audit.1..audit.5.jsonl).
//   * A fast in-memory ring buffer mirror (cap 500) for quick reads.
//
// Endpoints (all under the shared feature router):
//   POST /api/audit/append              body = audit entry object -> durable append
//   GET  /api/audit/store               recent entries (ring buffer, newest first)
//   GET  /api/audit/store?format=jsonl  stream the current audit.jsonl
//   GET  /api/audit/store/meta          { bytes, generations, lines }
//
// The audit entry shape follows auditExport.ts's AuditEntry (ts/method/path/status/ms/ip)
// but is intentionally permissive: any JSON object is accepted and stored as-is, with a
// server-stamped `ts` when missing.
import express from 'express';
import type { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/server/features -> apps/brain-console
const BC_ROOT = path.resolve(__dirname, '../../..');
const LOGS_DIR = path.join(BC_ROOT, 'logs');
const CURRENT_FILE = path.join(LOGS_DIR, 'audit.jsonl');
const MAX_BYTES = 5 * 1024 * 1024; // ~5MB
const MAX_GENERATIONS = 5;
const RING_CAP = 500;

type AuditRecord = Record<string, unknown>;

// In-memory ring buffer mirror (newest first), cap RING_CAP.
const ring: AuditRecord[] = [];

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function parseLine(line: string): AuditRecord | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AuditRecord;
    }
  } catch {
    // skip malformed line
  }
  return null;
}

// Preload the ring buffer from the existing current file (last RING_CAP entries).
function loadRing(): void {
  try {
    if (!fs.existsSync(CURRENT_FILE)) return;
    const lines = fs.readFileSync(CURRENT_FILE, 'utf8').split(/\r?\n/);
    const collected: AuditRecord[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const rec = parseLine(lines[i]);
      if (rec) collected.push(rec);
      if (collected.length >= RING_CAP) break;
    }
    ring.length = 0;
    for (const e of collected) ring.push(e);
  } catch {
    // ignore — start empty
  }
}

// Rotate: audit.N -> audit.N+1 (drop audit.5), audit.jsonl -> audit.1, fresh current.
function rotate(): void {
  const oldest = path.join(LOGS_DIR, `audit.${MAX_GENERATIONS}.jsonl`);
  if (fs.existsSync(oldest)) fs.rmSync(oldest);
  for (let n = MAX_GENERATIONS - 1; n >= 1; n--) {
    const src = path.join(LOGS_DIR, `audit.${n}.jsonl`);
    const dst = path.join(LOGS_DIR, `audit.${n + 1}.jsonl`);
    if (fs.existsSync(src)) fs.renameSync(src, dst);
  }
  if (fs.existsSync(CURRENT_FILE)) {
    fs.renameSync(CURRENT_FILE, path.join(LOGS_DIR, 'audit.1.jsonl'));
  }
  fs.writeFileSync(CURRENT_FILE, '');
}

function appendRecord(rec: AuditRecord): void {
  ensureLogsDir();
  const line = JSON.stringify(rec) + '\n';
  fs.appendFileSync(CURRENT_FILE, line);
  ring.unshift(rec);
  if (ring.length > RING_CAP) ring.length = RING_CAP;
  // Rotation is best-effort and runs only when over threshold.
  try {
    const stat = fs.statSync(CURRENT_FILE);
    if (stat.size > MAX_BYTES) rotate();
  } catch {
    // ignore stat/rotate failures
  }
}

function computeMeta(): { bytes: number; generations: number; lines: number } {
  let bytes = 0;
  let lines = 0;
  try {
    if (fs.existsSync(CURRENT_FILE)) {
      const content = fs.readFileSync(CURRENT_FILE, 'utf8');
      bytes = Buffer.byteLength(content, 'utf8');
      lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
    }
  } catch {
    // ignore
  }
  let generations = 0;
  for (let n = 1; n <= MAX_GENERATIONS; n++) {
    if (fs.existsSync(path.join(LOGS_DIR, `audit.${n}.jsonl`))) generations++;
  }
  return { bytes, generations, lines };
}

export default function registerAuditStore(router: Router): void {
  loadRing();

  router.post('/api/audit/append', express.json(), (req, res) => {
    const body = req.body as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'audit entry body must be a JSON object' });
      return;
    }
    const rec = body as AuditRecord;
    if (rec.ts == null || rec.ts === '') rec.ts = new Date().toISOString();
    try {
      appendRecord(rec);
      res.status(201).json({ ok: true, buffered: ring.length });
    } catch (err) {
      res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
    }
  });

  router.get('/api/audit/store', (req, res) => {
    if (req.query.format === 'jsonl') {
      ensureLogsDir();
      if (!fs.existsSync(CURRENT_FILE)) fs.writeFileSync(CURRENT_FILE, '');
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      const stream = fs.createReadStream(CURRENT_FILE);
      stream.on('error', () => res.status(404).end());
      stream.pipe(res);
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(ring);
  });

  router.get('/api/audit/store/meta', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(computeMeta());
  });
}
