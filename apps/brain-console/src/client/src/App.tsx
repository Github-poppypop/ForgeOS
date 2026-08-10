import { useEffect, useMemo, useState } from 'react';

type Route =
  | '#/dashboard'
  | '#/roles'
  | '#/page/:slug'
  | '#/search'
  | '#/capture'
  | '#/decisions'
  | '#/timeline'
  | '#/ledger'
  | '#/missions'
  | '#/mcp'
  | '#/vault'
  | '#/embed'
  | '#/federation'
  | '#/audit'
  | '#/schema'
  | '#/config'
  | '#/command'
  | '#/governance'
  | '#/monitoring'
  | '#/workflows'
  | '#/marketplace'
  | '#/plugins'
  | '#/projects'
  | '#/settings'
  | '#/poolleague'
  | '#/webhooks';

const ROUTES: Route[] = [
  '#/dashboard',
  '#/roles',
  '#/search',
  '#/capture',
  '#/decisions',
  '#/timeline',
  '#/ledger',
  '#/missions',
  '#/mcp',
  '#/vault',
  '#/embed',
  '#/federation',
  '#/audit',
  '#/schema',
  '#/config',
  '#/command',
  '#/governance',
  '#/monitoring',
  '#/workflows',
  '#/marketplace',
  '#/plugins',
  '#/projects',
  '#/settings',
  '#/poolleague',
  '#/webhooks',
];

const THEME_PREFIX = 'forgeos-theme-';
const THEMES = [
  { id: 'system', label: 'System', color: '#6ea8fe' },
  { id: 'dark', label: 'Dark', color: '#0b0e14' },
  { id: 'light', label: 'Light', color: '#f4f6fa' },
  { id: 'hc', label: 'High contrast', color: '#000' },
  { id: 'midnight', label: 'Midnight', color: '#07080c' },
  { id: 'solarized-light', label: 'Solarized', color: '#fdf6e3' },
  { id: 'retro', label: 'Retro', color: '#1a1025' },
  { id: 'matrix', label: 'Matrix', color: '#0a0f0a' },
  { id: 'ocean', label: 'Ocean', color: '#0b1622' },
  { id: 'berry', label: 'Berry', color: '#180a16' },
  { id: 'graphite', label: 'Graphite', color: '#0f1115' },
];

const CONTRASTS = [
  { id: '', label: 'Default' },
  { id: 'high', label: 'High' },
  { id: 'soft', label: 'Soft' },
];

const SHORTCUTS: [string, string, string][] = [
  ['d', 'Dashboard', 'Go to dashboard'],
  ['r', 'Roles', 'Go to roles'],
  ['s', 'Search', 'Go to search'],
  ['c', 'Capture', 'Go to capture'],
  ['?', 'Shortcuts', 'Show shortcuts'],
  ['Esc', 'Close', 'Close dialogs/overlays'],
];

const CATEGORIES = [
  { title: 'Core', items: ['#/dashboard', '#/roles', '#/search', '#/capture'] },
  { title: 'Knowledge', items: ['#/decisions', '#/timeline', '#/ledger', '#/vault'] },
  { title: 'Governance', items: ['#/missions', '#/federation', '#/audit', '#/schema', '#/governance'] },
  { title: 'Platform', items: ['#/mcp', '#/plugins', '#/marketplace', '#/workflows', '#/monitoring'] },
  { title: 'System', items: ['#/config', '#/command', '#/settings', '#/projects', '#/poolleague', '#/webhooks'] },
];

function useHashRoute() {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash || '#/dashboard' : '#/dashboard'));
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/dashboard');
    window.addEventListener('hashchange', onHash, false);
    return () => window.removeEventListener('hashchange', onHash, false);
  }, []);
  return hash;
}

function matchRoute(hash: string): string {
  if (!hash || hash === '#') return '#/dashboard';
  const base = hash.split('?')[0].split('/')[1];
  const found = ROUTES.find((r) => {
    if (r === '#/page/:slug') return base === 'page';
    return r === `#/${base}`;
  });
  return found || hash;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<T>(path)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, [path]);
  return { data, error };
}

