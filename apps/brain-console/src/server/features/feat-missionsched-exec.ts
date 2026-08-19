// Server feature: Mission Scheduler EXECUTION engine.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
//
// Imports the schedule store from feat-missionsched.ts and, on module load,
// starts a 30s tick (.unref()'d so it never blocks process exit) that scans
// every enabled schedule whose nextRun <= now and fires it: POSTing the stored
// payload to the schedule's target URL (global fetch, AbortController 5s).
// Every fire is recorded into an in-memory execution log (capped at 200) and
// exposed via GET /api/missions/schedule/executions.
//
// Crash-proof by construction: the tick is fully wrapped in try/catch and never
// throws; individual executions are awaited with a trailing .catch so a single
// bad schedule can never take down the loop.
import type { Router } from 'express';
import type { Schedule } from './feat-missionsched';
import { SCHEDULES, computeNextRun, persistSchedules } from './feat-missionsched';

const TICK_MS = 30_000;
const FETCH_TIMEOUT_MS = 5_000;
const EXEC_CAP = 200;

export interface Execution {
  ts: string;
  scheduleId: string;
  name?: string;
  status: 'ok' | 'error';
  statusCode?: number;
  error?: string;
}

// In-memory ring buffer of recent executions (newest last).
const executions: Execution[] = [];

function recordExecution(entry: Execution): void {
  executions.push(entry);
  if (executions.length > EXEC_CAP) {
    executions.splice(0, executions.length - EXEC_CAP);
  }
}

async function executeSchedule(sched: Schedule): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const method = sched.method || 'POST';
  const headers: Record<string, string> = {
    'x-forgeos-scheduler': sched.id,
    ...(sched.headers || {}),
  };
  if (method !== 'GET' && sched.payload !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const init: RequestInit = { method, signal: ctrl.signal, headers };
  if (method !== 'GET' && sched.payload !== undefined) {
    init.body = JSON.stringify(sched.payload ?? {});
  }

  try {
    const res = await fetch(sched.target, init);
    const ok = res.ok;
    recordExecution({
      ts: new Date().toISOString(),
      scheduleId: sched.id,
      name: sched.name,
      status: ok ? 'ok' : 'error',
      statusCode: res.status,
    });
    if (ok) sched.failures = 0;
    else sched.failures = (sched.failures || 0) + 1;
  } catch (err) {
    recordExecution({
      ts: new Date().toISOString(),
      scheduleId: sched.id,
      name: sched.name,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    sched.failures = (sched.failures || 0) + 1;
  } finally {
    clearTimeout(timer);
  }

  // Advance run markers regardless of outcome so a dead target can't spin-fire.
  sched.lastRun = new Date().toISOString();
  sched.nextRun = computeNextRun(sched, Date.now());
  try {
    persistSchedules();
  } catch (err) {
    console.warn('[missionsched-exec] persist failed:', err instanceof Error ? err.message : err);
  }
}

function tick(): void {
  try {
    const now = Date.now();
    for (const sched of SCHEDULES) {
      if (!sched.enabled) continue;
      const next = sched.nextRun ? new Date(sched.nextRun).getTime() : 0;
      if (next <= now) {
        // Fire-and-forget but swallow any rejection so the loop is crash-proof.
        void executeSchedule(sched).catch((err) => {
          console.warn(
            '[missionsched-exec] unexpected rejection for',
            sched.id,
            err instanceof Error ? err.message : err,
          );
        });
      }
    }
  } catch (err) {
    // Never let a tick crash the process.
    console.warn('[missionsched-exec] tick error:', err instanceof Error ? err.message : err);
  }
}

// Start the scheduler loop. .unref() keeps it from holding the event loop open
// (e.g. during `tsx --test`), but it still runs while the server is alive.
const interval = setInterval(tick, TICK_MS);
if (typeof (interval as { unref?: () => void }).unref === 'function') {
  (interval as { unref?: () => void }).unref();
}

export default function registerMissionExec(router: Router): void {
  router.get('/api/missions/schedule/executions', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // Return newest-first for the UI.
    res.status(200).json({
      ok: true,
      executions: executions.slice().reverse(),
      count: executions.length,
    });
  });
}
