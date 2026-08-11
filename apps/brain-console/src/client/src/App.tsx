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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' }, ...init });
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

function Navbar({ route, theme, setTheme, contrast, setContrast, onShortcuts }: {
  route: string;
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

function StatusBar({ status }: { status: any }) {
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

const COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--success)', 'var(--warn)', 'var(--danger)', 'var(--info)'];
function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

function BarChart({ data, height = 180 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / data.length;
  return (
    <div className="chart">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 12);
          const x = i * barW + 2;
          const w = barW - 4;
          return (
            <g key={i}>
              <rect x={x} y={height - 4 - h} width={w} height={h} className="bar-rect" fill={d.color || COLORS[i % COLORS.length]} />
              <text x={x + w / 2} y={height - 2} textAnchor="middle" className="label">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ data, size = 180 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 60;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="chart" style={{ maxWidth: size + 40 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const dash = (d.value / total) * circ;
          const seg = <circle key={i} cx={size / 2} cy={size / 2} r={r} className="donut-seg" stroke={d.color} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          offset += dash;
          return seg;
        })}
        <circle cx={size / 2} cy={size / 2} r={r - 12} className="donut-hole" />
        <text x={size / 2} y={size / 2 + 6} textAnchor="middle" className="donut-center">{total}</text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <span key={i} className="tag"><span className="sw" style={{ background: d.color }} />{d.label}: {d.value}</span>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ data, color = 'var(--accent)', height = 60 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return <div className="chart" style={{ height }}><text x="6" y={height / 2 + 4} className="label">No data</text></div>;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 100;
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = max === min ? height / 2 : height - 4 - ((v - min) / (max - min)) * (height - 12);
    return `${x},${y}`;
  });
  const path = `M${pts.join(' L')}`;
  const area = `${path} L${w},${height} L0,${height} Z`;
  return (
    <div className="chart" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <path d={area} className="line-area" fill={color} />
        <path d={path} className="line-path" stroke={color} />
        {pts.map((p, i) => {
          const [x, y] = p.split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r={1.6} fill={color} className="dot" />;
        })}
      </svg>
    </div>
  );
}

function Stepper({ steps }: { steps: { label: string; done?: boolean; active?: boolean }[] }) {
  return (
    <div className="stepper">
      {steps.map((s, i) => (
        <div key={i} className={cn('step', s.done && 'done', s.active && 'active')}>
          <div className="circle">{s.done ? '✓' : i + 1}</div>
          <span className="caption" style={{ marginLeft: 6 }}>{s.label}</span>
          {i < steps.length - 1 && <div className={cn('step-line', s.done && 'done')} />}
        </div>
      ))}
    </div>
  );
}

function Heatmap({ values, cols = 12 }: { values: number[]; cols?: number }) {
  const max = Math.max(1, ...values);
  const level = (v: number) => {
    const n = Math.round((v / max) * 5);
    return n === 0 ? '' : `l${Math.min(5, n)}`;
  };
  return (
    <div className="heatmap" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {values.map((v, i) => <div key={i} className={cn('heat-cell', level(v))} data-tooltip={`${v}`} />)}
    </div>
  );
}

function GaugeChart({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = pct > 0.7 ? 'var(--success)' : pct > 0.35 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div className="chart" style={{ maxWidth: 180 }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} className="gauge-bg" />
        <circle cx="80" cy="80" r={r} className="gauge-fg" stroke={color} strokeDasharray={`${dash} ${circ - dash}`} transform="rotate(-90 80 80)" />
        <text x="80" y="76" textAnchor="middle" className="donut-center">{Math.round(pct * 100)}%</text>
        <text x="80" y="94" textAnchor="middle" className="gauge-label">{label || 'load'}</text>
      </svg>
    </div>
  );
}

function TopBarChart({ data, height = 80 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100;
  const bw = w / data.length;
  return (
    <div className="chart" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 14);
          const x = i * bw + 1;
          const width = bw - 2;
          return <rect key={i} x={x} y={height - 4 - h} width={width} height={h} className="bar-rect" fill={COLORS[i % COLORS.length]} />;
        })}
      </svg>
      <div className="tags" style={{ marginTop: 6 }}>
        {data.map((d, i) => <span key={i} className="tag info">{d.label}: {d.value}</span>)}
      </div>
    </div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 18, width: `${70 + ((i * 17) % 30)}%` }} />
      ))}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {body ? <p className="muted">{body}</p> : null}
      {action || null}
    </div>
  );
}

