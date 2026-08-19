// Server feature: Mission Scheduler store + management API.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
// This is the schedule store that feat-missionsched-exec.ts imports to fire
// enabled schedules on a tick. Schedules persist to data/missions-schedule.json
// (gitignored runtime artifact, like store.json / webhooks.json).
import type { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/server/features -> ../../../data == apps/brain-console/data
const DATA_DIR = path.resolve(__dirname, '../../../data');
const SCHEDULES_FILE = path.join(DATA_DIR, 'missions-schedule.json');

// Primary scheduling unit is intervalSec (seconds). `cron` is accepted and
// documented for forward-compatibility but the executor computes nextRun purely
// from intervalSec. If a schedule has no intervalSec it falls back to 60s.
export interface Schedule {
  id: string;
  name: string;
  /** Optional cron expression (reserved; not yet evaluated by the executor). */
  cron?: string;
  /** Primary interval in seconds between fires. */
  intervalSec: number;
  /** Target URL the payload is POSTed to. */
  target: string;
  /** HTTP method; defaults to POST. GET omits the body. */
  method?: 'GET' | 'POST' | 'PUT';
  /** Request body for POST/PUT (any JSON-serialisable value). */
  payload?: unknown;
  /** Extra request headers. */
  headers?: Record<string, string>;
  enabled: boolean;
  /** ISO timestamp of the last successful/attempted run. */
  lastRun?: string;
  /** ISO timestamp of the next due run. */
  nextRun?: string;
  createdAt: string;
  /** Consecutive failure count (reset on success). */
  failures?: number;
}

/** In-memory schedule list — the single source of truth shared with the executor. */
export const SCHEDULES: Schedule[] = loadSchedules();

export function computeNextRun(sched: Schedule, from: number = Date.now()): string {
  const sec = Number.isFinite(sched.intervalSec) && sched.intervalSec > 0 ? sched.intervalSec : 60;
  return new Date(from + sec * 1000).toISOString();
}

export function persistSchedules(): void {
  ensureDir();
  const tmp = SCHEDULES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(SCHEDULES, null, 2), 'utf8');
  fs.renameSync(tmp, SCHEDULES_FILE);
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSchedules(): Schedule[] {
  ensureDir();
  try {
    const raw = fs.readFileSync(SCHEDULES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? (parsed as Schedule[]) : [];
    for (const s of list) {
      if (!s.nextRun) s.nextRun = computeNextRun(s, Date.now());
    }
    return list;
  } catch {
    return [];
  }
}

function isUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}

function genId(): string {
  return 'ms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sanitize(body: Record<string, unknown>): Schedule {
  const intervalSec = typeof body.intervalSec === 'number' && body.intervalSec > 0
    ? body.intervalSec
    : typeof body.intervalSec === 'string' && Number(body.intervalSec) > 0
      ? Number(body.intervalSec)
      : 60;
  const sched: Schedule = {
    id: genId(),
    name: typeof body.name === 'string' && body.name ? body.name : 'unnamed',
    intervalSec,
    target: typeof body.target === 'string' ? body.target.trim() : '',
    enabled: body.enabled !== false,
    createdAt: new Date().toISOString(),
  };
  if (typeof body.cron === 'string' && body.cron) sched.cron = body.cron;
  if (body.method === 'GET' || body.method === 'POST' || body.method === 'PUT') sched.method = body.method;
  if (body.payload !== undefined) sched.payload = body.payload;
  if (body.headers && typeof body.headers === 'object') {
    sched.headers = body.headers as Record<string, string>;
  }
  sched.nextRun = computeNextRun(sched, Date.now());
  return sched;
}

export default function registerMissionScheduler(router: Router): void {
  // List schedules. NOTE: intentionally no GET /:id route here, so that
  // GET /api/missions/schedule/executions (registered by feat-missionsched-exec)
  // is never shadowed by the :id param.
  router.get('/api/missions/schedule', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, schedules: SCHEDULES });
  });

  router.post('/api/missions/schedule', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isUrl(body.target)) {
      res.status(400).json({ ok: false, error: 'target must be an http(s) URL' });
      return;
    }
    const sched = sanitize(body);
    SCHEDULES.push(sched);
    persistSchedules();
    res.status(201).json({ ok: true, schedule: sched });
  });

  router.put('/api/missions/schedule/:id', (req, res) => {
    const sched = SCHEDULES.find((s) => s.id === req.params.id);
    if (!sched) {
      res.status(404).json({ ok: false, error: 'schedule not found' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.name === 'string' && body.name) sched.name = body.name;
    if (typeof body.target === 'string' && body.target) {
      if (!isUrl(body.target)) {
        res.status(400).json({ ok: false, error: 'target must be an http(s) URL' });
        return;
      }
      sched.target = body.target.trim();
    }
    if (body.intervalSec !== undefined) {
      const v = typeof body.intervalSec === 'number' ? body.intervalSec : Number(body.intervalSec);
      if (Number.isFinite(v) && v > 0) sched.intervalSec = v;
    }
    if (body.cron !== undefined && typeof body.cron === 'string') sched.cron = body.cron || undefined;
    if (body.method === 'GET' || body.method === 'POST' || body.method === 'PUT') sched.method = body.method;
    if (body.payload !== undefined) sched.payload = body.payload;
    if (body.enabled !== undefined) sched.enabled = Boolean(body.enabled);
    // Recompute next run from the (possibly updated) interval when enabling.
    if (sched.enabled && body.intervalSec !== undefined) {
      sched.nextRun = computeNextRun(sched, Date.now());
    }
    persistSchedules();
    res.status(200).json({ ok: true, schedule: sched });
  });

  router.delete('/api/missions/schedule/:id', (req, res) => {
    const idx = SCHEDULES.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: 'schedule not found' });
      return;
    }
    SCHEDULES.splice(idx, 1);
    persistSchedules();
    res.status(200).json({ ok: true });
  });
}
