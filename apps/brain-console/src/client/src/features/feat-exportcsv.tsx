// Export-to-CSV feature — closes Batch B #14.
// Lets an operator pull any data panel (vault / missions / audit / ledger /
// decisions / roles / agents) from the live API and download it as CSV, or copy
// the CSV to the clipboard. Auto-registers through the features glob — no
// App.tsx / server.ts edits, so it cannot collide with parallel waves.
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useState } from 'react';

type PanelKey = 'vault' | 'missions' | 'audit' | 'ledger' | 'decisions' | 'roles' | 'agents';

interface PanelMeta {
  endpoint: string;
  /** Key holding the row array; null => the response itself is the array. */
  arrayKey: string | null;
  label: string;
}

const PANELS: Record<PanelKey, PanelMeta> = {
  vault: { endpoint: '/api/vault', arrayKey: 'items', label: 'Vault' },
  missions: { endpoint: '/api/missions', arrayKey: 'missions', label: 'Missions' },
  audit: { endpoint: '/api/audit', arrayKey: 'events', label: 'Audit' },
  ledger: { endpoint: '/api/ledger', arrayKey: 'ledger', label: 'Ledger' },
  decisions: { endpoint: '/api/decisions', arrayKey: 'decisions', label: 'Decisions' },
  roles: { endpoint: '/api/roles', arrayKey: 'roles', label: 'Roles' },
  agents: { endpoint: '/api/agents', arrayKey: 'agents', label: 'Agents' },
};

function toRows(data: unknown, key: string | null): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (key && Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    // Fallback: use the first array-valued property we find.
    for (const k of Object.keys(obj)) {
      if (Array.isArray(obj[k])) return obj[k] as Record<string, unknown>[];
    }
  }
  return [];
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  let s: string;
  if (typeof v === 'object') {
    try {
      s = JSON.stringify(v);
    } catch {
      s = String(v);
    }
  } else {
    s = String(v);
  }
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const head = columns.map((c) => csvCell(c)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}

function columnsOf(rows: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const r of rows.slice(0, 50)) {
    if (r && typeof r === 'object') for (const k of Object.keys(r)) set.add(k);
  }
  return Array.from(set);
}

export default {
  path: '/feature/export-csv',
  label: 'Export CSV',
  category: 'Knowledge',
  component: function ExportCsvPanel() {
    const [panel, setPanel] = useState<PanelKey>('vault');
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [cols, setCols] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      setCopied(false);
      try {
        const meta = PANELS[panel];
        const r = await fetch(meta.endpoint);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = (await r.json()) as unknown;
        const extracted = toRows(data, meta.arrayKey);
        setRows(extracted);
        setCols(columnsOf(extracted));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed to load');
        setRows([]);
        setCols([]);
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panel]);

    function download(): void {
      if (rows.length === 0 || cols.length === 0) return;
      const csv = toCsv(rows, cols);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = panel + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    async function copy(): Promise<void> {
      if (rows.length === 0 || cols.length === 0) return;
      const csv = toCsv(rows, cols);
      try {
        await navigator.clipboard.writeText(csv);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError('Clipboard unavailable in this context');
      }
    }

    return (
      <div className="card">
        <div className="section-header">
          <h2>Export CSV</h2>
          <span className="subtitle">Batch B #14 · {rows.length} row(s)</span>
        </div>
        <div className="row gap-2 mt-2 wrap items-center">
          <select
            className="input"
            value={panel}
            onChange={(e) => setPanel(e.target.value as PanelKey)}
            aria-label="Panel"
          >
            {Object.entries(PANELS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={loading || rows.length === 0} onClick={() => download()}>
            Download CSV
          </button>
          <button
            className="btn secondary"
            disabled={loading || rows.length === 0}
            onClick={() => void copy()}
          >
            {copied ? 'Copied!' : 'Copy CSV'}
          </button>
          <button className="btn secondary" disabled={loading} onClick={() => void load()}>
            Reload
          </button>
        </div>
        {loading && <p className="muted mt-2">Loading {PANELS[panel].label}…</p>}
        {error && <p className="muted mt-2">Error: {error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="muted mt-2">No rows returned for {PANELS[panel].label}.</p>
        )}
        {cols.length > 0 && (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 25).map((r, i) => (
                  <tr key={i}>
                    {cols.map((c) => (
                      <td key={c} className="muted">
                        {csvCell(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length > 25 && (
                  <tr>
                    <td colSpan={cols.length} className="muted">
                      … {rows.length - 25} more row(s) — download for the full set.
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
