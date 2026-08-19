// Durable Audit Store viewer — conflict-free. Auto-appears in the sidebar / command
// palette with NO edits to App.tsx or server.ts. Shows store meta (size / generations /
// current line count) and a recent-entries table pulled from the in-memory mirror
// (GET /api/audit/store). The durable rotation + append endpoints are served by
// feat-auditstore.ts on the server; the existing audit export is untouched.
// Note: this project uses the automatic JSX runtime, so you do NOT import React.
import { useEffect, useState } from 'react';

interface AuditRecord {
  ts?: string;
  [key: string]: unknown;
}
interface StoreMeta {
  bytes: number;
  generations: number;
  lines: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function prettyKey(k: string): string {
  return k.replace(/[_-]/g, ' ');
}

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default {
  path: '/feature/audit-store',
  label: 'Audit Store',
  category: 'Features',
  component: function AuditStoreFeature() {
    const [meta, setMeta] = useState<StoreMeta | null>(null);
    const [entries, setEntries] = useState<AuditRecord[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([
        fetch('/api/audit/store/meta').then((r) =>
          r.ok ? r.json() : Promise.reject(new Error('meta HTTP ' + r.status))
        ),
        fetch('/api/audit/store').then((r) =>
          r.ok ? r.json() : Promise.reject(new Error('store HTTP ' + r.status))
        ),
      ])
        .then(([m, e]: [StoreMeta, AuditRecord[]]) => {
          if (cancelled) return;
          setMeta(m);
          setEntries(Array.isArray(e) ? e : []);
          setLoading(false);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setError(err.message);
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    const columns = entries.length
      ? Object.keys(entries[0]).slice(0, 8)
      : [];

    return (
      <div className="panel">
        <h2 className="section-header">Audit Store</h2>
        <p className="subtitle">
          Durable, rotated audit log at <span className="mono">logs/audit.jsonl</span>. The mirror
          below shows the most recent entries (newest first); the full stream is served by the
          server with size-based rotation.
        </p>

        {loading ? (
          <div className="card">
            <p className="muted">Loading audit store…</p>
          </div>
        ) : error ? (
          <div className="card error">
            <p className="muted">Failed to load: {error}</p>
          </div>
        ) : (
          <>
            <div className="row" style={{ gap: '12px', marginBottom: '16px' }}>
              <div className="card" style={{ flex: '1 1 160px' }}>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 700 }}>
                  {meta ? formatBytes(meta.bytes) : '—'}
                </div>
                <div className="muted" style={{ marginTop: '4px' }}>
                  Current size
                </div>
              </div>
              <div className="card" style={{ flex: '1 1 160px' }}>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 700 }}>
                  {meta ? meta.generations : '—'}
                </div>
                <div className="muted" style={{ marginTop: '4px' }}>
                  Generations
                </div>
              </div>
              <div className="card" style={{ flex: '1 1 160px' }}>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 700 }}>
                  {meta ? meta.lines : '—'}
                </div>
                <div className="muted" style={{ marginTop: '4px' }}>
                  Current lines
                </div>
              </div>
            </div>

            <h3 className="section-header">Recent entries</h3>
            {entries.length === 0 ? (
              <div className="card">
                <p className="muted">No audit entries yet.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c}>{prettyKey(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c} className="mono">
                            {cellText(e[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    );
  },
};