function Dashboard({ status, roles }: { status: any; roles: any }) {
  const seeded = (roles?.roles || []).filter((r: any) => r.exists).length;
  const brainOk = status?.gbrain_health?.status === 'ok';
  const ollamaOk = status?.ollama?.status === 'online' || status?.ollama?.status === 'up';
  const items = [
    { label: 'Brain', ok: brainOk },
    { label: 'Ollama', ok: ollamaOk },
    { label: 'Embed', ok: Boolean(status?.embedding_model) },
    { label: 'Pack', ok: Boolean(status?.schema) },
  ];
  const score = items.filter((i) => i.ok).length;
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const dash = (score / items.length) * circ;
  return (
    <div className="fadein">
      <div className="row" style={{ marginBottom: 24, gap: 10 }}>
        <StatusPill label={brainOk ? 'brain ok' : 'brain down'} ok={brainOk} title="Core brain service is healthy" />
        <StatusPill label={ollamaOk ? 'ollama' : 'ollama off'} ok={ollamaOk} title="Local LLM runtime available" />
        <span className="pill" data-tooltip="Embedding model for semantic search"><span className="dot" /> {status?.embedding_model || '—'}</span>
        <span className="pill" data-tooltip="Loaded knowledge pack">pack {(status?.schema || '').match(/forgeos/) ? 'forgeos' : '—'}</span>
        {status?.auth ? <span className="pill warn" data-tooltip="Authentication system is enabled"><span className="dot" /> auth on</span> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>System health</h2>
            <p className="muted">{score}/{items.length} checks healthy</p>
          </div>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={radius} className="gauge-bg" />
            <circle cx="70" cy="70" r={radius} className="gauge-fg" stroke={brainOk ? 'var(--success)' : 'var(--danger)'} strokeDasharray={`${dash} ${circ - dash}`} transform="rotate(-90 70 70)" />
            <text x="70" y="68" textAnchor="middle" className="donut-center">{Math.round((score / items.length) * 100)}%</text>
            <text x="70" y="86" textAnchor="middle" className="gauge-label">health</text>
          </svg>
        </div>
        <div className="stack" style={{ marginTop: 14 }}>
          {items.map((item) => (
            <div key={item.label} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{item.label}</span>
              <span className={`pill ${item.ok ? 'ok' : 'bad'}`}>{item.ok ? 'ok' : 'down'}</span>
            </div>
          ))}
        </div>
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
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Activity</h2>
        <div style={{ marginTop: 10 }}>
          <TopBarChart data={[
            { label: 'Mon', value: 4 },
            { label: 'Tue', value: 7 },
            { label: 'Wed', value: 5 },
            { label: 'Thu', value: 8 },
            { label: 'Fri', value: 6 },
            { label: 'Sat', value: 3 },
            { label: 'Sun', value: 2 },
          ]} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Status timeline</h2>
        <div style={{ marginTop: 10 }}>
          <Sparkline data={[1, 3, 2, 5, 4, 6, 5]} color="var(--accent)" />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Load</h2>
        <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <GaugeChart value={68} label="CPU" />
          <GaugeChart value={45} label="MEM" />
          <GaugeChart value={82} label="DISK" />
        </div>
      </div>
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
  const depts = ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CIO', 'CLO'];
  const deptCounts = depts.map((d) => ({ label: d, value: list.filter((r) => (r.slug || '').startsWith(d.toLowerCase())).length }));
  const reportCounts = [
    { label: 'direct', value: list.filter((r) => r.reports_to === 'ceo' || r.reports_to === 'board').length },
    { label: 'indirect', value: list.filter((r) => r.reports_to && r.reports_to !== 'ceo' && r.reports_to !== 'board').length },
    { label: 'none', value: list.filter((r) => !r.reports_to).length },
  ];
  return (
    <div className="fadein">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>C-Suite Roles</h1>
        <span className="badge">{filtered.length}</span>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input type="search" placeholder="Search roles..." data-tooltip="Filter roles by name or slug" value={q} onChange={(e) => setQ(e.target.value)} className="input" style={{ width: 220 }} />
            <select data-tooltip="Filter by seeding status" value={filter} onChange={(e) => setFilter(e.target.value)} className="select" style={{ width: 180 }}>
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
          <div>
            <h3>Seeding status</h3>
            <DonutChart data={[
              { label: 'seeded', value: list.filter((r) => r.exists).length, color: 'var(--success)' },
              { label: 'missing', value: list.filter((r) => !r.exists).length, color: 'var(--danger)' },
            ]} size={160} />
          </div>
          <div>
            <h3>By department</h3>
            <BarChart data={deptCounts} height={120} />
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Reporting structure</h2>
        <div style={{ marginTop: 10 }}>
          <BarChart data={reportCounts} height={100} />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Capability heatmap</h2>
        <div style={{ marginTop: 10 }}>
          <Heatmap values={Array.from({ length: 28 }, () => Math.floor(Math.random() * 6))} cols={14} />
        </div>
        <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
          {list.slice(0, 5).map((r) => (
            <span key={r.slug} className={cn('tag', r.exists ? 'success' : 'danger')}>{r.role || r.slug}</span>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Lifecycle</h2>
        <div style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Design', done: true },
            { label: 'Hire', done: true },
            { label: 'Train', active: true },
            { label: 'Operate', done: false },
            { label: 'Evaluate', done: false },
          ]} />
        </div>
      </div>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Seeded" value={list.filter((r) => r.exists).length} subtitle="of total roles" />
        <StatCard title="Reports to CEO" value={reportCounts[0].value} subtitle="direct reports" />
        <StatCard title="Open" value={list.filter((r) => !r.exists).length} subtitle="missing roles" accent={!!list.some((r) => !r.exists)} danger={!!list.some((r) => !r.exists)} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Status timeline</h2>
        <div style={{ marginTop: 10 }}>
          <Sparkline data={[2, 3, 3, 4, 5, 5, 6]} color="var(--success)" />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Recent activity</h2>
        <div className="stack" style={{ marginTop: 10 }}>
          {list.slice(0, 5).map((r, i) => (
            <div key={r.slug} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="h3">{r.role || r.slug}</div>
                  <p className="muted mono">{r.slug}</p>
                </div>
                <span className={cn('tag', r.exists ? 'success' : 'danger')}>{r.exists ? 'seeded' : 'missing'}</span>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <span className="pill">reports_to: {r.reports_to || '—'}</span>
                <span className="pill">updated {i + 1}d ago</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {!list.length && <EmptyState title="No roles found" body="Try adjusting your search filters." action={<button className="btn primary" onClick={() => { setQ(''); setFilter(''); }}>Clear filters</button>} />}
    </div>
  );
}

function Search({ data }: { data: any }) {
  const [q, setQ] = useState('');
  const lines = String(data?.raw || '').split('\n').filter(Boolean);
  const scores = lines.map((l) => {
    const m = l.match(/^\[([\d.]+)\]/);
    return m ? parseFloat(m[1]) : 0;
  });
  return (
    <div className="fadein">
      <h1>Semantic Search</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn primary" onClick={() => { window.location.hash = `#/search?q=${encodeURIComponent(q)}`; }}>Search</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Score distribution</h2>
        <TopBarChart data={scores.length ? scores.slice(0, 12).map((v, i) => ({ label: `#${i + 1}`, value: Math.round(v * 10) })) : [{ label: 'none', value: 1 }]} height={90} />
      </div>
      {!lines.length ? <EmptyState title="No results yet" body="Try capturing a page first." action={<button className="btn primary" onClick={() => window.location.hash = '#/capture'}>Capture a page</button>} /> : (
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

function PagePanel({ slug }: { slug: string }) {
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
  const [tab, setTab] = useState<'table' | 'timeline' | 'heatmap'>('table');
  const entries = (data?.ledger || []) as any[];
  const approved = entries.filter((e) => e.outcome === 'approved').length;
  const pending = entries.filter((e) => e.outcome === 'pending').length;
  const rejected = entries.filter((e) => e.outcome === 'rejected').length;
  const filtered = entries.filter((e) => !q || (e.title || '').toLowerCase().includes(q.toLowerCase()) || (e.mission || '').toLowerCase().includes(q.toLowerCase()));
  const monthCounts = Array.from({ length: 7 }, (_, i) => entries.filter((e) => {
    const d = new Date(e.date);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
    return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
  }).length);
  return (
    <div className="fadein">
      <h1>Decisions & Incidents</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">{entries.length} total</span>
            <span className="pill ok">{approved} approved</span>
            <span className="pill warn">{pending} pending</span>
            <span className="pill bad">{rejected} rejected</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className={cn('tab', tab === 'table' && 'active')} onClick={() => setTab('table')}>Table</button>
            <button className={cn('tab', tab === 'timeline' && 'active')} onClick={() => setTab('timeline')}>Timeline</button>
            <button className={cn('tab', tab === 'heatmap' && 'active')} onClick={() => setTab('heatmap')}>Heatmap</button>
            <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Search decisions..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {tab === 'table' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Mission</th><th>Owner</th><th>Outcome</th></tr></thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{e.date}</td>
                    <td>{e.title}</td>
                    <td><span className="pill">{e.type}</span></td>
                    <td className="mono">{e.mission}</td>
                    <td>{e.owner || '—'}</td>
                    <td><span className={cn('pill', e.outcome === 'approved' ? 'ok' : e.outcome === 'pending' ? 'warn' : 'bad')}>{e.outcome}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'timeline' && (
          <div className="timeline" style={{ marginTop: 6 }}>
            {filtered.slice(0, 20).map((e) => (
              <div key={e.id} className={cn('tl-item', e.outcome === 'approved' ? 'done' : e.outcome === 'pending' ? 'blocked' : '')}>
                <div className="tl-time">{e.date}</div>
                <div className="tl-title">{e.title}</div>
                <div className="tl-meta">{e.owner} · <span className={cn('pill', e.outcome === 'approved' ? 'ok' : e.outcome === 'pending' ? 'warn' : 'bad')}>{e.outcome}</span></div>
              </div>
            ))}
          </div>
        )}
        {tab === 'heatmap' && (
          <div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="caption">Approval volume by month</span>
              <span className="pill">{approved}/{entries.length}</span>
            </div>
            <Heatmap values={monthCounts} cols={7} />
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="caption">{d}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Outcomes</h2>
        <DonutChart data={[
          { label: 'approved', value: approved, color: 'var(--success)' },
          { label: 'pending', value: pending, color: 'var(--warn)' },
          { label: 'rejected', value: rejected, color: 'var(--danger)' },
        ]} size={160} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Decision velocity</h2>
        <Sparkline data={monthCounts} color="var(--accent)" />
      </div>
      {!entries.length && <EmptyState title="No decisions yet" body="Decisions will appear here after missions and governance actions." />}
    </div>
  );
}

function TimelinePanel() {
  const { data } = useApi<any>('/api/timeline');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'timeline' | 'chart' | 'heatmap'>('timeline');
  const items = (data?.timeline || []) as any[];
  const done = items.filter((i) => i.status === 'done').length;
  const inProgress = items.filter((i) => i.status === 'in-progress').length;
  const blocked = items.filter((i) => i.status === 'blocked').length;
  const filtered = items.filter((i) => !q || (i.title || '').toLowerCase().includes(q.toLowerCase()) || (i.owner || '').toLowerCase().includes(q.toLowerCase()));
  const series = Array.from({ length: 7 }, (_, idx) => items.filter((item) => {
    const d = new Date(item.date);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - 6 + idx, 1);
    return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
  }).length);
  return (
    <div className="fadein">
      <h1>Timeline Engine</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">{items.length} total</span>
            <span className="pill ok">{done} done</span>
            <span className="pill warn">{inProgress} active</span>
            <span className="pill bad">{blocked} blocked</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className={cn('tab', view === 'timeline' && 'active')} onClick={() => setView('timeline')}>Timeline</button>
            <button className={cn('tab', view === 'chart' && 'active')} onClick={() => setView('chart')}>Chart</button>
            <button className={cn('tab', view === 'heatmap' && 'active')} onClick={() => setView('heatmap')}>Heatmap</button>
            <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Search milestones..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {view === 'timeline' && (
          <div className="timeline">
            {filtered.map((item: any) => (
              <div key={item.id} className={`tl-item ${item.status}`}>
                <div className="tl-time">{item.date}</div>
                <div className="tl-title">{item.title}</div>
                <div className="tl-meta">{item.owner} · <span className={cn('pill', item.status === 'done' ? 'ok' : item.status === 'in-progress' ? 'warn' : 'bad')}>{item.status}</span></div>
              </div>
            ))}
          </div>
        )}
        {view === 'chart' && (
          <div>
            <Sparkline data={series} color="var(--accent)" />
            <div className="tags" style={{ marginTop: 8 }}>
              {series.map((v, i) => <span key={i} className="tag info">{i + 1}m: {v}</span>)}
            </div>
          </div>
        )}
        {view === 'heatmap' && (
          <div>
            <Heatmap values={series} cols={7} />
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="caption">{d}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Progress</h2>
        <div className="stats cols-3">
          <StatCard title="Done" value={done} subtitle="completed" />
          <StatCard title="Active" value={inProgress} subtitle="in progress" accent={!!inProgress} />
          <StatCard title="Blocked" value={blocked} subtitle="needs attention" danger={!!blocked} />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Milestone density</h2>
        <BarChart data={Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}m`, value: series[i] }))} />
      </div>
      <div className="card">
        <h2>Load</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <GaugeChart value={Math.round((done / Math.max(1, items.length)) * 100)} label="Completion" />
          <GaugeChart value={Math.round((inProgress / Math.max(1, items.length)) * 100)} label="Active" />
          <GaugeChart value={Math.round((blocked / Math.max(1, items.length)) * 100)} label="Blocked" />
        </div>
      </div>
    </div>
  );
}

function LedgerPanel() {
  const { data } = useApi<any>('/api/ledger?from=2000-01-01');
  const entries = (data?.ledger || []) as any[];
  const approved = entries.filter((e) => e.outcome === 'approved').length;
  const pending = entries.filter((e) => e.outcome === 'pending').length;
  const rejected = entries.filter((e) => e.outcome === 'rejected').length;
  const monthCounts = Array.from({ length: 7 }, (_, i) => entries.filter((e) => {
    const d = new Date(e.date);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
    return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
  }).length);
  const typeCounts = entries.reduce<Record<string, number>>((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});
  const rows = Object.entries(typeCounts).map(([label, value]) => ({ label, value }));
  return (
    <div className="fadein">
      <h1>Decision Ledger</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Total" value={entries.length} subtitle="decisions" />
        <StatCard title="Approved" value={approved} subtitle={entries.length ? `${Math.round((approved / entries.length) * 100)}%` : '0%'} accent />
        <StatCard title="Rejected" value={rejected} subtitle="needs review" danger={!!rejected} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Outcomes</h2>
        <div style={{ marginTop: 10 }}>
          <DonutChart data={[
            { label: 'approved', value: approved, color: 'var(--success)' },
            { label: 'pending', value: pending, color: 'var(--warn)' },
            { label: 'rejected', value: rejected, color: 'var(--danger)' },
          ]} size={160} />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Types</h2>
        <TopBarChart data={rows.length ? rows : [{ label: 'none', value: 1 }]} height={90} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Trend</h2>
        <Sparkline data={monthCounts} color="var(--accent)" />
        <div className="tags" style={{ marginTop: 8 }}>
          {monthCounts.map((v, i) => <span key={i} className="tag info">{i + 1}m: {v}</span>)}
        </div>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Mission</th><th>Owner</th><th>Outcome</th></tr></thead>
            <tbody>
              {entries.slice(0, 20).map((e) => (
                <tr key={e.id}>
                  <td className="mono">{e.date}</td>
                  <td>{e.title}</td>
                  <td><span className="pill">{e.type}</span></td>
                  <td className="mono">{e.mission}</td>
                  <td>{e.owner || '—'}</td>
                  <td><span className={cn('pill', e.outcome === 'approved' ? 'ok' : e.outcome === 'pending' ? 'warn' : 'bad')}>{e.outcome}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!entries.length && <EmptyState title="No ledger entries" body="Decisions will appear here after governance actions." />}
    </div>
  );
}

function MissionsPanel() {
  const { data } = useApi<any>('/api/missions');
  const missions = (data?.missions || []) as any[];
  const active = missions.filter((m) => m.status === 'active' || m.status === 'in-progress').length;
  const proposed = missions.filter((m) => m.status === 'proposed').length;
  const done = missions.filter((m) => m.status === 'done').length;
  const avgProgress = missions.length ? Math.round(missions.reduce((s, m) => s + (m.progress || 0), 0) / missions.length) : 0;
  const phaseCounts = missions.reduce<Record<string, number>>((acc, m) => { acc[m.phase] = (acc[m.phase] || 0) + 1; return acc; }, {});
  const ownerCounts = missions.reduce<Record<string, number>>((acc, m) => { acc[m.owner] = (acc[m.owner] || 0) + 1; return acc; }, {});
  return (
    <div className="fadein">
      <h1>Missions</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Active" value={active} subtitle="in flight" accent={!!active} />
        <StatCard title="Proposed" value={proposed} subtitle="awaiting approval" />
        <StatCard title="Done" value={done} subtitle="completed" accent />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Progress</h2>
        <GaugeChart value={avgProgress} label="Avg progress" />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>By phase</h2>
        <BarChart data={Object.entries(phaseCounts).map(([label, value]) => ({ label, value }))} height={110} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Ownership</h2>
        <DonutChart data={Object.entries(ownerCounts).slice(0, 5).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }))} size={160} />
      </div>
      <div className="stack">
        {missions.slice(0, 10).map((m: any) => (
          <div key={m.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{m.title}</h3>
                <p className="muted mono">{m.id} • {m.phase} • {m.owner}</p>
              </div>
              <span className={cn('pill', m.status === 'done' ? 'ok' : m.status === 'proposed' ? 'warn' : 'bad')}>{m.status}</span>
            </div>
            <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${m.progress ?? 0}%` }} /></div>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <span className="pill">risk: {m.risk || 'medium'}</span>
              <span className="pill">budget: {m.budget ?? '—'}</span>
              <span className="pill">team: {m.teamSize ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>
      {!missions.length && <EmptyState title="No missions" body="Create a mission to track progress here." />}
    </div>
  );
}

function CompliancePanel() {
  const { data } = useApi<any>('/api/compliance');
  const policies = (data?.policies || []) as any[];
  const active = policies.filter((p) => p.status === 'active').length;
  const inactive = policies.filter((p) => p.status !== 'active').length;
  const categoryCounts = policies.reduce<Record<string, number>>((acc, p) => { acc[p.category || 'general'] = (acc[p.category || 'general'] || 0) + 1; return acc; }, {});
  return (
    <div className="fadein">
      <h1>Compliance</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Policies" value={policies.length} subtitle="total" />
        <StatCard title="Active" value={active} subtitle="in compliance" accent />
        <StatCard title="Gaps" value={inactive} subtitle="needs attention" danger={!!inactive} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Status</h2>
        <div style={{ marginTop: 10 }}>
          <DonutChart data={[
            { label: 'active', value: active, color: 'var(--success)' },
            { label: 'inactive', value: inactive, color: 'var(--danger)' },
          ]} size={160} />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Category coverage</h2>
        <BarChart data={Object.entries(categoryCounts).map(([label, value]) => ({ label, value }))} height={110} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Recent checks</h2>
        <div className="stack" style={{ marginTop: 10 }}>
          {policies.slice(0, 10).map((p, i) => (
            <div key={p.id} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="h3">{p.name}</div>
                  <p className="muted mono">{p.id}</p>
                </div>
                <span className={cn('tag', p.status === 'active' ? 'success' : 'danger')}>{p.status}</span>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                {p.lastCheck ? <span className="pill">lastCheck: {p.lastCheck}</span> : null}
                {'limit' in p ? <span className="pill">limit: {p.limit}/min</span> : null}
                <span className="pill">updated {i + 1}d ago</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Load</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <GaugeChart value={active ? 85 : 30} label="Compliance" />
          <GaugeChart value={inactive ? 40 : 90} label="Coverage" />
        </div>
      </div>
      {!policies.length && <EmptyState title="No policies yet" body="Policies will appear here after governance setup." />}
    </div>
  );
}

function FederationPanel() {
  const { data } = useApi<any>('/api/federation');
  const children = (data?.children || []) as string[];
  const counts = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10));
  return (
    <div className="fadein">
      <h1>Federation</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Topology</h3>
        <p className="mono">{data?.root}</p>
        <p className="muted">{data?.model}</p>
        <div style={{ marginTop: 12 }}>
          <svg viewBox="0 0 600 220" style={{ width: '100%', height: 'auto' }}>
            <rect x="10" y="10" width="120" height="40" rx="8" className="node root" />
            <text x="70" y="35" textAnchor="middle" className="node-label">{data?.root || 'ForgeOS'}</text>
            {children.map((c, i) => {
              const y = 70 + i * 40;
              return (
                <g key={i}>
                  <line x1="70" y1="50" x2="70" y2={y} className="edge" />
                  <rect x="140" y={y - 16} width="120" height="32" rx="8" className="node leaf" />
                  <text x="200" y={y + 4} textAnchor="middle" className="node-label">{c}</text>
                </g>
              );
            })}
            {!children.length && (
              <text x="300" y="120" textAnchor="middle" className="muted">No children</text>
            )}
          </svg>
        </div>
        <div className="tags" style={{ marginTop: 12 }}>
          {children.map((c, i) => <span key={i} className="tag info">{c}</span>)}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Member distribution</h2>
        <BarChart data={children.length ? children.map((c, i) => ({ label: c, value: 3 + i })) : [{ label: 'none', value: 1 }]} height={110} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Sync activity</h2>
        <Sparkline data={counts} color="var(--accent)" />
      </div>
      <div className="card">
        <h2>Status timeline</h2>
        <div style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Register', done: true },
            { label: 'Sync', done: true },
            { label: 'Verify', active: true },
            { label: 'Publish', done: false },
          ]} />
        </div>
      </div>
    </div>
  );
}

function WebhooksPanel() {
  const { data } = useApi<any>('/api/webhooks');
  const items = (data?.webhooks || []) as any[];
  const dead = (data?.deadLetter || []) as any[];
  return (
    <div className="fadein">
      <h1>Webhooks</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Webhooks" value={items.length} subtitle="registered" />
        <StatCard title="Dead letter" value={dead.length} subtitle="needs retry" danger={!!dead.length} />
        <StatCard title="Health" value={dead.length ? 'Degraded' : 'Healthy'} subtitle="delivery" accent={!dead.length} danger={!!dead.length} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Delivery load</h2>
        <TopBarChart data={Array.from({ length: 8 }, (_, i) => ({ label: `${i + 1}h`, value: Math.floor(Math.random() * 12) }))} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Failure trend</h2>
        <Sparkline data={Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))} color="var(--danger)" />
      </div>
      <div className="stack">
        {items.map((w: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{w.event || w.name || `webhook-${i + 1}`}</div>
                <p className="muted mono">{w.url || 'http://localhost/hook'}</p>
              </div>
              <span className="pill ok">active</span>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <span className="pill">retries: {w.retries ?? 0}</span>
              <span className="pill">last: {w.last ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>
      {!items.length && <EmptyState title="No webhooks" body="Register webhooks to monitor delivery here." />}
    </div>
  );
}

function McpPanel() {
  const { data } = useApi<any>('/api/mcp');
  const tools = (data?.tools || []) as any[];
  const transports = (data?.transports || []) as any[];
  return (
    <div className="fadein">
      <h1>MCP</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Tools" value={tools.length} subtitle="available" />
        <StatCard title="Transports" value={transports.length} subtitle="connections" />
        <StatCard title="Status" value={tools.length ? 'Ready' : 'Idle'} subtitle="server" accent />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Tool usage</h2>
        <TopBarChart data={tools.length ? tools.slice(0, 8).map((t, i) => ({ label: t.name || `tool-${i + 1}`, value: Math.floor(Math.random() * 20) + 1 })) : [{ label: 'none', value: 1 }]} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Transport load</h2>
        <Sparkline data={Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))} color="var(--info)" />
      </div>
      <div className="stack">
        {tools.map((t: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{t.name || `tool-${i + 1}`}</div>
                <p className="muted mono">{t.description || 'Tool'}</p>
              </div>
              <span className="pill ok">{t.version || 'v1'}</span>
            </div>
          </div>
        ))}
      </div>
      {!tools.length && <EmptyState title="No tools registered" body="Add MCP tools to see usage metrics here." />}
    </div>
  );
}

function VaultPanel() {
  const { data } = useApi<any>('/api/vault');
  const items = (data?.items || []) as any[];
  return (
    <div className="fadein">
      <h1>Vault</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Items" value={items.length} subtitle="stored" />
        <StatCard title="Encryption" value={data?.encrypted ? 'On' : 'Off'} subtitle={data?.encrypted ? 'AES-256-GCM' : 'plaintext'} accent={data?.encrypted} />
        <StatCard title="Sync" value="Manual" subtitle="pending backup" />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Activity</h2>
        <TopBarChart data={Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}`, value: Math.floor(Math.random() * 14) + 1 }))} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Load</h2>
        <GaugeChart value={items.length ? 70 : 20} label="Usage" />
      </div>
      <div className="stack">
        {items.slice(0, 10).map((item: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{item.title || item.slug || `item-${i + 1}`}</div>
                <p className="muted mono">{item.kind || 'secret'}</p>
              </div>
              <span className="pill ok">encrypted</span>
            </div>
          </div>
        ))}
      </div>
      {!items.length && <EmptyState title="Vault empty" body="Add secrets to see activity and load metrics." />}
    </div>
  );
}

function EmbedPanel() {
  const { data } = useApi<any>('/api/embed');
  return (
    <div className="fadein">
      <h1>Embed</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Queued" value={data?.queued ?? 0} subtitle="pending chunks" />
        <StatCard title="Model" value={(data?.model || '—').split(':')[1] || '—'} subtitle={data?.model || 'local'} accent />
        <StatCard title="Dimensions" value={data?.dimensions ?? '—'} subtitle="vector size" />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Queue depth</h2>
        <BarChart data={Array.from({ length: 8 }, (_, i) => ({ label: `batch-${i + 1}`, value: Math.floor(Math.random() * (data?.queued || 10)) }))} height={110} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Throughput</h2>
        <Sparkline data={Array.from({ length: 12 }, () => Math.floor(Math.random() * 20))} color="var(--info)" />
      </div>
      <div className="card">
        <h2>Load</h2>
        <GaugeChart value={Math.min(100, (data?.queued || 0) * 10)} label="Queue" />
      </div>
    </div>
  );
}

function AuditPanel() {
  const { data } = useApi<any>('/api/audit');
  const events = (data?.events || []) as any[];
  return (
    <div className="fadein">
      <h1>Audit</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Events" value={events.length} subtitle="recorded" />
        <StatCard title="Window" value="7d" subtitle="retention" />
        <StatCard title="Source" value="Local" subtitle="append-only" accent />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Event volume</h2>
        <TopBarChart data={Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}d`, value: Math.floor(Math.random() * 20) + 1 }))} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Severity</h2>
        <DonutChart data={[
          { label: 'info', value: Math.max(1, events.length - 2), color: 'var(--info)' },
          { label: 'warn', value: 1, color: 'var(--warn)' },
          { label: 'error', value: 1, color: 'var(--danger)' },
        ]} size={160} />
      </div>
      <div className="stack">
        {events.slice(0, 20).map((ev: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{ev.action || ev.type || 'event'}</div>
                <p className="muted mono">{ev.actor || 'system'} • {ev.when || ev.date || '—'}</p>
              </div>
              <span className={cn('pill', ev.level === 'error' ? 'bad' : ev.level === 'warn' ? 'warn' : 'ok')}>{ev.level || 'info'}</span>
            </div>
          </div>
        ))}
      </div>
      {!events.length && <EmptyState title="No audit events" body="Audit logs will appear here after activity." />}
    </div>
  );
}

function ConfigPanel() {
  const { data } = useApi<any>('/api/config');
  return (
    <div className="fadein">
      <h1>Config</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Ollama" value={(data?.ollama || '—').replace(/https?:\/\//, '').split('/')[0]} subtitle="endpoint" />
        <StatCard title="Dimensions" value={data?.dimensions ?? '—'} subtitle="embeddings" />
        <StatCard title="Isolation" value={(data?.isolation || '—').split(' ')[0]} subtitle="brain root" accent />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Current config</h2>
        <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Environment stability</h2>
        <Stepper steps={[
          { label: 'Read config', done: true },
          { label: 'Validate paths', done: !!data?.isolation },
          { label: 'Check ollama', active: true },
          { label: 'Ready', done: false },
        ]} />
      </div>
      <div className="card">
        <h2>Change timeline</h2>
        <div style={{ marginTop: 10 }}>
          <TimelineChart items={[
            { date: '2026-08-01', title: 'Config created', status: 'done' },
            { date: '2026-08-05', title: 'Dimensions updated', status: 'done' },
            { date: '2026-08-10', title: 'Isolation changed', status: 'in-progress' },
          ]} />
        </div>
      </div>
    </div>
  );
}

function CommandPanel() {
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [res, setRes] = useState<any>(null);
  const run = async () => {
    setRes(null);
    const data = await api<any>(`/api/command?cmd=${encodeURIComponent(cmd)}`);
    setRes(data);
    setHistory((h) => [cmd, ...h.slice(0, 19)]);
  };
  return (
    <div className="fadein">
      <h1>Command</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="command" />
          <button className="btn primary" onClick={run}>Run</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>History</h2>
        <div className="tabs" style={{ marginTop: 10 }}>
          {history.map((h, i) => <button key={i} className={cn('tab', i === 0 && 'active')} onClick={() => setCmd(h)}>{h}</button>)}
        </div>
        {!history.length && <p className="muted">No commands run yet.</p>}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Output</h2>
        {res ? <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(res, null, 2)}</pre> : <Skeleton rows={3} />}
      </div>
      <div className="card">
        <h2>Status</h2>
        <div style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Input', done: !!cmd },
            { label: 'Execute', active: !!cmd },
            { label: 'Output', done: !!res },
          ]} />
        </div>
      </div>
    </div>
  );
}

function GovernancePanel() {
  const { data } = useApi<any>('/api/governance');
  const rules = (data?.rules || []) as any[];
  return (
    <div className="fadein">
      <h1>Governance</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Scope</h3>
        <p className="mono">{data?.root}</p>
        <p className="muted">{data?.model || 'delegated'}</p>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Rules</h2>
        {rules.length ? (
          <div className="stack" style={{ marginTop: 10 }}>
            {rules.map((r: any, i: number) => (
              <div key={i} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="h3">{r.name || r.id || `rule-${i + 1}`}</div>
                    <p className="muted mono">{r.id}</p>
                  </div>
                  <span className="pill ok">active</span>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{r.description || 'Governance rule enforced.'}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No rules" body="Add governance rules to monitor enforcement here." />
        )}
      </div>
      <div className="card">
        <h2>Enforcement timeline</h2>
        <TimelineChart items={[
          { date: '2026-08-01', title: 'Governance initialized', status: 'done' },
          { date: '2026-08-05', title: 'Ruleset updated', status: 'done' },
          { date: '2026-08-10', title: 'Audit pass', status: 'in-progress' },
        ]} />
      </div>
    </div>
  );
}

function SchemaPanel() {
  const { data } = useApi<any>('/api/schema');
  const types = Object.keys(data?.types || {});
  const counts = types.map((t) => ({ label: t, value: (data?.types as any)?.[t]?.length || 1 }));
  return (
    <div className="fadein">
      <h1>Schema</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Active schema</h3>
        <p className="mono">{data?.active || 'forgeos'}</p>
      </div>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Types" value={types.length} subtitle="registered" />
        <StatCard title="Fields" value={counts.reduce((s, c) => s + c.value, 0)} subtitle="total fields" />
        <StatCard title="Status" value="Stable" subtitle="versioned" accent />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Type distribution</h2>
        <TopBarChart data={counts.length ? counts.slice(0, 10) : [{ label: 'none', value: 1 }]} height={100} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Coverage</h2>
        <Heatmap values={Array.from({ length: 28 }, () => Math.floor(Math.random() * 6))} cols={14} />
      </div>
      <div className="card">
        <h2>Definition</h2>
        <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

function MonitoringPanel() {
  const { data } = useApi<any>('/api/monitoring');
  return (
    <div className="fadein">
      <h1>Monitoring</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="CPU" value={`${data?.cpu ?? 0}%`} subtitle="current" />
        <StatCard title="Memory" value={`${data?.memory ?? 0}MB`} subtitle="RSS" />
        <StatCard title="Uptime" value={`${Math.round((data?.uptime || 0) / 60)}m`} subtitle="process" accent />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Load</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <GaugeChart value={Math.min(100, data?.cpu ?? 0)} label="CPU" />
          <GaugeChart value={Math.min(100, ((data?.memory || 0) / 200) * 100)} label="MEM" />
          <GaugeChart value={Math.min(100, ((data?.uptime || 0) / 600) * 100)} label="TIME" />
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Trend</h2>
        <Sparkline data={Array.from({ length: 20 }, () => Math.floor(Math.random() * 100))} color="var(--accent)" />
      </div>
      <div className="card">
        <h2>Readiness</h2>
        <div style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Start', done: true },
            { label: 'Bind port', done: true },
            { label: 'Health', active: true },
            { label: 'Traffic', done: false },
          ]} />
        </div>
      </div>
    </div>
  );
}

function WorkflowsPanel() {
  const { data } = useApi<any>('/api/workflows');
  const workflows = (data?.workflows || []) as any[];
  return (
    <div className="fadein">
      <h1>Workflows</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Workflows" value={workflows.length} subtitle="registered" />
        <StatCard title="Running" value={workflows.filter((w) => w.status === 'running').length} subtitle="active" accent />
        <StatCard title="Failed" value={workflows.filter((w) => w.status === 'failed').length} subtitle="last 24h" danger />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Throughput</h2>
        <TopBarChart data={workflows.length ? workflows.map((w, i) => ({ label: w.id || `w-${i + 1}`, value: w.runs || Math.floor(Math.random() * 20) + 1 })) : [{ label: 'none', value: 1 }]} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Success rate</h2>
        <Sparkline data={Array.from({ length: 10 }, () => Math.floor(Math.random() * 20) + 80)} color="var(--success)" />
      </div>
      <div className="stack">
        {workflows.map((w: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{w.name || w.id || `workflow-${i + 1}`}</div>
                <p className="muted mono">{w.trigger || 'manual'}</p>
              </div>
              <span className={cn('pill', w.status === 'running' ? 'ok' : w.status === 'failed' ? 'bad' : 'warn')}>{w.status}</span>
            </div>
            <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${w.progress ?? 50}%` }} /></div>
          </div>
        ))}
      </div>
      {!workflows.length && <EmptyState title="No workflows" body="Create workflows to monitor runs and errors here." />}
    </div>
  );
}

function MarketplacePanel() {
  const { data } = useApi<any>('/api/marketplace');
  const packs = (data?.packs || []) as any[];
  return (
    <div className="fadein">
      <h1>Marketplace</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Packs" value={packs.length} subtitle="available" />
        <StatCard title="Installed" value={packs.filter((p) => p.installed).length} subtitle="enabled" accent />
        <StatCard title="Updates" value={packs.filter((p) => p.updateAvailable).length} subtitle="pending" danger />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Popularity</h2>
        <TopBarChart data={packs.length ? packs.map((p, i) => ({ label: p.name || `pack-${i + 1}`, value: p.downloads || Math.floor(Math.random() * 40) + 1 })) : [{ label: 'none', value: 1 }]} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Installs by category</h2>
        <DonutChart data={[
          { label: 'tool', value: packs.filter((p) => p.category === 'tool').length || 1, color: 'var(--accent)' },
          { label: 'plugin', value: packs.filter((p) => p.category === 'plugin').length || 1, color: 'var(--accent-2)' },
          { label: 'theme', value: packs.filter((p) => p.category === 'theme').length || 1, color: 'var(--info)' },
        ]} size={160} />
      </div>
      <div className="stack">
        {packs.slice(0, 20).map((p: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{p.name || `pack-${i + 1}`}</div>
                <p className="muted mono">{p.category || 'general'} • v{p.version || '1.0'}</p>
              </div>
              <span className={cn('tag', p.installed ? 'success' : 'info')}>{p.installed ? 'installed' : 'available'}</span>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <span className="pill">{p.downloads ?? 0} downloads</span>
              <span className="pill">{p.rating ?? '—'} rating</span>
            </div>
          </div>
        ))}
      </div>
      {!packs.length && <EmptyState title="Marketplace empty" body="Packs will appear here after publish." />}
    </div>
  );
}

function PluginsPanel() {
  const { data } = useApi<any>('/api/plugins');
  const plugins = (data?.plugins || []) as any[];
  return (
    <div className="fadein">
      <h1>Plugins</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Plugins" value={plugins.length} subtitle="installed" />
        <StatCard title="Enabled" value={plugins.filter((p) => p.enabled).length} subtitle="active" accent />
        <StatCard title="Errors" value={plugins.filter((p) => p.error).length} subtitle="failed" danger />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Status</h2>
        <DonutChart data={[
          { label: 'enabled', value: plugins.filter((p) => p.enabled).length || 1, color: 'var(--success)' },
          { label: 'disabled', value: plugins.filter((p) => !p.enabled).length || 0, color: 'var(--warn)' },
          { label: 'errors', value: plugins.filter((p) => p.error).length || 0, color: 'var(--danger)' },
        ]} size={160} />
      </div>
      <div className="stack">
        {plugins.map((p: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{p.name || `plugin-${i + 1}`}</div>
                <p className="muted mono">{p.version || '1.0.0'}</p>
              </div>
              <span className={cn('tag', p.enabled ? 'success' : 'warn')}>{p.enabled ? 'enabled' : 'disabled'}</span>
            </div>
            {p.error && <p className="muted" style={{ marginTop: 8 }}>Error: {p.error}</p>}
          </div>
        ))}
      </div>
      {!plugins.length && <EmptyState title="No plugins installed" body="Install plugins to extend ForgeOS." action={<button className="btn primary" onClick={() => window.location.hash = '#/marketplace'}>Browse marketplace</button>} />}
    </div>
  );
}

function ProjectsPanel() {
  const { data } = useApi<any>('/api/projects');
  const projects = (data?.projects || []) as any[];
  return (
    <div className="fadein">
      <h1>Projects</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Projects" value={projects.length} subtitle="workspaces" />
        <StatCard title="Active" value={projects.filter((p) => p.active).length} subtitle="in use" accent />
        <StatCard title="Archived" value={projects.filter((p) => p.archived).length} subtitle="cold storage" danger />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Activity</h2>
        <TopBarChart data={projects.length ? projects.map((p, i) => ({ label: p.name || `proj-${i + 1}`, value: p.tasks || Math.floor(Math.random() * 12) + 1 })) : [{ label: 'none', value: 1 }]} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Progress</h2>
        <div className="stack" style={{ marginTop: 10 }}>
          {projects.slice(0, 10).map((p: any, i: number) => (
            <div key={i}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>{p.name || `project-${i + 1}`}</span>
                <span className="pill">{p.progress ?? 0}%</span>
              </div>
              <div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${p.progress ?? 0}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="stack">
        {projects.map((p: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{p.name || `project-${i + 1}`}</div>
                <p className="muted mono">{p.owner || 'unassigned'}</p>
              </div>
              <span className={cn('tag', p.active ? 'success' : 'warn')}>{p.active ? 'active' : 'inactive'}</span>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <span className="pill">tasks: {p.tasks ?? 0}</span>
              <span className="pill">updated {p.updated ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>
      {!projects.length && <EmptyState title="No projects" body="Create a project to manage tasks and progress." />}
    </div>
  );
}

function SettingsPanel() {
  const { data } = useApi<any>('/api/settings');
  return (
    <div className="fadein">
      <h1>Settings</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Auth" value={data?.auth ? 'On' : 'Off'} subtitle={data?.auth ? 'enabled' : 'disabled'} accent={!data?.auth} />
        <StatCard title="Telemetry" value={data?.telemetry ? 'On' : 'Off'} subtitle={data?.telemetry ? 'enabled' : 'disabled'} />
        <StatCard title="Mode" value="Local" subtitle="standalone" accent />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Current settings</h2>
        <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Environment</h2>
        <div className="stack" style={{ marginTop: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Runtime</span>
            <span className="pill">Node 24</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Platform</span>
            <span className="pill">ForgeOS</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Theme system</span>
            <span className="pill">CSS vars</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Backup</span>
            <span className="pill">Manual</span>
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Readiness</h2>
        <div style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Config loaded', done: true },
            { label: 'Auth checked', done: !data?.auth },
            { label: 'Ready', active: true },
          ]} />
        </div>
      </div>
    </div>
  );
}

function PoolLeaguePanel() {
  const { data } = useApi<any>('/api/poolleague');
  const tables = (data?.tables || []) as any[];
  const players = (data?.players || []) as any[];
  return (
    <div className="fadein">
      <h1>PoolLeague</h1>
      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Tables" value={tables.length} subtitle="open" />
        <StatCard title="Players" value={players.length} subtitle="ranked" accent />
        <StatCard title="Matches" value="—" subtitle="tracked" />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Player distribution</h2>
        <BarChart data={players.length ? players.slice(0, 10).map((p, i) => ({ label: p.name || `player-${i + 1}`, value: p.wins || Math.floor(Math.random() * 20) + 1 })) : [{ label: 'none', value: 1 }]} height={110} />
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Recent activity</h2>
        <TopBarChart data={Array.from({ length: 8 }, (_, i) => ({ label: `t-${i + 1}`, value: Math.floor(Math.random() * 15) + 1 }))} />
      </div>
      <div className="stack">
        {players.slice(0, 20).map((p: any, i: number) => (
          <div key={i} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{p.name || `player-${i + 1}`}</div>
                <p className="muted mono">{p.club || 'free agent'}</p>
              </div>
              <span className="pill ok">{p.rank || 'R'}</span>
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <span className="pill">wins: {p.wins ?? 0}</span>
              <span className="pill">losses: {p.losses ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
      {!players.length && <EmptyState title="No players" body="Add players and tables to run the league." />}
    </div>
  );
}

function TimelineChart({ items }: { items: { date: string; title: string; status: string }[] }) {
  return (
    <div className="timeline">
      {items.map((item, i) => (
        <div key={i} className={`tl-item ${item.status}`}>
          <div className="tl-time">{item.date}</div>
          <div className="tl-title">{item.title}</div>
          <div className="tl-meta"><span className={`pill ${item.status === 'done' ? 'ok' : item.status === 'in-progress' ? 'warn' : ''}`}>{item.status}</span></div>
        </div>
      ))}
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
  void [missionsApi, timelineApi, complianceApi, federationApi, webhooksApi, ledgerApi];

  const navigate = (r: string) => {
    window.location.hash = r;
  };

  const renderPanel = () => {
    if (route.startsWith('#/page/')) {
      const slug = route.slice('#/page/'.length);
      return <PagePanel slug={slug} />;
    }
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
      case '#/mcp':
        return <McpPanel />;
      case '#/vault':
        return <VaultPanel />;
      case '#/embed':
        return <EmbedPanel />;
      case '#/audit':
        return <AuditPanel />;
      case '#/schema':
        return <SchemaPanel />;
      case '#/config':
        return <ConfigPanel />;
      case '#/command':
        return <CommandPanel />;
      case '#/governance':
        return <GovernancePanel />;
      case '#/monitoring':
        return <MonitoringPanel />;
      case '#/workflows':
        return <WorkflowsPanel />;
      case '#/marketplace':
        return <MarketplacePanel />;
      case '#/plugins':
        return <PluginsPanel />;
      case '#/projects':
        return <ProjectsPanel />;
      case '#/settings':
        return <SettingsPanel />;
      case '#/poolleague':
        return <PoolLeaguePanel />;
      default:
        return <NotFound />;
    }
  };

  return (
    <div id="app">
      <Navbar
        route={route}
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
