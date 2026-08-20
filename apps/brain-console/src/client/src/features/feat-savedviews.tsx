// Saved Views feature — conflict-free. Auto-appears in the sidebar / command
// palette with NO edits to App.tsx or server.ts. Closes Batch B #11 (saved
// views/filters for missions/vault/audit/ledger tables). Lets an operator store
// named filter presets and re-apply them to the live panel data. Uses the
// automatic JSX runtime, so React is not imported.
import { useEffect, useState } from 'react';

type Panel = 'vault' | 'missions' | 'audit' | 'ledger';

interface SavedView {
  id: string;
  panel: Panel;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

interface PanelMeta {
  endpoint: string;
  arrayKey: string;
  columns: string[];
  label: string;
}

const PANELS: Record<Panel, PanelMeta> = {
  vault: { endpoint: '/api/vault', arrayKey: 'items', columns: ['id', 'kind', 'name', 'updated'], label: 'Vault' },
  missions: { endpoint: '/api/missions', arrayKey: 'missions', columns: ['id', 'title', 'status', 'phase', 'owner', 'progress'], label: 'Missions' },
  audit: { endpoint: '/api/audit', arrayKey: 'events', columns: ['id', 'action', 'actor', 'target', 'ts'], label: 'Audit' },
  ledger: { endpoint: '/api/ledger', arrayKey: 'ledger', columns: ['id', 'date', 'title', 'type', 'outcome'], label: 'Ledger' },
};

function matches(row: Record<string, unknown>, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([field, value]) => {
    const cell = row[field];
    if (cell == null) return false;
    return String(cell).toLowerCase().includes(value.toLowerCase());
  });
}

export default {
  path: '/feature/saved-views',
  label: 'Saved Views',
  category: 'Knowledge',
  component: function SavedViewsPanel() {
    const [views, setViews] = useState<SavedView[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [panel, setPanel] = useState<Panel>('vault');
    const [name, setName] = useState('');
    const [filtersText, setFiltersText] = useState('{\n  "kind": "secret"\n}');
    const [createError, setCreateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const [applied, setApplied] = useState<SavedView | null>(null);
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [applying, setApplying] = useState(false);

    async function refresh(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch('/api/saved-views');
        const d = (await r.json()) as { ok: boolean; views: SavedView[] };
        setViews(d.views ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed to load');
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      void refresh();
    }, []);

    async function create(): Promise<void> {
      let parsed: Record<string, string>;
      try {
        parsed = JSON.parse(filtersText) as Record<string, string>;
      } catch {
        setCreateError('Filters must be valid JSON, e.g. {"kind":"secret"}');
        return;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setCreateError('Filters must be a JSON object of field:substring');
        return;
      }
      setCreating(true);
      setCreateError(null);
      try {
        const r = await fetch('/api/saved-views', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ panel, name: name.trim(), filters: parsed }),
        });
        const d = (await r.json()) as { ok: boolean; view?: SavedView; error?: string };
        if (!r.ok || !d.ok) {
          setCreateError(d.error ?? ('HTTP ' + r.status));
          return;
        }
        setName('');
        await refresh();
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : 'request failed');
      } finally {
        setCreating(false);
      }
    }

    async function remove(id: string): Promise<void> {
      try {
        await fetch('/api/saved-views/' + id, { method: 'DELETE' });
        if (applied && applied.id === id) setApplied(null);
        await refresh();
      } catch {
        /* ignore */
      }
    }

    async function applyView(view: SavedView): Promise<void> {
      setApplied(view);
      setApplying(true);
      try {
        const meta = PANELS[view.panel];
        const r = await fetch(meta.endpoint);
        const data = (await r.json()) as Record<string, unknown>;
        const all = Array.isArray(data[meta.arrayKey])
          ? (data[meta.arrayKey] as Record<string, unknown>[])
          : [];
        setRows(all.filter((row) => matches(row, view.filters)));
      } catch {
        setRows([]);
      } finally {
        setApplying(false);
      }
    }

    const columns = applied ? PANELS[applied.panel].columns : [];

    return (
      <div className="card">
        <div className="section-header">
          <h2>Saved Views &amp; Filters</h2>
          <span className="subtitle">{views.length} saved · Batch B #11</span>
        </div>

        <div className="row gap-2 mt-2 wrap items-center">
          <select className="input" value={panel} onChange={(e) => setPanel(e.target.value as Panel)} aria-label="Panel">
            {Object.entries(PANELS).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
          <input className="input" placeholder="View name" value={name} onChange={(e) => setName(e.target.value)} aria-label="View name" />
          <button className="btn secondary" disabled={creating} onClick={() => void create()}>Save view</button>
          <span className="muted">{createError ?? ''}</span>
        </div>
        <div className="mt-2">
          <label className="muted" htmlFor="sv-filters">Filters (JSON object, field → substring, AND-combined):</label>
          <textarea id="sv-filters" className="input mt-2" rows={3} value={filtersText} onChange={(e) => setFiltersText(e.target.value)} spellCheck={false} />
        </div>

        {loading && <p className="muted mt-2">Loading saved views…</p>}
        {error && <p className="muted mt-2">Error: {error}</p>}

        <div className="table-wrap mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>Panel</th>
                <th>Name</th>
                <th>Filters</th>
                <th>Created</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.id}>
                  <td>{PANELS[v.panel].label}</td>
                  <td>{v.name}</td>
                  <td className="muted">{Object.entries(v.filters).map(([k, val]) => `${k}=${val}`).join(', ')}</td>
                  <td className="muted">{v.createdAt.slice(0, 10)}</td>
                  <td><button className="btn secondary" disabled={applying} onClick={() => void applyView(v)}>Apply</button></td>
                  <td><button className="btn secondary" onClick={() => void remove(v.id)}>Delete</button></td>
                </tr>
              ))}
              {!loading && views.length === 0 && (
                <tr><td colSpan={6} className="muted">No saved views yet. Create one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {applied && (
          <div className="mt-3">
            <div className="section-header">
              <h3>Applied: {applied.name}</h3>
              <span className="subtitle">{rows.length} matching row(s)</span>
            </div>
            <div className="table-wrap mt-2">
              <table className="table">
                <thead>
                  <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => <td key={c} className="muted">{String(row[c] ?? '')}</td>)}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={columns.length} className="muted">No rows match this view.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  },
};
