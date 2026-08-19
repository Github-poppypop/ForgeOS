// Server feature: dead-letter queue for failed agent tasks.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
// Provides an in-memory store + REST surface so failed agent tasks can be
// inspected, retried (simulated re-dispatch), and acknowledged.
import type { Router, Request, Response } from 'express';

type DeadLetterStatus = 'queued' | 'retrying';

interface DeadLetterItem {
  id: string;
  task: unknown;
  error: string;
  attempts: number;
  enqueuedAt: string;
  status: DeadLetterStatus;
}

// In-memory store (module-scoped; resets on server restart).
const store: DeadLetterItem[] = [];

function findIndex(id: string): number {
  return store.findIndex((it) => it.id === id);
}

function send(res: Response, status: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function nowIso(): string {
  return new Date().toISOString();
}

export default function registerDeadLetter(router: Router): void {
  // Enqueue a failed task. Body: { id, task, error, attempts?, enqueuedAt? }.
  router.post('/api/agent/deadletter', (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const id = body.id;
      const task = body.task;
      const error = body.error;
      if (typeof id !== 'string' || !id.trim()) {
        send(res, 400, { ok: false, error: 'Missing required field: id (string)' });
        return;
      }
      if (task === undefined || task === null) {
        send(res, 400, { ok: false, error: 'Missing required field: task' });
        return;
      }
      if (typeof error !== 'string' || !error.trim()) {
        send(res, 400, { ok: false, error: 'Missing required field: error (string)' });
        return;
      }
      const attempts =
        typeof body.attempts === 'number' && Number.isFinite(body.attempts)
          ? Math.max(1, Math.floor(body.attempts))
          : 1;
      const enqueuedAt =
        typeof body.enqueuedAt === 'string' && body.enqueuedAt.trim()
          ? body.enqueuedAt
          : nowIso();
      // De-dupe by id: replace existing entry if present.
      const existing = findIndex(id);
      const item: DeadLetterItem = { id, task, error, attempts, enqueuedAt, status: 'queued' };
      if (existing >= 0) store[existing] = item;
      else store.push(item);
      send(res, 201, { ok: true, item });
    } catch (err) {
      send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'internal error' });
    }
  });

  // List queued items (newest first).
  router.get('/api/agent/deadletter', (_req: Request, res: Response) => {
    try {
      const items = [...store].reverse();
      send(res, 200, { ok: true, count: items.length, items });
    } catch (err) {
      send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'internal error' });
    }
  });

  // Meta: total count + by-status breakdown.
  router.get('/api/agent/deadletter/meta', (_req: Request, res: Response) => {
    try {
      const byStatus: Record<DeadLetterStatus, number> = { queued: 0, retrying: 0 };
      for (const it of store) byStatus[it.status] += 1;
      send(res, 200, { ok: true, count: store.length, byStatus });
    } catch (err) {
      send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'internal error' });
    }
  });

  // Retry: simulate re-dispatch — clear error, bump attempts, mark 'retrying'.
  router.post('/api/agent/deadletter/:id/retry', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const idx = findIndex(id);
      if (idx < 0) {
        send(res, 404, { ok: false, error: 'Dead-letter item not found', id });
        return;
      }
      const item = store[idx];
      const updated: DeadLetterItem = {
        ...item,
        error: '',
        attempts: item.attempts + 1,
        status: 'retrying',
      };
      store[idx] = updated;
      send(res, 200, { ok: true, item: updated });
    } catch (err) {
      send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'internal error' });
    }
  });

  // Ack: remove (acknowledge) an item.
  router.post('/api/agent/deadletter/:id/ack', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const idx = findIndex(id);
      if (idx < 0) {
        send(res, 404, { ok: false, error: 'Dead-letter item not found', id });
        return;
      }
      store.splice(idx, 1);
      send(res, 200, { ok: true, id, removed: true });
    } catch (err) {
      send(res, 500, { ok: false, error: err instanceof Error ? err.message : 'internal error' });
    }
  });
}
