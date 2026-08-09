import { useEffect, useState } from 'react';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

type Route = {
  slug: string;
  title: string;
  element: 'dashboard' | 'roles' | 'search' | 'capture' | 'status';
};

type AppState = {
  active: Route['element'];
  status: { ok?: boolean };
};

export default function App() {
  const [state, setState] = useState<AppState>({ active: 'status', status: { ok: false } });

  useEffect(() => {
    api<AppState['status']>('/api/health').then((status) => setState((s) => ({ ...s, status }))).catch(() => undefined);
  }, []);

  const navigate = (to: Route['element']) => setState((s) => ({ ...s, active: to }));

  return (
    <div className="layout">
      <aside className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="wordmark">Forge<span className="os">OS</span> Console</div>
        <nav className="nav-category-items">
          <a href="#/status" onClick={() => navigate('status')}>Status</a>
          <a href="#/roles" onClick={() => navigate('roles')}>Roles</a>
          <a href="#/search" onClick={() => navigate('search')}>Search</a>
          <a href="#/capture" onClick={() => navigate('capture')}>Capture</a>
        </nav>
      </aside>
      <main className="main" id="main" role="main" aria-live="polite" aria-label="Main content">
        {state.active === 'status' && (
          <section className="card">
            <h1 data-tooltip="Brain status">Brain Console</h1>
            <pre>{JSON.stringify(state.status, null, 2)}</pre>
          </section>
        )}
        {state.active === 'roles' && (
          <section className="card">
            <h1>Roles</h1>
            <RolesPanel />
          </section>
        )}
        {state.active === 'search' && (
          <section className="card">
            <h1>Search</h1>
            <SearchPanel />
          </section>
        )}
        {state.active === 'capture' && (
          <section className="card">
            <h1>Capture</h1>
            <CapturePanel />
          </section>
        )}
      </main>
    </div>
  );
}

function RolesPanel() {
  const [roles, setRoles] = useState<{ roles: Array<{ slug: string; role: string; exists: boolean }> } | null>(null);
  useEffect(() => { api('/api/roles').then(setRoles).catch(() => undefined); }, []);
  if (!roles) return <p className="muted">Loading roles…</p>;
  return (
    <div style={{ marginTop: 12 }}>
      {roles.roles.map((r) => (
        <div key={r.slug} className="row">
          <span>{r.slug}</span>
          <span className={`pill ${r.exists ? 'ok' : 'warn'}`}>{r.exists ? 'exists' : 'missing'}</span>
        </div>
      ))}
    </div>
  );
}

function SearchPanel() {
  const [q, setQ] = useState('');
  const [raw, setRaw] = useState('');
  const run = async () => {
    const data = await api<{ query: string; raw: string }>(`/api/search?q=${encodeURIComponent(q)}`);
    setRaw(data.raw);
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brain…" />
        <button className="btn primary" onClick={run}>Search</button>
      </div>
      <pre style={{ marginTop: 12 }}>{raw}</pre>
    </div>
  );
}

function CapturePanel() {
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const run = async () => {
    await api('/api/capture', { method: 'POST', body: JSON.stringify({ slug, type: 'note', body }) });
    setSlug('');
    setBody('');
    alert('saved');
  };
  return (
    <div style={{ marginTop: 12 }}>
      <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="body" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={run}>Capture</button>
      </div>
    </div>
  );
}
