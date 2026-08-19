// Dead-Letter Queue feature — conflict-free. Auto-appears in the sidebar /
// command palette with NO edits to App.tsx or server.ts.
// Lists failed agent tasks captured in the server's dead-letter store, shows
// status tags, and exposes Retry (simulated re-dispatch) and Ack (remove)
// actions. Polls GET /api/agent/deadletter/meta every 5s for live counts.
// Note: automatic JSX runtime, so do NOT import React; import hooks directly.
import { useEffect, useState } from 'react';

type DeadLetterStatus = 'queued' | 'retrying';

interface DeadLetterItem {
  id: string;
  task: unknown;
  error: string;
  attempts: number;
  enqueuedAt: string;
  status: DeadLetterStatus;
}

interface DeadLetterMeta {
  ok: boolean;
  count: number;
  byStatus: Record<DeadLetterStatus, number>;
}

const STATUS_TAG: Record<DeadLetterStatus, string> = {
  queued: 'warn',
  retrying: 'info',
};

function describeTask(task: unknown): string {
  if (task === null || task === undefined) return '—';
  if (typeof task === 'string') return task;
  try {
    return JSON.stringify(task);
  } catch {
    return String(task);
  }
}

export default {
  path: '/feature/dead-letter',
  label: 'Dead-Letter Queue',
  category: 'Features',
  component: function DeadLetterFeature() {
    const [items, setItems] = useState<DeadLetterItem[]>([]);
    const [meta, setMeta] = useState<DeadLetterMeta | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);

    function loadItems() {
      fetch('/api/agent/deadletter')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: { ok: boolean; items: DeadLetterItem[] }) => {
          setItems(d.items ?? []);
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }

    function loadMeta() {
      fetch('/api/agent/deadletter/meta')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: DeadLetterMeta) => setMeta(d))
        .catch(() => {});
    }

    useEffect(() => {
      let cancelled = false;
      const run = () => {
        if (cancelled) return;
        loadItems();
        loadMeta();
      };
      run();
      // Poll meta every 5s for live counts.
      const t = setInterval(() => {
        if (!cancelled) loadMeta();
      }, 5000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }, []);

    function act(id: string, action: 'retry' | 'ack') {
      setBusyId(id);
      setFlash(null);
      fetch(`/api/agent/deadletter/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))
        )
        .then(() => {
          setFlash(action === 'retry' ? `Retried ${id}` : `Acknowledged ${id}`);
          loadItems();
          loadMeta();
        })
        .catch((e: Error) => setFlash('Action failed: ' + e.message))
        .finally(() => setBusyId(null));
    }

    return (
      <div className="panel">
        <div className="section-header">
          <h2>Dead-Letter Queue</h2>
          <span className="subtitle">Failed agent tasks awaiting retry or acknowledgement</span>
        </div>

        <div className="row gap-2 mt-2 wrap items-center">
          {meta ? (
            <>
              <span className="tag">{meta.count} total</span>
              <span className={`tag ${STATUS_TAG.queued}`}>{meta.byStatus.queued} queued</span>
              <span className={`tag ${STATUS_TAG.retrying}`}>{meta.byStatus.retrying} retrying</span>
            </>
          ) : (
            <span className="muted">Loading counts…</span>
          )}
          {flash ? <span className="muted">{flash}</span> : null}
        </div>

        {error ? (
          <div className="card error mt-3">
            <p className="muted">Failed to load dead-letter queue: {error}</p>
          </div>
        ) : loading ? (
          <div className="card mt-3">
            <p className="muted">Loading…</p>
          </div>
        ) : (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Task</th>
                  <th>Error</th>
                  <th>Attempts</th>
                  <th>Enqueued</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.id}</td>
                    <td>{describeTask(it.task)}</td>
                    <td>{it.error || '—'}</td>
                    <td>{it.attempts}</td>
                    <td>{it.enqueuedAt}</td>
                    <td>
                      <span className={`tag ${STATUS_TAG[it.status]}`}>{it.status}</span>
                    </td>
                    <td>
                      <div className="row gap-2 wrap items-center">
                        <button
                          className="btn btn-sm"
                          disabled={busyId === it.id}
                          onClick={() => act(it.id, 'retry')}
                        >
                          Retry
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          disabled={busyId === it.id}
                          onClick={() => act(it.id, 'ack')}
                        >
                          Ack
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      Dead-letter queue is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  },
};