function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === 'undefined') return 'system';
    return document.documentElement.dataset.theme || 'system';
  });
  const [contrast, setContrast] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const cls = document.documentElement.className || '';
    const m = cls.match(/contrast-(high|soft|default)/);
    return m ? m[1] : '';
  });

  const apply = (t: string) => {
    const root = document.documentElement;
    const q = window.matchMedia('(prefers-color-scheme: dark)');
    root.classList.remove(
      'theme-system', 'theme-dark', 'theme-light', 'theme-hc', 'theme-midnight',
      'theme-solarized-light', 'theme-retro', 'theme-matrix', 'theme-ocean', 'theme-berry', 'theme-graphite'
    );
    if (!t || t === 'system') {
      root.dataset.theme = 'auto';
      root.classList.add('theme-system');
      root.classList.remove('theme-light', 'theme-dark');
      root.classList.add(q.matches ? 'theme-dark' : 'theme-light');
    } else {
      root.dataset.theme = t;
      root.classList.add(`theme-${t}`);
    }
    localStorage.setItem(`${THEME_PREFIX}theme`, t);
    setTheme(t);
  };

  useEffect(() => {
    apply(theme);
    const handler = () => {
      if ((document.documentElement.dataset.theme || 'system') === 'system') apply('system');
    };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handler);
    return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('contrast-default', 'contrast-high', 'contrast-soft');
    if (contrast) root.classList.add(`contrast-${contrast}`);
    localStorage.setItem(`${THEME_PREFIX}contrast`, contrast);
    setContrast(contrast);
  }, [contrast]);

  useEffect(() => {
    const saved = localStorage.getItem(`${THEME_PREFIX}theme`);
    if (saved && saved !== theme) apply(saved);
    const savedC = localStorage.getItem(`${THEME_PREFIX}contrast`);
    if (savedC !== null && savedC !== contrast) setContrast(savedC);
  }, []);

  return { theme, setTheme, contrast, setContrast, apply };
}

function Toast({ message, kind, onDone }: { message: string; kind: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className={`toast ${kind}`}>{message}</div>;
}

function StatusPill({ label, ok, title }: { label: string; ok: boolean; title?: string }) {
  return (
    <span className={`pill ${ok ? 'ok' : 'bad'}`} data-tooltip={title}>
      <span className="dot" />
      {label}
    </span>
  );
}

function ThemeSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="theme-swatches">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`swatch ${value === t.id ? 'active' : ''}`}
          style={{ background: t.color }}
          data-tooltip={t.label}
          onClick={() => onChange(t.id)}
          aria-label={t.label}
        />
      ))}
    </div>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler, false);
    return () => window.removeEventListener('keydown', handler, false);
  }, [onClose]);

  useEffect(() => {
    const overlay = document.getElementById('shortcuts-overlay');
    if (overlay) overlay.classList.add('open');
    return () => { if (overlay) overlay.classList.remove('open'); };
  }, [onClose]);

  return (
    <div id="shortcuts-overlay" className="cmdk open" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <table className="tbl" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Key</th>
              <th>Action</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(([k, a, d]) => (
              <tr key={k}>
                <td className="mono" style={{ width: 120 }}><span className="kbd">{k}</span></td>
                <td>{a}</td>
                <td className="muted">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function useShortcuts() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === '?') { ev.preventDefault(); setShowShortcuts(true); }
    };
    window.addEventListener('keydown', handler, false);
    return () => window.removeEventListener('keydown', handler, false);
  }, []);
  return { showShortcuts, setShowShortcuts };
}

function Sidebar({ route, onNavigate }: { route: string; onNavigate: (r: string) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (title: string) => setCollapsed((p) => ({ ...p, [title]: !p[title] }));

  return (
    <nav className="sidebar" aria-label="primary">
      {CATEGORIES.map((cat) => (
        <div key={cat.title} className={`nav-category ${collapsed[cat.title] ? 'collapsed' : ''}`}>
          <div className="nav-category-header" onClick={() => toggle(cat.title)}>{cat.title}</div>
          <div className="nav-category-items" style={{ maxHeight: collapsed[cat.title] ? '0px' : '240px' }}>
            {cat.items.map((r) => {
              const label = r.replace('#/', '').charAt(0).toUpperCase() + r.replace('#/', '').slice(1);
              return (
                <a key={r} href={r} className={route === r ? 'active' : ''} onClick={(e) => { e.preventDefault(); onNavigate(r); }}>
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Navbar({ route, onNavigate, theme, setTheme, contrast, setContrast, onShortcuts }: {
  route: string;
  onNavigate: (r: string) => void;
  theme: string;
  setTheme: (t: string) => void;
  contrast: string;
  setContrast: (t: string) => void;
  onShortcuts: () => void;
}) {
  const label = route ? route.replace('#/', '').charAt(0).toUpperCase() + route.replace('#/', '').slice(1) : 'Console';
  return (
    <header className="navbar">
      <button className="btn icon sm" aria-label="Menu" onClick={() => document.querySelector('.sidebar')?.classList.toggle('open')}>☰</button>
      <div className="wordmark">ForgeOS <span className="os">Console</span></div>
      <div className="spacer" />
      <span className="caption" style={{ marginRight: 8 }}>{label}</span>
      <ThemeSwatches value={theme} onChange={setTheme} />
      <select
        data-tooltip="Contrast mode"
        value={contrast}
        onChange={(e) => setContrast(e.target.value)}
        className="select"
        style={{ width: 140 }}
      >
        {CONTRASTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button className="btn secondary sm" onClick={onShortcuts}>Shortcuts</button>
    </header>
  );
}

function StatusBar({ status }: { status: { console_port?: number; gbrain_health?: { status?: string }; ollama?: { status?: string } } | null }) {
  const brainOk = !!status?.gbrain_health?.status && status.gbrain_health.status !== 'degraded';
  const ollamaOk = !!status?.ollama?.status && status.ollama.status !== 'offline';
  return (
    <div className="status-bar">
      <StatusPill label={brainOk ? 'brain ok' : 'brain down'} ok={brainOk} title="Core brain service" />
      <StatusPill label={ollamaOk ? 'ollama' : 'ollama off'} ok={ollamaOk} title="Local LLM runtime" />
      <span className="pill" data-tooltip="Console port">{status?.console_port ?? 7777}</span>
      <span className="muted" style={{ marginLeft: 'auto' }}>ForgeOS Brain Console • React/Express</span>
    </div>
  );
}

function StatCard({ title, value, subtitle, accent, danger }: { title: string; value: string | number; subtitle?: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`stat ${accent ? 'hl' : ''} ${danger ? 'danger' : ''}`}>
      <div className="h3">{title}</div>
      <div className="value">{value}</div>
      {subtitle ? <div className="caption">{subtitle}</div> : null}
    </div>
  );
}

function Dashboard({ status, roles }: { status: any; roles: any }) {
  const seeded = (roles?.roles || []).filter((r: any) => r.exists).length;
  const brainOk = status?.gbrain_health?.status === 'ok';
  const ollamaOk = status?.ollama?.status === 'online' || status?.ollama?.status === 'up';
  return (
    <div className="fadein">
      <div className="row" style={{ marginBottom: 24, gap: 10 }}>
        <StatusPill label={brainOk ? 'brain ok' : 'brain down'} ok={brainOk} title="Core brain service is healthy" />
        <StatusPill label={ollamaOk ? 'ollama' : 'ollama off'} ok={ollamaOk} title="Local LLM runtime available" />
        <span className="pill" data-tooltip="Embedding model for semantic search"><span className="dot" /> {status?.embedding_model || '—'}</span>
        <span className="pill" data-tooltip="Loaded knowledge pack">pack {(status?.schema || '').match(/forgeos/) ? 'forgeos' : '—'}</span>
        {status?.auth ? <span className="pill warn" data-tooltip="Authentication system is enabled"><span className="dot" /> auth on</span> : null}
      </div>

      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Isolation" value={status?.isolation || '—'} subtitle="PGLite brain ownership" />
        <StatCard title="Roles seeded" value={`${seeded}/7`} subtitle="C-suite roles" />
        <StatCard title="Console port" value={status?.console_port || '—'} subtitle="Public API surface" />
        <StatCard title="Health" value={brainOk ? 'Healthy' : 'Degraded'} subtitle={brainOk ? 'All systems nominal' : 'Check dependencies'} accent={!brainOk} danger={!brainOk} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Quick actions</h2>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <a className="btn primary" href="#/roles" onClick={(e) => { e.preventDefault(); window.location.hash = '#/roles'; }}>Roles</a>
          <button className="btn secondary" data-tooltip="Reload dashboard data" onClick={() => window.location.reload()}>Refresh</button>
          <a className="btn secondary" href="#/search" data-tooltip="Search across all brains" onClick={(e) => { e.preventDefault(); window.location.hash = '#/search'; }}>Search</a>
          <a className="btn secondary" href="#/capture" data-tooltip="Create new brain page" onClick={(e) => { e.preventDefault(); window.location.hash = '#/capture'; }}>Capture</a>
          <button className="btn secondary" data-tooltip="Copy current status as JSON" onClick={() => navigator.clipboard.writeText(JSON.stringify(status, null, 2))}>Copy status</button>
          <a className="btn secondary" href="#/embed" data-tooltip="Re-embed all knowledge" onClick={(e) => { e.preventDefault(); window.location.hash = '#/embed'; }}>Re-embed</a>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12 }}>live: connecting… <span data-tooltip="Time of last successful data fetch">(refreshed —)</span></p>
    </div>
  );
}

function Roles({ roles }: { roles: any }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const list = (roles?.roles || []) as any[];
  const filtered = list.filter((r) => {
    const matchesSearch = !q || (r.role || '').toLowerCase().includes(q) || (r.slug || '').toLowerCase().includes(q);
    const matchesStatus = !filter || (r.exists ? 'seeded' : 'missing') === filter;
    return matchesSearch && matchesStatus;
  });
  return (
    <div className="fadein">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>C-Suite Roles</h1>
        <span className="badge">{filtered.length}</span>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Search roles..."
              data-tooltip="Filter roles by name or slug"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input"
              style={{ width: 220 }}
            />
            <select
              data-tooltip="Filter by seeding status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="select"
              style={{ width: 180 }}
            >
              <option value="">All statuses</option>
              <option value="seeded">Seeded</option>
              <option value="missing">Missing</option>
            </select>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="pill" data-tooltip="Total C-suite roles">{filtered.length} roles</span>
            <button className="btn secondary sm" data-tooltip="Reload roles" onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </div>
        <div className="grid cols-2" style={{ marginTop: 12 }}>
          {filtered.map((r) => (
            <div key={r.slug} className="card elevated">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3>{r.role || r.slug}</h3>
                  <p className="muted mono">{r.slug}</p>
                </div>
                <span className={`tag ${r.exists ? 'success' : 'danger'}`}>{r.exists ? 'seeded' : 'missing'}</span>
              </div>
              <div className="divider" style={{ margin: '10px 0' }} />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="caption">reports_to</span>
                <span className="mono">{r.reports_to || '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Search({ data }: { data: any }) {
  const [q, setQ] = useState('');
  const lines = String(data?.raw || '').split('\n').filter(Boolean);
  return (
    <div className="fadein">
      <h1>Semantic Search</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn primary" onClick={() => { window.location.hash = `#/search?q=${encodeURIComponent(q)}`; }}>Search</button>
        </div>
      </div>
      {!lines.length ? <div className="empty">No results yet. Try capturing a page first.</div> : (
        <div className="stack">
          {lines.map((l: string, i: number) => {
            const m = l.match(/^\[([\d.]+)\]\s+(\S+)\s*--\s*(.*)$/s);
            const score = m ? m[1] : '';
            const slug = m ? m[2] : l;
            const body = m ? m[3] : '';
            return (
              <div key={i} className="card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <a className="link mono" href={`#/page/${encodeURIComponent(slug)}`}>{slug}</a>
                  <span className="pill">{score}</span>
                </div>
                <p className="muted" style={{ marginTop: 6 }}>{body.slice(0, 200)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Capture() {
  const [slug, setSlug] = useState('decisions/demo');
  const [type, setType] = useState('note');
  const [body, setBody] = useState('# Demo\nWrite something for the brain.');
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const validate = () => /^[\w\-/]+$/.test(slug) && slug.includes('/');
  const templates: Record<string, string> = {
    note: '# Note\n\n',
    decision: '# Decision\n\n## Context\n\n## Outcome\n\n',
    incident: '# Incident\n\n## Timeline\n\n## Resolution\n\n',
    meeting: '# Meeting Notes\n\n## Attendees\n\n## Agenda\n\n## Action Items\n\n',
    action: '# Action Item\n\n## Owner\n\n## Due Date\n\n## Status\n\n',
  };
  return (
    <div className="fadein">
      <h1>Capture Page</h1>
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="row"><label>slug</label><input className="mono" value={slug} onChange={(e) => setSlug(e.target.value)} style={{ flex: 1 }} /><button className="btn secondary" onClick={() => navigator.clipboard.writeText(slug)}>Copy</button></div>
        <div className="row" style={{ marginTop: 8 }}><label>type</label><input value={type} onChange={(e) => setType(e.target.value)} /></div>
        <div className="row" style={{ marginTop: 8 }}>
          <label>template</label>
          <select value="" onChange={(e) => { if (e.target.value) setBody(templates[e.target.value]); }} className="select">
            <option value="">-- choose template --</option>
            {Object.keys(templates).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ width: '100%', marginTop: 8, fontFamily: 'var(--mono)' }} />
        {preview ? <pre className="code json" style={{ marginTop: 8 }}>{preview}</pre> : null}
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <button className="btn primary" disabled={!validate() || loading} onClick={async () => {
            setLoading(true);
            try {
              await api('/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, type, body }) });
              window.location.hash = `#/page/${encodeURIComponent(slug)}`;
            } finally { setLoading(false); }
          }}>{loading ? 'Saving…' : 'Capture'}</button>
          <button className="btn secondary" onClick={() => setPreview(body)}>Preview</button>
          <button className="btn secondary" onClick={() => { setSlug('decisions/demo'); setType('note'); setBody('# Demo\nWrite something for the brain.'); setPreview(''); }}>Clear</button>
        </div>
      </div>
    </div>
  );
}

function Page({ slug }: { slug: string }) {
  const { data } = useApi<any>(`/api/page/${encodeURIComponent(slug)}`);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState('');
  const startEdit = () => { setEditBody(data?.body || ''); setEditing(true); };
  const save = async () => {
    await api('/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, type: 'note', body: editBody }) });
    setEditing(false);
    window.location.reload();
  };
  return (
    <div className="fadein">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="mono">{slug}</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy link</button>
          {!editing ? <button className="btn secondary" onClick={startEdit}>Edit</button> : <button className="btn primary" onClick={save}>Save</button>}
        </div>
      </div>
      {editing ? (
        <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={16} style={{ width: '100%', marginTop: 12, fontFamily: 'var(--mono)' }} />
      ) : (
        <pre className="code json" style={{ marginTop: 12 }}>{data?.body || 'Not found'}</pre>
      )}
    </div>
  );
}

function Decisions() {
  const { data } = useApi<any>('/api/ledger?from=2000-01-01');
  const [q, setQ] = useState('');
  const entries = (data?.ledger || []) as any[];
  const filtered = entries.filter((e) => !q || (e.title || '').toLowerCase().includes(q.toLowerCase()) || (e.mission || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fadein">
      <h1>Decisions & Incidents</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="pill">{entries.length} total</span>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Search decisions..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Mission</th><th>Outcome</th></tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.date}</td>
                  <td>{e.title}</td>
                  <td><span className="pill">{e.type}</span></td>
                  <td className="mono">{e.mission}</td>
                  <td><span className={`pill ${e.outcome === 'approved' ? 'ok' : e.outcome === 'pending' ? 'warn' : 'bad'}`}>{e.outcome}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TimelinePanel() {
  const { data } = useApi<any>('/api/timeline');
  const [q, setQ] = useState('');
  const items = (data?.timeline || []) as any[];
  const filtered = items.filter((i) => !q || (i.title || '').toLowerCase().includes(q.toLowerCase()) || (i.owner || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fadein">
      <h1>Timeline Engine</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Search milestones..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="timeline">
        {filtered.map((item: any) => (
          <div key={item.id} className={`tl-item ${item.status}`}>
            <div className="tl-time">{item.date}</div>
            <div className="tl-title">{item.title}</div>
            <div className="tl-meta">{item.owner} · <span className={`pill ${item.status === 'done' ? 'ok' : item.status === 'in-progress' ? 'warn' : ''}`}>{item.status}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LedgerPanel() {
  const { data } = useApi<any>('/api/ledger?from=2000-01-01');
  const entries = (data?.ledger || []) as any[];
  return (
    <div className="fadein">
      <h1>Decision Ledger</h1>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Mission</th><th>Outcome</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.date}</td>
                  <td>{e.title}</td>
                  <td><span className="pill">{e.type}</span></td>
                  <td className="mono">{e.mission}</td>
                  <td><span className={`pill ${e.outcome === 'approved' ? 'ok' : e.outcome === 'pending' ? 'warn' : 'bad'}`}>{e.outcome}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MissionsPanel() {
  const { data } = useApi<any>('/api/missions');
  const missions = (data?.missions || []) as any[];
  return (
    <div className="fadein">
      <h1>Missions</h1>
      <div className="stack">
        {missions.map((m: any) => (
          <div key={m.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{m.title}</h3>
                <p className="muted mono">{m.id} • {m.phase} • {m.owner}</p>
              </div>
              <span className={`pill ${m.status === 'done' ? 'ok' : m.status === 'proposed' ? 'warn' : 'bad'}`}>{m.status}</span>
            </div>
            <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${m.progress ?? 0}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompliancePanel() {
  const { data } = useApi<any>('/api/compliance');
  const policies = (data?.policies || []) as any[];
  return (
    <div className="fadein">
      <h1>Compliance</h1>
      <div className="stack">
        {policies.map((p: any) => (
          <div key={p.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{p.name}</h3>
                <p className="muted mono">{p.id}</p>
              </div>
              <span className={`tag ${p.status === 'active' ? 'success' : 'danger'}`}>{p.status}</span>
            </div>
            {p.lastCheck ? <p className="muted" style={{ marginTop: 8 }}>lastCheck: {p.lastCheck}</p> : null}
            {'limit' in p ? <p className="muted mono">limit: {p.limit}/min</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FederationPanel() {
  const { data } = useApi<any>('/api/federation');
  return (
    <div className="fadein">
      <h1>Federation</h1>
      <div className="card">
        <h3>Topology</h3>
        <p className="mono">{data?.root}</p>
        <p className="muted">{data?.model}</p>
        <div className="tags" style={{ marginTop: 8 }}>
          {(data?.children || []).map((c: string, i: number) => <span key={i} className="tag info">{c}</span>)}
        </div>
      </div>
    </div>
  );
}

function WebhooksPanel() {
  const { data } = useApi<any>('/api/webhooks');
  return (
    <div className="fadein">
      <h1>Webhooks</h1>
      <pre className="code json">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function NotFound() {
  return (
    <div className="fadein">
      <h1>404</h1>
      <p className="muted">This panel hasn't been wired yet.</p>
      <a className="btn primary" href="#/dashboard">Back to Dashboard</a>
    </div>
  );
}

export default function App() {
  const hash = useHashRoute();
  const route = useMemo(() => matchRoute(hash), [hash]);
  const { theme, setTheme, contrast, setContrast } = useTheme();
  const { showShortcuts, setShowShortcuts } = useShortcuts();
  const statusApi = useApi('/api/status');
  const rolesApi = useApi('/api/roles');
  const searchApi = useApi(`/api/search?q=${encodeURIComponent((new URLSearchParams(window.location.hash.split('?')[1] || '')).get('q') || '')}`);
  const missionsApi = useApi('/api/missions');
  const timelineApi = useApi('/api/timeline');
  const complianceApi = useApi('/api/compliance');
  const federationApi = useApi('/api/federation');
  const webhooksApi = useApi('/api/webhooks');
  const ledgerApi = useApi('/api/ledger?from=2000-01-01');

  const navigate = (r: string) => {
    window.location.hash = r;
  };

  const renderPanel = () => {
    switch (route) {
      case '#/dashboard':
        return <Dashboard status={statusApi.data} roles={rolesApi.data} />;
      case '#/roles':
        return <Roles roles={rolesApi.data} />;
      case '#/search':
        return <Search data={searchApi.data} />;
      case '#/capture':
        return <Capture />;
      case '#/decisions':
        return <Decisions />;
      case '#/timeline':
        return <TimelinePanel />;
      case '#/ledger':
        return <LedgerPanel />;
      case '#/missions':
        return <MissionsPanel />;
      case '#/compliance':
        return <CompliancePanel />;
      case '#/federation':
        return <FederationPanel />;
      case '#/webhooks':
        return <WebhooksPanel />;
      default:
        return <NotFound />;
    }
  };

  return (
    <div id="app">
      <Navbar
        route={route}
        onNavigate={navigate}
        theme={theme}
        setTheme={setTheme}
        contrast={contrast}
        setContrast={setContrast}
        onShortcuts={() => setShowShortcuts(true)}
      />
      <div className="layout">
        <Sidebar route={route} onNavigate={navigate} />
        <main className="main">
          <nav className="breadcrumb" aria-label="breadcrumb">
            <a href="#/dashboard" onClick={(e) => { e.preventDefault(); navigate('#/dashboard'); }}>ForgeOS</a>
            <span style={{ margin: '0 8px', color: 'var(--text-dim)' }}>/</span>
            <span style={{ color: 'var(--text)' }}>{route.replace('#/', '')}</span>
          </nav>
          {renderPanel()}
        </main>
      </div>
      <StatusBar status={statusApi.data} />
      {showShortcuts ? <ShortcutsOverlay onClose={() => setShowShortcuts(false)} /> : null}
      <div className="toasts" id="toasts" />
    </div>
  );
}
