import { Component, useEffect, useMemo, useCallback, useState } from 'react';
import { createForgeOSClient } from '../../../../sdk/src/index.ts';
import { exportCsv } from './panelkit';
import { OfflineIndicator } from './offline';
import { isFeatureRoute, renderFeature, FEATURE_CATEGORIES } from './features/dispatch';
import RateLimitDashboard from './RateLimitDashboard';

if (typeof window !== 'undefined') {
  window.addEventListener('load', async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(async (reg) => {
      try {
        await reg.unregister();
      } catch {}
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('forgeos-'))
          .map((name) => caches.delete(name))
      );
    }));
  });
}

export class DebugErrorBoundary extends Component<{ children?: React.ReactNode }, { error: Error | null; info: any }> {
  state = { error: null as Error | null, info: null as any };
  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }
  componentDidCatch(error: Error, info: any) {
    this.setState({ error, info });
    console.error('[DebugErrorBoundary]', error, info);
  }
  reset = () => this.setState({ error: null, info: null });
  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-icon" aria-hidden="true">⚠️</div>
          <h2 className="error-boundary-title">This panel hit a snag</h2>
          <p className="error-boundary-msg">{String(this.state.error.message)}</p>
          <details className="error-boundary-details">
            <summary>Technical details</summary>
            <pre>{String(this.state.info?.componentStack || this.state.info || '').slice(0, 4000)}</pre>
          </details>
          <div className="error-boundary-actions">
            <button className="btn primary" onClick={this.reset}>Try again</button>
            <button className="btn secondary" onClick={() => { this.reset(); if (typeof location !== 'undefined') location.reload(); }}>Reload console</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type Route =
  | '/dashboard'
  | '/roles'
  | '/page/:slug'
  | '/search'
  | '/capture'
  | '/decisions'
  | '/timeline'
  | '/ledger'
  | '/missions'
  | '/mcp'
  | '/vault'
  | '/embed'
  | '/federation'
  | '/audit'
  | '/schema'
  | '/config'
  | '/command'
  | '/compliance'
  | '/governance'
  | '/monitoring'
  | '/workflows'
  | '/marketplace'
  | '/plugins'
  | '/projects'
  | '/settings'
  | '/poolleague'
  | '/webhooks'
  | '/apps'
  | '/self-improve'
  | '/developers';

const ROUTES: Route[] = [
  '/dashboard',
  '/roles',
  '/search',
  '/capture',
  '/decisions',
  '/timeline',
  '/ledger',
  '/missions',
  '/mcp',
  '/vault',
  '/embed',
  '/federation',
  '/audit',
  '/schema',
  '/config',
  '/command',
  '/compliance',
  '/governance',
  '/monitoring',
  '/workflows',
  '/marketplace',
  '/plugins',
  '/projects',
  '/settings',
  '/poolleague',
  '/webhooks',
  '/apps',
  '/self-improve',
  '/developers',
];

const THEME_PREFIX = 'forgeos-theme-';
const THEMES = [
  { id: 'system', label: 'System', color: '#adc6ff' },
  { id: 'dark', label: 'Dark', color: '#10131b' },
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
  ['a', 'Apps', 'Go to app store'],
  ['?', 'Shortcuts', 'Show shortcuts'],
  ['Esc', 'Close', 'Close dialogs/overlays'],
];

const CATEGORIES = [
  { title: 'Core', items: ['/dashboard', '/roles', '/search', '/capture', '/apps', '/developers'] },
  { title: 'Knowledge', items: ['/decisions', '/timeline', '/ledger', '/vault', '/embed'] },
  { title: 'Governance', items: ['/missions', '/federation', '/audit', '/schema', '/governance', '/compliance', '/webhooks'] },
  { title: 'Platform', items: ['/mcp', '/plugins', '/marketplace', '/workflows', '/monitoring', '/projects', '/poolleague'] },
  { title: 'System', items: ['/config', '/command', '/settings', '/self-improve'] },
  ...FEATURE_CATEGORIES,
];

function usePathRoute() {
  const [path, setPath] = useState(() => typeof window !== 'undefined' ? window.location.pathname || '/dashboard' : '/dashboard');
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/dashboard');
    window.addEventListener('popstate', onPop, false);
    return () => window.removeEventListener('popstate', onPop, false);
  }, []);
  const navigate = useCallback((r: string) => {
    window.history.pushState({}, '', r);
    setPath(r);
  }, []);
  return { path, navigate };
}

function matchRoute(path: string): string {
  if (!path || path === '/') return '/dashboard';
  const base = path.split('?')[0].split('/')[1];
  const found = ROUTES.find((r) => {
    if (r === '/page/:slug') return base === 'page';
    return r === `/${base}`;
  });
  return found || path;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' }, ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, tick]);
  return { data, error, loading, reload };
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

function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'k') { ev.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', handler, false);
    return () => window.removeEventListener('keydown', handler, false);
  }, []);
  return { open, setOpen };
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

function CommandPalette({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (r: string) => void }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entries: { route: string; label: string }[] = [];
    for (const cat of CATEGORIES) {
      for (const item of cat.items) {
        const label = item.replace(/^\//, '').charAt(0).toUpperCase() + item.replace(/^\//, '').slice(1);
        if (!q || label.toLowerCase().includes(q) || item.toLowerCase().includes(q)) entries.push({ route: item, label });
      }
    }
    return entries;
  }, [query]);

  useEffect(() => {
    if (open) setSelectedIndex(0);
  }, [open, items.length]);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      if (!open) return;
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const target = items[selectedIndex];
        if (target) {
          onNavigate(target.route);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler, false);
    return () => window.removeEventListener('keydown', handler, false);
  }, [open, items, selectedIndex, onClose, onNavigate]);

  useEffect(() => {
    const el = document.getElementById('command-palette');
    if (el) el.classList.toggle('open', open);
    return () => { if (el) el.classList.remove('open'); };
  }, [open]);

  return (
    <div id="command-palette" className={`cmdk ${open ? 'open' : ''}`} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Type a route..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul>
          {items.slice(0, 20).map((item, idx) => (
            <li key={item.route} className={`${idx === selectedIndex ? 'sel' : ''} ${item.route === '/dashboard' && idx !== selectedIndex ? '' : ''}`} onClick={() => { onNavigate(item.route); onClose(); }}>
              <span className="mono muted" style={{ marginRight: 8 }}>{item.route}</span>
              <span>{item.label}</span>
            </li>
          ))}
          {items.length === 0 ? <li className="muted">No routes found</li> : null}
        </ul>
        <div className="row" style={{ justifyContent: 'space-between', padding: '8px 12px' }}>
          <span className="muted mono"><span className="kbd">↑↓</span> navigate · <span className="kbd">↵</span> open · <span className="kbd">esc</span> close</span>
          <button className="btn sm secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ route, onNavigate }: { route: string; onNavigate: (r: string) => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const toggle = (title: string) => setCollapsed((p) => ({ ...p, [title]: !p[title] }));
  const q = query.trim().toLowerCase();

  return (
    <nav className="sidenav" aria-label="primary">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" aria-hidden="true" />
          <div>
            <div className="sidebar-brand-title">KNOWLEDGE_CORE</div>
            <div className="sidebar-brand-sub">v2.0.4 stable</div>
          </div>
        </div>
        <button className="btn primary sm" onClick={() => onNavigate('/capture')}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          NEW_NODE
        </button>
      </div>
      <div className="sidebar-search">
        <input
          type="search"
          placeholder="Filter navigation..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter navigation"
        />
      </div>
      {CATEGORIES.map((cat) => {
        const items = cat.items.filter((r) => {
          if (!q) return true;
          const label = r.replace(/^\//, '').toLowerCase();
          return label.includes(q) || r.toLowerCase().includes(q);
        });
        if (!items.length) return null;
        return (
          <div key={cat.title} className={`nav-category ${collapsed[cat.title] ? 'collapsed' : ''}`}>
            <div className="nav-category-header" onClick={() => toggle(cat.title)}>{cat.title}</div>
            <div className="nav-category-items">
              {items.map((r) => {
                const label = r.replace(/^\//, '').charAt(0).toUpperCase() + r.replace(/^\//, '').slice(1);
                return (
                  <a key={r} href={r} className={route === r ? 'active' : ''} onClick={(e) => { e.preventDefault(); onNavigate(r); }}>
                    {label}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function formatIsolation(value: string | undefined) {
  if (!value) return '—';
  const m = String(value).match(/C:\\Projects\\ForgeOS|\/Projects\/ForgeOS|ForgeOS/);
  const short = m ? m[0] : String(value);
  const suffix = String(value).includes('separate from') ? ' (isolated)' : '';
  return short + suffix;
}

function StatCard({ title, value, subtitle, accent, danger, valueClassName, accentColor }: { title: string; value: string | number; subtitle?: string; accent?: boolean; danger?: boolean; valueClassName?: string; accentColor?: string }) {
  const style = accentColor ? { borderLeft: `3px solid ${accentColor}` } : undefined;
  return (
    <div className={`stat ${accent ? 'hl' : ''} ${danger ? 'danger' : ''}`} style={style}>
      <div className="h3">{title}</div>
      <div className={`value ${valueClassName || ''}`}>{value}</div>
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
  const count = Math.max(1, data.length);
  const gap = 18;
  const barW = (220 - gap * (count + 1)) / count;
  const vbW = 220;
  const vbH = 120;
  const baseline = vbH - 24;
  const barMaxH = baseline - 16;
  if (!data.length) return <div className="chart" role="img" aria-label="Bar chart: no data" style={{ height }}><text x="6" y={height / 2 + 4} className="label">No data</text></div>;
  return (
    <div className="chart">
      <svg role="img" aria-label={`Bar chart — ${data.map((d) => `${d.label}: ${d.value}`).join(', ')}`} viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" style={{ height, width: '100%' }}>
        <line x1={0} y1={baseline - 0.5} x2={vbW} y2={baseline - 0.5} className="chart-grid" />
        {data.map((d, i) => {
          const rawH = (d.value / max) * barMaxH;
          const h = Math.max(2, rawH);
          const x = gap + i * (barW + gap);
          const empty = d.value === 0;
          return (
            <g key={i}>
              <rect x={x} y={baseline - 4 - h} width={barW} height={h} rx="2" className={cn('bar-rect', empty ? 'empty' : '')} fill={d.color || COLORS[i % COLORS.length]} opacity={empty ? 0.35 : 1} />
              {!empty && <text x={x + barW / 2} y={baseline - 8 - h} textAnchor="middle" className="bar-value">{d.value}</text>}
              <text x={x + barW / 2} y={baseline + 18} textAnchor="middle" className="label">{d.label}</text>
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
  if (!data.length) return <div className="chart" role="img" aria-label="Donut chart: no data" style={{ maxWidth: size + 40 }}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><text x={size / 2} y={size / 2 + 5} textAnchor="middle" className="label">No data</text></svg></div>;
  return (
    <div className="chart" style={{ maxWidth: size + 40 }}>
      <svg role="img" aria-label={`Donut chart — total ${total}, segments: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const dash = (d.value / total) * circ;
          const seg = <circle key={i} cx={size / 2} cy={size / 2} r={r} className="donut-seg" stroke={d.color} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          offset += dash;
          return seg;
        })}
        <circle cx={size / 2} cy={size / 2} r={r - 12} className="donut-hole" />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" className="donut-center">{total}</text>
        <text x={size / 2} y={size / 2 + 20} textAnchor="middle" className="donut-sub">total</text>
      </svg>
      <div className="donut-legend">
        {data.map((d, i) => (
          <span key={i} className="tag"><span className="sw" style={{ background: d.color }} />{d.label}: <strong>{d.value}</strong></span>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ data, color = 'var(--accent)', height = 60 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return <div className="chart" role="img" aria-label="Sparkline: no data" style={{ height }}><text x="6" y={height / 2 + 4} className="label">No data</text></div>;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 100;
  const chartH = height - 16;
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
    const y = max === min ? chartH / 2 : chartH - 4 - ((v - min) / (max - min)) * (chartH - 8);
    return `${x},${y}`;
  });
  const path = `M${pts.join(' L')}`;
  const area = `${path} L${w},${chartH} L0,${chartH} Z`;
  const avg = Math.round((data.reduce((s, v) => s + v, 0) / data.length) * 10) / 10;
  return (
    <div className="chart" style={{ height }}>
      <svg role="img" aria-label={`Sparkline — avg ${avg}, min ${min}, max ${max}`} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet">
        <path d={area} className="line-area" fill={color} />
        <path d={path} className="line-path" stroke={color} />
        <line x1={0} y1={chartH - 0.5} x2={w} y2={chartH - 0.5} className="chart-grid" />
        <text x="4" y="12" className="label">avg: {avg}</text>
        <text x="4" y={height - 4} className="label">min: {min}</text>
        <text x={w - 4} y={height - 4} textAnchor="end" className="label">max: {max}</text>
        {pts.map((p, i) => {
          const [x, y] = p.split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r="1.8" fill={color} className="dot" />;
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

function Heatmap({ values, cols = 12, title, unit }: { values: number[]; cols?: number; title?: string; unit?: string }) {
  const max = Math.max(1, ...values);
  const level = (v: number) => {
    const n = Math.round((v / max) * 5);
    return n === 0 ? '' : `l${Math.min(5, n)}`;
  };
  const avg = values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : 0;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayAvgs = Array.from({ length: 7 }, (_, d) => {
    const dayVals = values.filter((_, i) => i % 7 === d);
    return dayVals.length ? Math.round((dayVals.reduce((s, v) => s + v, 0) / dayVals.length) * 10) / 10 : 0;
  });
  if (!values.length) return <div className="chart"><p className="muted">No heatmap data yet.</p></div>;
  const legendItems = [1, 2, 3, 4, 5].map((n) => ({ level: `l${n}`, label: `${Math.round((n / 5) * max)}${unit ? ` ${unit}` : ''}` }));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        {title ? <span className="caption">{title}</span> : null}
        <span className="caption muted">avg: {avg}{unit ? ` ${unit}` : ''}</span>
        <span className="chart-legend" style={{ marginLeft: 'auto' }}>
          {legendItems.map((item) => (
            <span key={item.level} className="tag"><span className={cn('sw', item.level)} style={{ width: 10, height: 10, borderRadius: 2, display: 'inline-block' }} />{item.label}</span>
          ))}
        </span>
      </div>
      <div className="heatmap" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {values.map((v, i) => (
          <div key={i} className={cn('heat-cell', level(v))} data-tooltip={`Day ${i + 1}: ${v}${unit ? ` ${unit}` : ''} (avg ${avg})`} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {dayAvgs.map((v, i) => (
          <span key={i} className="tag">{days[i]} avg: <strong>{v}{unit ? ` ${unit}` : ''}</strong></span>
        ))}
      </div>
    </div>
  );
}

function GaugeChart({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = pct > 0.7 ? 'var(--success)' : pct > 0.35 ? 'var(--warn)' : 'var(--danger)';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const angle = Math.PI * 2 * t - Math.PI / 2;
    const x1 = 80 + Math.cos(angle) * (r - 8);
    const y1 = 80 + Math.sin(angle) * (r - 8);
    const x2 = 80 + Math.cos(angle) * (r + 2);
    const y2 = 80 + Math.sin(angle) * (r + 2);
    const lx = 80 + Math.cos(angle) * (r + 14);
    const ly = 80 + Math.sin(angle) * (r + 14);
    return (
      <g key={t}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-ticks" />
        <text x={lx} y={ly + 3} textAnchor="middle" className="label">{Math.round(t * max)}</text>
      </g>
    );
  });
  if (!Number.isFinite(value) && !Number.isFinite(max)) return <div className="chart" role="img" aria-label="Gauge: no data" style={{ maxWidth: 180 }}><p className="muted">No gauge data yet.</p></div>;
  return (
    <div className="chart" style={{ maxWidth: 180 }}>
      <svg role="img" aria-label={`Gauge — ${label || 'load'}: ${Math.round(pct * 100)}%`} width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} className="gauge-bg" />
        {ticks}
        <circle cx="80" cy="80" r={r} className="gauge-fg" stroke={color} strokeDasharray={`${dash} ${circ - dash}`} transform="rotate(-90 80 80)" />
        <text x="80" y="74" textAnchor="middle" className="donut-center">{Math.round(pct * 100)}%</text>
        <text x="80" y="92" textAnchor="middle" className="gauge-label">{label || 'load'}</text>
      </svg>
    </div>
  );
}

function TopBarChart({ data, height = 80 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100;
  const gap = 6;
  const count = Math.max(1, data.length);
  const bw = (w - gap * (count + 1)) / count;
  const vbH = 70;
  const baseline = vbH - 14;
  const barMaxH = baseline - 8;
  if (!data.length) return <div className="chart" role="img" aria-label="Bar chart: no data" style={{ height }}><text x="6" y={height / 2 + 4} className="label">No data</text></div>;
  return (
    <div className="chart">
      <svg role="img" aria-label={`Bar chart — ${data.map((d) => `${d.label}: ${d.value}`).join(', ')}`} viewBox={`0 0 ${w} ${vbH}`} preserveAspectRatio="xMidYMid meet" style={{ height }}>
        <line x1={0} y1={baseline - 0.5} x2={w} y2={baseline - 0.5} className="chart-grid" />
        {data.map((d, i) => {
          const rawH = (d.value / max) * barMaxH;
          const h = Math.max(2, rawH);
          const x = gap + i * (bw + gap);
          const empty = d.value === 0;
          return (
            <g key={i}>
              <rect x={x} y={baseline - 4 - h} width={bw} height={h} rx="2" className={cn('bar-rect', empty ? 'empty' : '')} fill={COLORS[i % COLORS.length]} opacity={empty ? 0.35 : 1} />
              {!empty && <text x={x + bw / 2} y={baseline - 6 - h} textAnchor="middle" className="bar-value">{d.value}</text>}
              <text x={x + bw / 2} y={baseline + 12} textAnchor="middle" className="label">{d.label}</text>
            </g>
          );
        })}
      </svg>
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
      <div className="empty-state-header">
        <div className="empty-state-title">{title}</div>
        {body ? <div className="empty-state-body">{body}</div> : null}
      </div>
      {action || null}
    </div>
  );
}

function Dashboard({ status, roles }: { status: any; roles: any }) {
  const { navigate } = usePathRoute();
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
      <div className="bento-grid">
      <div className="card">
          <div className="section-header">
            <h2>System health</h2>
            <span className="subtitle">{score}/{items.length} checks healthy</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <svg width="120" height="120" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radius} className="gauge-bg" />
              <circle cx="70" cy="70" r={radius} className="gauge-fg" stroke={brainOk ? 'var(--success)' : 'var(--danger)'} strokeDasharray={`${dash} ${circ - dash}`} transform="rotate(-90 70 70)" />
              <text x="70" y="68" textAnchor="middle" className="donut-center">{Math.round((score / items.length) * 100)}%</text>
              <text x="70" y="86" textAnchor="middle" className="gauge-label">health</text>
            </svg>
            <div className="stack stack-sm">
              {items.map((item) => (
                <div key={item.label} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{item.label}</span>
                  <span className={`pill ${item.ok ? 'ok' : 'bad'}`}>{item.ok ? 'ok' : 'down'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Quick actions</h2>
            <span className="subtitle">Common tasks</span>
          </div>
          <div className="row gap-2 mt-2 wrap items-center">
            <a className="btn primary" onClick={() => navigate('/roles')}>Roles</a>
            <button className="btn secondary" data-tooltip="Reload dashboard data" onClick={() => window.location.reload()}>Refresh</button>
            <a className="btn secondary" onClick={() => navigate('/search')} data-tooltip="Search across all brains">Search</a>
            <a className="btn secondary" onClick={() => navigate('/capture')} data-tooltip="Create new brain page">Capture</a>
            <button className="btn secondary" data-tooltip="Copy current status as JSON" onClick={() => navigator.clipboard.writeText(JSON.stringify(status, null, 2))}>Copy status</button>
            <a className="btn secondary" onClick={() => navigate('/embed')} data-tooltip="Re-embed all knowledge">Re-embed</a>
          </div>
          <p className="muted mt-3">live: connecting… <span data-tooltip="Time of last successful data fetch">(refreshed —)</span></p>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Activity</h2>
            <span className="subtitle">Recent console events</span>
          </div>
          <div className="mt-2">
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
        <div className="card">
          <div className="section-header">
            <h2>Status timeline</h2>
            <span className="subtitle">Last 7 checks</span>
          </div>
          <div className="mt-2">
            <Sparkline data={[1, 3, 2, 5, 4, 6, 5]} color="var(--accent)" />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Load</h2>
            <span className="subtitle">System resources</span>
          </div>
          <div className="mt-2" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <GaugeChart value={68} label="CPU" />
            <GaugeChart value={45} label="MEM" />
            <GaugeChart value={82} label="DISK" />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="stats cols-4 dashboard-stats mt-4">
          <StatCard title="Isolation" value={formatIsolation(status?.isolation)} subtitle="PGLite brain ownership" accentColor="var(--accent)" />
          <StatCard title="Roles seeded" value={`${seeded}/7`} subtitle="C-suite roles" accentColor="var(--accent-2)" />
          <StatCard title="Console port" value={String(status?.console_port || '—')} subtitle={status?.console_port ? 'Listening on 127.0.0.1' : 'Not listening'} accentColor="var(--info)" />
          <StatCard title="Health" value={brainOk ? 'Healthy' : 'Degraded'} subtitle={brainOk ? 'All systems nominal' : 'Check dependencies'} accent={!brainOk} danger={!brainOk} accentColor={brainOk ? 'var(--success)' : 'var(--danger)'} />
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
  const seen = new Set();
  const uniqueDeptCounts = deptCounts.filter((d) => {
    if (seen.has(d.label)) return false;
    seen.add(d.label);
    return true;
  });
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
            <BarChart data={uniqueDeptCounts} height={120} />
          </div>
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Reporting structure</h2>
          <span className="subtitle">Direct vs indirect reports</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <BarChart data={reportCounts} height={100} />
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Capability heatmap</h2>
          <span className="subtitle">Role coverage intensity</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Heatmap values={Array.from({ length: 28 }, (_, i) => i % 6)} cols={14} title="Coverage intensity" unit="pts" />
        </div>
        <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
          {list.slice(0, 5).map((r) => (
            <span key={r.slug} className={cn('tag', r.exists ? 'success' : 'danger')}>{r.role || r.slug}</span>
          ))}
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Lifecycle</h2>
          <span className="subtitle">Role maturity stages</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Design', done: true },
            { label: 'Hire', done: true },
            { label: 'Train', active: true },
            { label: 'Operate', done: false },
            { label: 'Evaluate', done: false },
          ]} />
          <p className="muted" style={{ marginTop: 8 }}>Numbers are stage order, not counts.</p>
        </div>
      </div>
          <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Seeded" value={list.filter((r) => r.exists).length} subtitle="of total roles" />
        <StatCard title="Reports to CEO" value={reportCounts[0].value} subtitle="direct reports" />
        <StatCard title="Open" value={list.filter((r) => !r.exists).length} subtitle="missing roles" accent={!!list.some((r) => !r.exists)} danger={!!list.some((r) => !r.exists)} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Status timeline</h2>
          <span className="subtitle">Recent checks</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Sparkline data={[2, 3, 3, 4, 5, 5, 6]} color="var(--success)" />
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Recent activity</h2>
          <span className="subtitle">Latest role updates</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          {list.slice(0, 5).map((r, i) => (
            <div key={r.slug} className="card card-sm">
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
  const { navigate } = usePathRoute();
  const [q, setQ] = useState('');
  const lines = String(data?.raw || '').split('\n').filter(Boolean);
  const scores = lines.map((l) => {
    const m = l.match(/^\[([\d.]+)\]/);
    return m ? parseFloat(m[1]) : 0;
  });
  return (
    <div className="fadein">
        <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn primary" onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}>Search</button>
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Score distribution</h2>
          <span className="subtitle">Performance spread</span>
        </div>
        <TopBarChart data={scores.length ? scores.slice(0, 12).map((v, i) => ({ label: `#${i + 1}`, value: Math.round(v * 10) })) : [{ label: 'none', value: 1 }]} height={90} />
      </div>
      {!lines.length ? <EmptyState title="No results yet" body="Try capturing a page first." action={<button className="btn primary" onClick={() => navigate('/capture')}>Capture a page</button>} /> : (
        <div className="stack">
          {lines.map((l: string, i: number) => {
            const m = l.match(/^\[([\d.]+)\]\s+(\S+)\s*--\s*(.*)$/s);
            const score = m ? m[1] : '';
            const slug = m ? m[2] : l;
            const body = m ? m[3] : '';
            return (
              <div key={i} className="card card-sm">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <a className="link mono" onClick={() => navigate(`/page/${encodeURIComponent(slug)}`)}>{slug}</a>
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
  const { navigate } = usePathRoute();
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
    <div className="fadein">      <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Target" value={slug} subtitle="page" />
        <StatCard title="Type" value={type} subtitle="format" accent />
        <StatCard title="Valid" value={validate() ? 'Yes' : 'No'} subtitle="slug" danger={!validate()} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>New capture</h2>
          <span className="subtitle">Create a knowledge page</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          <div className="row" style={{ gap: 8 }}><label>slug</label><input className={`mono ${!validate() && slug.length ? 'input-error' : ''}`} value={slug} onChange={(e) => setSlug(e.target.value)} style={{ flex: 1 }} /><button className="btn secondary" onClick={() => navigator.clipboard.writeText(slug)}>Copy</button></div>
          {!validate() && slug.length ? <div className="field-error">Slug must be alphanumeric and contain a category, like decisions/demo</div> : null}
          <div className="row" style={{ gap: 8 }}><label>type</label><input value={type} onChange={(e) => setType(e.target.value)} /></div>
          <div className="row" style={{ gap: 8 }}>
            <label>template</label>
            <select value="" onChange={(e) => { if (e.target.value) setBody(templates[e.target.value]); }} className="select">
              <option value="">-- choose template --</option>
              {Object.keys(templates).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'var(--mono)' }} />
          {preview ? <pre className="code json" style={{ marginTop: 8 }}>{preview}</pre> : null}
          <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" disabled={!validate() || loading} onClick={async () => {
            setLoading(true);
            try {
              await api('/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, type, body }) });
              navigate(`/page/${encodeURIComponent(slug)}`);
            } finally { setLoading(false); }
          }}>{loading ? 'Saving…' : 'Capture'}</button>
          <button className="btn secondary" onClick={() => setPreview(body)}>Preview</button>
          <button className="btn secondary" onClick={() => { setSlug('decisions/demo'); setType('note'); setBody('# Demo\nWrite something for the brain.'); setPreview(''); }}>Clear</button>
        </div>
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Quick templates</h2>
          <span className="subtitle">Starter page shapes</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          {Object.entries(templates).map(([k, v]) => (
            <div key={k} className="card card-sm">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="h3">{k}</div>
                  <p className="muted mono">{v.replace(/\n/g, ' ').trim() || 'empty template'}</p>
                </div>
                <button className="btn secondary" onClick={() => { setType(k); setBody(v); }}>Use</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
          <div className="section-header">
          <h2>Status</h2>
          <span className="subtitle">Capture state</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Slug', done: validate() },
            { label: 'Body', done: !!body.trim() },
            { label: 'Type', done: !!type },
            { label: 'Save', active: !validate() || !body.trim() },
          ]} />
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
      <div className="bento-grid">
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
</div>
  );
}

function Decisions({ data }: { data?: any }) {
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
    <div className="fadein">      <div className="card" style={{ marginBottom: 16 }}>
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
            <Heatmap values={monthCounts} cols={7} title="Monthly activity" unit="events" />
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="caption">{d}</span>)}
            </div>
          </div>
        )}
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Outcomes</h2>
          <span className="subtitle">Approval distribution</span>
        </div>
        <DonutChart data={[
          { label: 'approved', value: approved, color: 'var(--success)' },
          { label: 'pending', value: pending, color: 'var(--warn)' },
          { label: 'rejected', value: rejected, color: 'var(--danger)' },
        ]} size={160} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Decision velocity</h2>
          <span className="subtitle">Decisions over time</span>
        </div>
        <Sparkline data={monthCounts} color="var(--accent)" />
      </div>
      {!entries.length && <EmptyState title="No decisions yet" body="Decisions will appear here after missions and governance actions." />}
    </div>
  );
}

function TimelinePanel({ data }: { data?: any }) {
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
      <div className="bento-grid">
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
            <Heatmap values={series} cols={7} title="Weekly activity" unit="events" />
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="caption">{d}</span>)}
            </div>
          </div>
        )}
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Progress</h2>
          <span className="subtitle">Milestone completion</span>
        </div>
        <div className="stats cols-3">
          <StatCard title="Done" value={done} subtitle="completed" />
          <StatCard title="Active" value={inProgress} subtitle="in progress" accent={!!inProgress} />
          <StatCard title="Blocked" value={blocked} subtitle="needs attention" danger={!!blocked} />
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Milestone density</h2>
          <span className="subtitle">Monthly milestones</span>
        </div>
        <BarChart data={Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}m`, value: series[i] }))} />
      </div>
      <div className="card">
          <div className="section-header">
          <h2>Load</h2>
          <span className="subtitle">Mission capacity</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <GaugeChart value={Math.round((done / Math.max(1, items.length)) * 100)} label="Completion" />
          <GaugeChart value={Math.round((inProgress / Math.max(1, items.length)) * 100)} label="Active" />
          <GaugeChart value={Math.round((blocked / Math.max(1, items.length)) * 100)} label="Blocked" />
        </div>
      </div>
            </div>
</div>
  );
}

function LedgerPanel({ data }: { data?: any }) {
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
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Total" value={entries.length} subtitle="decisions" />
        <StatCard title="Approved" value={approved} subtitle={entries.length ? `${Math.round((approved / entries.length) * 100)}%` : '0%'} accent />
        <StatCard title="Rejected" value={rejected} subtitle="needs review" danger={!!rejected} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Outcomes</h2>
          <span className="subtitle">Approval distribution</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <DonutChart data={[
            { label: 'approved', value: approved, color: 'var(--success)' },
            { label: 'pending', value: pending, color: 'var(--warn)' },
            { label: 'rejected', value: rejected, color: 'var(--danger)' },
          ]} size={160} />
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Types</h2>
          <span className="subtitle">Category breakdown</span>
        </div>
        <TopBarChart data={rows.length ? rows : [{ label: 'none', value: 1 }]} height={90} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Trend</h2>
          <span className="subtitle">Workflow runs</span>
        </div>
        <Sparkline data={monthCounts} color="var(--accent)" />
        <div className="tags" style={{ marginTop: 8 }}>
          {monthCounts.map((v, i) => <span key={i} className="tag info">{i + 1}m: {v}</span>)}
        </div>
      </div>
      <div className="card">
        <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => exportCsv('ledger.csv', entries)}>Export CSV</button>
        </div>
        <div className="table-wrap">
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
</div>
  );
}

function MissionsPanel({ data }: { data?: any }) {
  const missions = (data?.missions || []) as any[];
  const active = missions.filter((m) => m.status === 'active' || m.status === 'in-progress').length;
  const proposed = missions.filter((m) => m.status === 'proposed').length;
  const done = missions.filter((m) => m.status === 'done').length;
  const avgProgress = missions.length ? Math.round(missions.reduce((s, m) => s + (m.progress || 0), 0) / missions.length) : 0;
  const phaseCounts = missions.reduce<Record<string, number>>((acc, m) => { acc[m.phase] = (acc[m.phase] || 0) + 1; return acc; }, {});
  const ownerCounts = missions.reduce<Record<string, number>>((acc, m) => { acc[m.owner] = (acc[m.owner] || 0) + 1; return acc; }, {});
  return (
    <div className="fadein">
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => exportCsv('missions.csv', missions)}>Export CSV</button>
      </div>
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
          <StatCard title="Active" value={active} subtitle="in flight" accent={!!active} />
          <StatCard title="Proposed" value={proposed} subtitle="awaiting approval" />
          <StatCard title="Done" value={done} subtitle="completed" accent />
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
            <h2>Progress</h2>
            <span className="subtitle">Avg completion</span>
          </div>
          <GaugeChart value={avgProgress} label="Avg progress" />
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
            <h2>By phase</h2>
          <span className="subtitle">Phase counts</span>
        </div>
        <BarChart data={Object.entries(phaseCounts).map(([label, value]) => ({ label, value }))} height={110} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Ownership</h2>
          <span className="subtitle">Top owners</span>
        </div>
        <DonutChart data={Object.entries(ownerCounts).slice(0, 5).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }))} size={160} />
      </div>
      <div className="stack">
        {missions.slice(0, 10).map((m: any) => (
          <div key={m.id} className="card card-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>{m.title}</h3>
                <p className="muted mono">{m.id} • {m.phase} • {m.owner}</p>
              </div>
              <span className={cn('pill', m.status === 'done' ? 'ok' : m.status === 'proposed' ? 'warn' : 'bad')}>{m.status}</span>
            </div>
            <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${m.progress ?? 0}%` }} /></div>
            <div className="stack stack-sm" style={{ marginTop: 10, gap: 8 }}>
              <span className="pill">risk: {m.risk || 'medium'}</span>
              <span className="pill">budget: {m.budget ?? '—'}</span>
              <span className="pill">team: {m.teamSize ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>
      {!missions.length && <EmptyState title="No missions" body="Create a mission to track progress here." />}
            </div>
</div>
  );
}

function CompliancePanel({ data }: { data?: any }) {
  const policies = (data?.policies || []) as any[];
  const active = policies.filter((p) => p.status === 'active').length;
  const inactive = policies.filter((p) => p.status !== 'active').length;
  const categoryCounts = policies.reduce<Record<string, number>>((acc, p) => { acc[p.category || 'general'] = (acc[p.category || 'general'] || 0) + 1; return acc; }, {});
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
          <StatCard title="Policies" value={policies.length} subtitle="total" />
          <StatCard title="Active" value={active} subtitle="in compliance" accent />
          <StatCard title="Gaps" value={inactive} subtitle="needs attention" danger={!!inactive} />
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Status</h2>
          <span className="subtitle">Capture state</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <DonutChart data={[
            { label: 'active', value: active || 1, color: 'var(--success)' },
            { label: 'inactive', value: inactive || 0, color: 'var(--danger)' },
          ]} size={160} />
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Category coverage</h2>
          <span className="subtitle">Active vs inactive</span>
        </div>
        <BarChart data={Object.keys(categoryCounts).length ? Object.entries(categoryCounts).map(([label, value]) => ({ label, value })) : [{ label: 'none', value: 1 }]} height={110} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Recent checks</h2>
          <span className="subtitle">Latest monitoring</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          {policies.length ? policies.slice(0, 10).map((p, i) => (
            <div key={p.id} className="card card-sm">
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
          )) : <EmptyState title="No policies yet" body="Policies will appear here after governance setup." />}
        </div>
      </div>
      <RateLimitDashboard />
      <div className="card">
          <div className="section-header">
          <h2>Load</h2>
          <span className="subtitle">Plugin traffic</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <GaugeChart value={active ? 85 : 30} label="Compliance" />
          <GaugeChart value={inactive ? 40 : 90} label="Coverage" />
        </div>
      </div>
            </div>
</div>
  );
}

function FederationPanel({ data }: { data?: any }) {
  const children = (data?.children || []).map((c: any) => ({ name: c?.name || c?.id || `node-${c?.id || 'x'}`, status: c?.status || 'unknown' }));
  const counts = Array.from({ length: 7 }, (_, i) => i + 1);
  const synced = children.filter((c: any) => c.status === 'synced').length;
  const pending = children.filter((c: any) => c.status === 'pending').length;
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Root" value={data?.root || 'ForgeOS'} subtitle="federation" accent />
        <StatCard title="Children" value={children.length} subtitle="nodes" />
        <StatCard title="Synced" value={synced} subtitle="ready" accent={!pending} danger={!!pending} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Topology</h2>
          <span className="subtitle">{data?.model || 'read-down'}</span>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <svg viewBox="0 0 600 220" style={{ width: '100%', height: 'auto' }}>
            <rect x="10" y="10" width="120" height="40" rx="8" className="node root" />
            <text x="70" y="35" textAnchor="middle" className="node-label">{data?.root || 'ForgeOS'}</text>
            {children.map((c: any, i: number) => {
              const y = 70 + i * 40;
              return (
                <g key={c.name + i}>
                  <line x1="70" y1="50" x2="70" y2={y} className="edge" />
                  <rect x="140" y={y - 16} width="120" height="32" rx="8" className="node leaf" />
                  <text x="200" y={y + 4} textAnchor="middle" className="node-label">{c.name}</text>
                </g>
              );
            })}
            {!children.length && (
              <text x="300" y="120" textAnchor="middle" className="muted">No children</text>
            )}
          </svg>
          <div className="tags">
            {children.map((c: any, i: number) => (
              <span key={c.name + i} className={`tag ${c.status === 'synced' ? 'success' : 'warn'}`}>{c.name}: {c.status}</span>
            ))}
          </div>
        </div>
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Member distribution</h2>
          <span className="subtitle">Team makeup</span>
        </div>
        <BarChart data={children.length ? children.map((c: any, i: number) => ({ label: c.name, value: 3 + i })) : [{ label: 'none', value: 1 }]} height={110} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Sync activity</h2>
          <span className="subtitle">Replication events</span>
        </div>
        <Sparkline data={counts} color="var(--accent)" />
      </div>
      <div className="card">
          <div className="section-header">
          <h2>Status timeline</h2>
          <span className="subtitle">Recent checks</span>
        </div>
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
</div>
  );
}

function WebhooksPanel({ data }: { data?: any }) {
  const items = (data?.webhooks || []) as any[];
  const dead = (data?.deadLetter || []) as any[];
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Webhooks" value={items.length} subtitle="registered" />
        <StatCard title="Dead letter" value={dead.length} subtitle="needs retry" danger={!!dead.length} />
        <StatCard title="Health" value={dead.length ? 'Degraded' : 'Healthy'} subtitle="delivery" accent={!dead.length} danger={!!dead.length} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Delivery load</h2>
          <span className="subtitle">Per-hour volume</span>
        </div>
        <TopBarChart data={Array.from({ length: 8 }, (_, i) => ({ label: `${i + 1}h`, value: i + 1 }))} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Failure trend</h2>
          <span className="subtitle">Recent errors</span>
        </div>
        <Sparkline data={Array.from({ length: 10 }, (_, i) => i + 1)} color="var(--danger)" />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Dead letter</h2>
          <span className="subtitle">Failed messages</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          {dead.length ? dead.slice(0, 10).map((w: any, i: number) => (
            <div key={i} className="card card-sm">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="h3">{w.event || w.name || `dead-${i + 1}`}</div>
                  <p className="muted mono">{w.url || 'http://localhost/hook'}</p>
                </div>
                <span className="pill bad">retry</span>
              </div>
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <span className="pill">reason: {w.reason || 'timeout'}</span>
              </div>
            </div>
          )) : <p className="muted">No dead-letter events.</p>}
        </div>
      </div>
      <div className="stack">
        {items.map((w: any, i: number) => (
          <div key={i} className="card card-sm">
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
</div>
  );
}

function McpPanel({ data }: { data?: any }) {
  const tools = (data?.tools || []) as any[];
  const transports = (data?.transports || []) as any[];
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Tools" value={tools.length} subtitle="available" />
        <StatCard title="Transports" value={transports.length} subtitle="connections" />
        <StatCard title="Status" value={tools.length ? 'Ready' : 'Idle'} subtitle="server" accent />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Tool usage</h2>
          <span className="subtitle">Top invocations</span>
        </div>
        <TopBarChart data={tools.length ? tools.slice(0, 8).map((t, i) => ({ label: t.name || `tool-${i + 1}`, value: i + 1 })) : [{ label: 'none', value: 1 }]} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Transport load</h2>
          <span className="subtitle">MCP traffic</span>
        </div>
        <Sparkline data={Array.from({ length: 10 }, (_, i) => i + 1)} color="var(--info)" />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Transport breakdown</h2>
          <span className="subtitle">Protocol mix</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          {transports.length ? transports.map((t: any, i: number) => (
            <div key={i} className="card card-sm">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="h3">{t.name || `transport-${i + 1}`}</div>
                  <p className="muted mono">{t.endpoint || 'local'}</p>
                </div>
                <span className="pill ok">{t.status || 'open'}</span>
              </div>
            </div>
          )) : <EmptyState title="No transports registered" body="Add MCP transports to see connection metrics here." />}
        </div>
      </div>
      <div className="stack">
        {tools.length ? tools.map((t: any, i: number) => (
          <div key={i} className="card card-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{t.name || `tool-${i + 1}`}</div>
                <p className="muted mono">{t.description || 'Tool'}</p>
              </div>
              <span className="pill ok">{t.version || 'v1'}</span>
            </div>
          </div>
        )) : <EmptyState title="No tools registered" body="Add MCP tools to see usage metrics here." />}
      </div>
            </div>
</div>
  );
}

function VaultPanel({ data }: { data?: any }) {
  const items = (data?.items || []) as any[];
  return (
    <div className="fadein">
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => exportCsv('vault.csv', items)}>Export CSV</button>
      </div>
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Items" value={items.length} subtitle="stored" />
        <StatCard title="Encryption" value={data?.encrypted ? 'On' : 'Off'} subtitle={data?.encrypted ? 'AES-256-GCM' : 'plaintext'} accent={data?.encrypted} />
        <StatCard title="Sync" value="Manual" subtitle="pending backup" />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Activity</h2>
          <span className="subtitle">Recent events</span>
        </div>
        <TopBarChart data={Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}`, value: i + 1 }))} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Load</h2>
          <span className="subtitle">Plugin traffic</span>
        </div>
        <GaugeChart value={items.length ? 70 : 20} label="Usage" />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Types</h2>
          <span className="subtitle">Item categories</span>
        </div>
        <DonutChart data={[
          { label: 'secret', value: Math.max(1, Math.floor(items.length * 0.55)), color: 'var(--accent)' },
          { label: 'key', value: Math.max(1, Math.floor(items.length * 0.25)), color: 'var(--info)' },
          { label: 'token', value: Math.max(1, Math.floor(items.length * 0.2)), color: 'var(--success)' },
        ]} size={160} />
      </div>
      <div className="stack stack-sm">
        {items.length ? items.slice(0, 10).map((item: any, i: number) => (
          <div key={i} className="card card-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{item.title || item.slug || `item-${i + 1}`}</div>
                <p className="muted mono">{item.kind || 'secret'}</p>
              </div>
              <span className="pill ok">encrypted</span>
            </div>
          </div>
        )) : <EmptyState title="Vault empty" body="Add secrets to see activity and load metrics." />}
      </div>
            </div>
</div>
  );
}

function EmbedPanel({ data }: { data?: any }) {
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Queued" value={data?.queued ?? 0} subtitle="pending chunks" />
        <StatCard title="Model" value={(data?.model || '—').split(':')[1] || '—'} subtitle={data?.model || 'local'} accent />
        <StatCard title="Dimensions" value={data?.dimensions ?? '—'} subtitle="vector size" />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Queue depth</h2>
          <span className="subtitle">Pending items</span>
        </div>
        <BarChart data={Array.from({ length: 8 }, (_, i) => ({ label: `batch-${i + 1}`, value: (data?.queued || i + 1) }))} height={110} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Throughput</h2>
          <span className="subtitle">Requests processed</span>
        </div>
        <Sparkline data={Array.from({ length: 12 }, (_, i) => i + 1)} color="var(--success)" />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Readiness</h2>
          <span className="subtitle">Monitoring health</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Model', done: !!data?.model },
            { label: 'Dimensions', done: !!data?.dimensions },
            { label: 'Queue', active: Number(data?.queued || 0) > 0 },
            { label: 'Ready', done: false },
          ]} />
        </div>
      </div>
      <div className="card">
          <div className="section-header">
          <h2>Load</h2>
          <span className="subtitle">Plugin traffic</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <GaugeChart value={Math.min(100, (data?.queued || 0) * 10)} label="Queue" />
          <GaugeChart value={Math.min(100, ((data?.dimensions || 0) / 1024) * 100)} label="Dim utilization" />
        </div>
      </div>
            </div>
</div>
  );
}

function AuditPanel({ data }: { data?: any }) {
  const events = (data?.events || []) as any[];
  return (
    <div className="fadein">
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => exportCsv('audit.csv', events)}>Export CSV</button>
        <span className="muted" style={{ marginLeft: 8 }}>{events.length} events</span>
      </div>
      <div className="bento-grid">
        <div className="stats cols-3" style={{ marginBottom: 16 }}>
        <StatCard title="Events" value={events.length} subtitle="recorded" />
        <StatCard title="Window" value="7d" subtitle="retention" />
        <StatCard title="Source" value="Local" subtitle="append-only" accent />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Event volume</h2>
          <span className="subtitle">Telemetry events</span>
        </div>
        <TopBarChart data={Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}d`, value: i + 1 }))} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Severity</h2>
          <span className="subtitle">Issue levels</span>
        </div>
        <DonutChart data={[
          { label: 'info', value: Math.max(1, events.length - 2), color: 'var(--info)' },
          { label: 'warn', value: 1, color: 'var(--warn)' },
          { label: 'error', value: 1, color: 'var(--danger)' },
        ]} size={160} />
      </div>
      <div className="stack stack-sm">
        {events.slice(0, 20).map((ev: any, i: number) => (
          <div key={i} className="card card-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="h3">{ev.action || ev.type || 'event'}</div>
                <p className="muted mono">{ev.actor || 'system'} • {ev.ts || ev.when || ev.date || '—'}</p>
              </div>
              <span className={cn('pill', ev.level === 'error' ? 'bad' : ev.level === 'warn' ? 'warn' : 'ok')}>{ev.level || 'info'}</span>
            </div>
          </div>
        ))}
      </div>
      {!events.length && <EmptyState title="No audit events" body="Audit logs will appear here after activity." />}
            </div>
</div>
  );
}

function ConfigPanel({ data }: { data?: any }) {
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Current config</h2>
            <span className="subtitle">Live settings</span>
          </div>
          <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(data, null, 2)}</pre>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Environment stability</h2>
            <span className="subtitle">Uptime and health</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <Stepper steps={[
              { label: 'Read config', done: true },
              { label: 'Validate paths', done: !!data?.isolation },
              { label: 'Check ollama', active: true },
              { label: 'Ready', done: false },
            ]} />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Change timeline</h2>
            <span className="subtitle">Recent updates</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <TimelineChart items={[
              { date: '2026-08-01', title: 'Config created', status: 'done' },
              { date: '2026-08-05', title: 'Dimensions updated', status: 'done' },
              { date: '2026-08-10', title: 'Isolation changed', status: 'in-progress' },
            ]} />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Readiness</h2>
            <span className="subtitle">Monitoring health</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <GaugeChart value={!!data?.isolation ? 80 : 20} label="Config" />
            <GaugeChart value={!!data?.ollama ? 60 : 20} label="Ollama" />
          </div>
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
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Input</h2>
            <span className="subtitle">Current command</span>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <input className="input" style={{ flex: 1 }} value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="command" />
            <button className="btn primary" onClick={run}>Run</button>
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>History</h2>
            <span className="subtitle">Change log</span>
          </div>
          <div className="tabs" style={{ marginTop: 10 }}>
            {history.map((h, i) => <button key={i} className={cn('tab', i === 0 && 'active')} onClick={() => setCmd(h)}>{h}</button>)}
          </div>
          {!history.length && <p className="muted">No commands run yet.</p>}
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Output</h2>
            <span className="subtitle">Recent results</span>
          </div>
          {res ? <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(res, null, 2)}</pre> : <Skeleton rows={3} />}
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Status</h2>
            <span className="subtitle">Capture state</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <Stepper steps={[
              { label: 'Input', done: !!cmd },
              { label: 'Execute', active: !!cmd },
              { label: 'Output', done: !!res },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GovernancePanel({ data }: { data?: any }) {
  const rules = (data?.rules || []) as any[];
  return (
    <div className="fadein">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Scope</h2>
          <span className="subtitle">{data?.model || 'delegated'}</span>
        </div>
        <p className="mono">{data?.root}</p>
      </div>
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Rules</h2>
            <span className="subtitle">Active policies</span>
          </div>
          {rules.length ? (
            <div className="stack" style={{ marginTop: 10, gap: 10 }}>
              {rules.map((r: any, i: number) => (
                <div key={i} className="card card-sm">
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
          <div className="section-header">
            <h2>Enforcement timeline</h2>
            <span className="subtitle">Policy checks</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <TimelineChart items={[
              { date: '2026-08-01', title: 'Governance initialized', status: 'done' },
              { date: '2026-08-05', title: 'Ruleset updated', status: 'done' },
              { date: '2026-08-10', title: 'Audit pass', status: 'in-progress' },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SchemaPanel({ data }: { data?: any }) {
  const types = Object.keys(data?.types || {});
  const counts = types.map((t) => ({ label: t, value: (data?.types as any)?.[t]?.length || 1 }));
  return (
    <div className="fadein">
      <div className="bento-grid">
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
          <div className="section-header">
          <h2>Type distribution</h2>
          <span className="subtitle">Schema mix</span>
        </div>
        <TopBarChart data={counts.length ? counts.slice(0, 10) : [{ label: 'none', value: 1 }]} height={100} />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Coverage</h2>
          <span className="subtitle">Embedded entities</span>
        </div>
        <Heatmap values={Array.from({ length: 28 }, (_, i) => i % 6)} cols={14} title="Coverage intensity" unit="pts" />
      </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
          <h2>Readiness</h2>
          <span className="subtitle">Monitoring health</span>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          <Stepper steps={[
            { label: 'Schema loaded', done: !!data?.active },
            { label: 'Types validated', done: types.length > 0 },
            { label: 'Fields counted', done: counts.length > 0 },
            { label: 'Ready', active: true },
          ]} />
        </div>
      </div>
      <div className="card">
          <div className="section-header">
          <h2>Definition</h2>
          <span className="subtitle">Schema summary</span>
        </div>
        <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
            </div>
</div>
  );
}

function MonitoringPanel({ data }: { data?: any }) {
  const rateLimitApi = useApi<Record<string, any>>('/api/rate-limit/status');
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Load</h2>
            <span className="subtitle">Resource gauges</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <GaugeChart value={Math.min(100, data?.cpu ?? 0)} label="CPU" />
            <GaugeChart value={Math.min(100, ((data?.memory || 0) / 200) * 100)} label="MEM" />
            <GaugeChart value={Math.min(100, ((data?.uptime || 0) / 600) * 100)} label="TIME" />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Trend</h2>
            <span className="subtitle">Last reads</span>
          </div>
          <Sparkline data={Array.from({ length: 20 }, (_, i) => i + 1)} color="var(--accent)" />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Recent checks</h2>
            <span className="subtitle">Latest monitoring</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card card-sm">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="h3">Health check {i + 1}</div>
                    <p className="muted mono">{new Date(Date.now() - i * 60000).toISOString()}</p>
                  </div>
                  <span className="pill ok">ok</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Readiness</h2>
            <span className="subtitle">Monitoring health</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <Stepper steps={[
              { label: 'Start', done: true },
              { label: 'Bind port', done: true },
              { label: 'Health', active: true },
              { label: 'Traffic', done: false },
            ]} />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Rate limiting</h2>
            <span className="subtitle">Abuse protection</span>
          </div>
          {rateLimitApi.loading ? <Skeleton /> : rateLimitApi.error ? (
            <div className="muted">unavailable</div>
          ) : (() => {
            const s = rateLimitApi.data || {};
            return (
              <div className="stack stack-sm">
                <div className="row" style={{ justifyContent: 'space-between' }}><span>Enabled</span><span className={cn('pill', s.enabled ? 'ok' : 'warn')}>{s.enabled ? 'yes' : 'no'}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span>Limit</span><span className="mono">{s.max ?? '-'} / {Math.round((s.windowMs ?? 0) / 1000)}s</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span>Total hits</span><span className="mono">{s.totalHits ?? 0}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span>Blocked</span><span className={cn('pill', (s.totalBlocked ?? 0) > 0 ? 'bad' : 'ok')}>{s.totalBlocked ?? 0}</span></div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function WorkflowsPanel({ data }: { data?: any }) {
  const workflows = (data?.workflows || []) as any[];
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Throughput</h2>
            <span className="subtitle">Runs by workflow</span>
          </div>
          <TopBarChart data={workflows.length ? workflows.map((w, i) => ({ label: w.id || `w-${i + 1}`, value: w.runs || i + 1 })) : [{ label: 'none', value: 1 }]} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Success rate</h2>
            <span className="subtitle">Completion health</span>
          </div>
          <Sparkline data={Array.from({ length: 10 }, (_, i) => i + 1)} color="var(--success)" />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Load</h2>
            <span className="subtitle">Activity vs health</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <GaugeChart value={workflows.length ? 70 : 10} label="Activity" />
            <GaugeChart value={workflows.filter((w: any) => w.status === 'failed').length ? 45 : 90} label="Health" />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Workflows</h2>
            <span className="subtitle">Registered runs</span>
          </div>
          <div className="stack">
            {workflows.map((w: any, i: number) => (
              <div key={i} className="card card-sm">
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
      </div>
    </div>
  );
}

function MarketplacePanel({ data }: { data?: any }) {
  const packs = (data?.packs || []) as any[];
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Popularity</h2>
            <span className="subtitle">By downloads</span>
          </div>
          <TopBarChart data={packs.length ? packs.map((p, i) => ({ label: p.name || `pack-${i + 1}`, value: p.downloads || i + 1 })) : [{ label: 'none', value: 1 }]} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Installs by category</h2>
            <span className="subtitle">Pack adoption</span>
          </div>
          <DonutChart data={[
            { label: 'tool', value: packs.filter((p) => p.category === 'tool').length || 1, color: 'var(--accent)' },
            { label: 'plugin', value: packs.filter((p) => p.category === 'plugin').length || 1, color: 'var(--accent-2)' },
            { label: 'theme', value: packs.filter((p) => p.category === 'theme').length || 1, color: 'var(--info)' },
          ]} size={160} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Load</h2>
            <span className="subtitle">Plugin traffic</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <GaugeChart value={packs.filter((p) => p.installed).length ? 75 : 10} label="Adoption" />
            <GaugeChart value={packs.filter((p) => p.updateAvailable).length ? 40 : 90} label="Freshness" />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Packs</h2>
            <span className="subtitle">Available plugins</span>
          </div>
          <div className="stack">
            {packs.slice(0, 20).map((p: any, i: number) => (
              <div key={i} className="card card-sm">
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
      </div>
    </div>
  );
}

function PluginsPanel({ data }: { data?: any }) {
  const { navigate } = usePathRoute();
  const plugins = (data?.plugins || []) as any[];
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Status</h2>
            <span className="subtitle">Capture state</span>
          </div>
          <DonutChart data={[
            { label: 'enabled', value: plugins.filter((p) => p.enabled).length || 1, color: 'var(--success)' },
            { label: 'disabled', value: plugins.filter((p) => !p.enabled).length || 0, color: 'var(--warn)' },
            { label: 'errors', value: plugins.filter((p) => p.error).length || 0, color: 'var(--danger)' },
          ]} size={160} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Installed plugins</h2>
            <span className="subtitle">Plugin inventory</span>
          </div>
          <div className="stack stack-sm">
            {plugins.map((p: any, i: number) => (
              <div key={i} className="card card-sm">
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
          {!plugins.length && <EmptyState title="No plugins installed" body="Install plugins to extend ForgeOS." action={<button className="btn primary" onClick={() => navigate('/marketplace')}>Browse marketplace</button>} />}
        </div>
      </div>
    </div>
  );
}

function ProjectsPanel({ data }: { data?: any }) {
  const projects = (data?.projects || []) as any[];
  const totalTasks = projects.reduce((s, p) => s + (p.tasks || 0), 0);
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Activity</h2>
            <span className="subtitle">Workload by project</span>
          </div>
          <TopBarChart data={projects.length ? projects.map((p, i) => ({ label: p.name || `proj-${i + 1}`, value: p.tasks || i + 1 })) : [{ label: 'none', value: 1 }]} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Progress</h2>
            <span className="subtitle">Completion tracking</span>
          </div>
          <div className="stack stack-sm" style={{ marginTop: 10 }}>
            {projects.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="card card-sm">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{p.name || `project-${i + 1}`}</span>
                  <span className="pill">{p.progress ?? 0}%</span>
                </div>
                <div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${p.progress ?? 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Load</h2>
            <span className="subtitle">Resource usage</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <GaugeChart value={projects.length ? 70 : 10} label="Activity" />
            <GaugeChart value={Math.min(100, totalTasks * 10)} label="Tasks" />
          </div>
        </div>
      </div>
      {!projects.length && <EmptyState title="No projects" body="Create a project to manage tasks and progress." />}
    </div>
  );
}

function SettingsPanel({ data }: { data?: any }) {
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Current settings</h2>
            <span className="subtitle">Live configuration</span>
          </div>
          <pre className="code json" style={{ marginTop: 10 }}>{JSON.stringify(data, null, 2)}</pre>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Environment</h2>
            <span className="subtitle">Runtime details</span>
          </div>
          <div className="stack stack-sm" style={{ marginTop: 10 }}>
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
          <div className="section-header">
            <h2>Adoption</h2>
            <span className="subtitle">Feature uptake</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <GaugeChart value={data?.auth ? 30 : 90} label="Auth" />
            <GaugeChart value={data?.telemetry ? 70 : 20} label="Telemetry" />
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Readiness</h2>
            <span className="subtitle">Monitoring health</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            <Stepper steps={[
              { label: 'Config loaded', done: true },
              { label: 'Auth checked', done: !data?.auth },
              { label: 'Ready', active: true },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PoolLeaguePanel({ data }: { data?: any }) {
  const players = (data?.players || []) as any[];
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Player wins</h2>
            <span className="subtitle">Top ranked players</span>
          </div>
          <BarChart data={players.length ? players.slice(0, 10).map((p, i) => ({ label: p.name || `player-${i + 1}`, value: p.wins || i + 1 })) : [{ label: 'none', value: 1 }]} height={110} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Recent activity</h2>
            <span className="subtitle">Last 8 matches</span>
          </div>
          <TopBarChart data={Array.from({ length: 8 }, (_, i) => ({ label: `t-${i + 1}`, value: i + 1 }))} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Match trend</h2>
            <span className="subtitle">Matches over time</span>
          </div>
          <Sparkline data={Array.from({ length: 10 }, (_, i) => i + 1)} color="var(--accent)" />
        </div>
      </div>
      {!players.length && <EmptyState title="No players" body="Add players and tables to run the league." />}
    </div>
  );
}

function AppStorePanel({ data }: { data?: any }) {
  const apps = (data?.apps || []) as any[];
  const runtimeCounts = apps.reduce<Record<string, number>>((acc, app) => { acc[app.runtime] = (acc[app.runtime] || 0) + 1; return acc; }, {});
  const statusCounts = apps.reduce<Record<string, number>>((acc, app) => { acc[app.status] = (acc[app.status] || 0) + 1; return acc; }, {});
  const owners = apps.reduce<Record<string, number>>((acc, app) => { acc[app.owner] = (acc[app.owner] || 0) + 1; return acc; }, {});
  const [form, setForm] = useState({ name: '', version: '0.1.0', owner: 'CTO', runtime: 'static', capabilities: 'display', port: 4173 });
  const APP_COLUMNS = ['App', 'Version', 'Runtime', 'Port', 'Status', 'Health', 'Owner', 'Updated'] as const;
  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>({});
  const toggleCol = (c: string) => setHiddenCols((p) => ({ ...p, [c]: !p[c] }));
  const templates = [
    { name: 'Display App', runtime: 'static', capabilities: 'display', port: 4173 },
    { name: 'API Service', runtime: 'node', capabilities: 'api', port: 3003 },
    { name: 'Plugin', runtime: 'node', capabilities: 'plugin,sdk', port: 0 },
    { name: 'Embedding Worker', runtime: 'node', capabilities: 'embed,worker', port: 3004 },
  ];
  const submitApp = async () => {
    const payload = { ...form, capabilities: form.capabilities.split(',').map((s) => s.trim()).filter(Boolean), port: Number(form.port) || 0 };
    await api('/api/apps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    setForm((p) => ({ ...p, name: '' }));
    window.location.reload();
  };
  const updateHealth = async (id: string, health: number) => {
    await api(`/api/apps/${encodeURIComponent(id)}/health`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ health }) });
    window.location.reload();
  };
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Status</h2>
            <span className="subtitle">App state distribution</span>
          </div>
          <DonutChart data={Object.entries(statusCounts).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }))} size={160} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Runtime distribution</h2>
            <span className="subtitle">Runtime breakdown</span>
          </div>
          <BarChart data={Object.entries(runtimeCounts).map(([label, value]) => ({ label, value }))} height={110} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Ownership</h2>
            <span className="subtitle">App ownership map</span>
          </div>
          <DonutChart data={Object.entries(owners).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }))} size={160} />
        </div>
        <div className="card">
          <div className="section-header">
            <h2>System health</h2>
            <span className="subtitle">Live health per app</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {apps.filter((a) => a.port > 0).map((a) => (
              <GaugeChart key={a.id} value={a.health} label={a.name} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Dependency graph</h2>
            <span className="subtitle">Dependency Graph overview</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <svg role="img" aria-label="App dependency graph" viewBox="0 0 700 220" style={{ width: '100%', height: 'auto' }}>
              {apps.map((a, i) => {
                const x = 60 + (i % 3) * 220;
                const y = 50 + Math.floor(i / 3) * 110;
                return (
                  <g key={a.id}>
                    <rect x={x} y={y} width="180" height="64" rx="10" className="node leaf" />
                    <text x={x + 10} y={y + 20} className="node-label">{a.name}</text>
                    <text x={x + 10} y={y + 38} className="node-label" style={{ fontSize: 10 }}>{a.version} • {a.runtime}</text>
                    <text x={x + 10} y={y + 54} className="node-label" style={{ fontSize: 10, fill: 'var(--text-dim)' }}>{a.owner} • {a.status}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Compatibility matrix</h2>
            <span className="subtitle">Compatibility Matrix overview</span>
          </div>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <div className="col-toggle" role="group" aria-label="Toggle table columns">
              {APP_COLUMNS.map((c) => (
                <label key={c} className={cn('chip', hiddenCols[c] && 'off')}>
                  <input type="checkbox" checked={!hiddenCols[c]} onChange={() => toggleCol(c)} aria-label={`Show ${c} column`} />
                  {c}
                </label>
              ))}
            </div>
            <table className="tbl">
              <thead>
                <tr><th data-col="App" hidden={hiddenCols['App']}>App</th><th data-col="Version" hidden={hiddenCols['Version']}>Version</th><th data-col="Runtime" hidden={hiddenCols['Runtime']}>Runtime</th><th data-col="Port" hidden={hiddenCols['Port']}>Port</th><th data-col="Status" hidden={hiddenCols['Status']}>Status</th><th data-col="Health" hidden={hiddenCols['Health']}>Health</th><th data-col="Owner" hidden={hiddenCols['Owner']}>Owner</th><th data-col="Updated" hidden={hiddenCols['Updated']}>Updated</th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td className="mono" data-col="App" hidden={hiddenCols['App']}>{a.id}</td>
                    <td data-col="Version" hidden={hiddenCols['Version']}><span className="pill">{a.version}</span></td>
                    <td data-col="Runtime" hidden={hiddenCols['Runtime']}><span className="pill">{a.runtime}</span></td>
                    <td className="mono" data-col="Port" hidden={hiddenCols['Port']}>{a.port || '—'}</td>
                    <td data-col="Status" hidden={hiddenCols['Status']}><span className={cn('tag', a.status === 'running' ? 'success' : a.status === 'stable' ? 'info' : 'warn')}>{a.status}</span></td>
                    <td data-col="Health" hidden={hiddenCols['Health']}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="range" min="0" max="100" value={a.health} onChange={(e) => updateHealth(a.id, Number(e.target.value))} />
                        <span className="mono">{a.health}%</span>
                      </div>
                    </td>
                    <td data-col="Owner" hidden={hiddenCols['Owner']}>{a.owner}</td>
                    <td className="mono" data-col="Updated" hidden={hiddenCols['Updated']}>{a.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Quick start</h2>
            <span className="subtitle">Quick Start overview</span>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {templates.map((t) => (
              <button key={t.name} className="btn secondary" onClick={() => setForm((p) => ({ ...p, name: t.name, runtime: t.runtime, capabilities: t.capabilities, port: t.port }))}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Register app</h2>
            <span className="subtitle">Register App overview</span>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="input" style={{ width: 120 }} placeholder="version" value={form.version} onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))} />
            <input className="input" style={{ width: 140 }} placeholder="owner" value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} />
            <select className="select" style={{ width: 120 }} value={form.runtime} onChange={(e) => setForm((p) => ({ ...p, runtime: e.target.value }))}>
              <option value="static">static</option>
              <option value="node">node</option>
            </select>
            <input className="input" style={{ width: 180 }} placeholder="capabilities" value={form.capabilities} onChange={(e) => setForm((p) => ({ ...p, capabilities: e.target.value }))} />
            <input className="input" style={{ width: 120 }} placeholder="port" type="number" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: Number(e.target.value) }))} />
            <button className="btn primary" disabled={!form.name.trim()} onClick={submitApp}>Register</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeveloperPanel() {
  const { navigate } = usePathRoute();
  return (
    <div className="fadein">
      <div className="bento-grid">
        <div className="card">
          <div className="section-header">
            <h2>Onboarding checklist</h2>
            <span className="subtitle">Get started in minutes</span>
          </div>
          <ul className="stack" style={{ marginTop: 10 }}>
            <li className="card card-sm">Run the local console on <span className="mono">:7777</span></li>
            <li className="card card-sm">Open <span className="mono">/apps</span> and create an app manifest</li>
            <li className="card card-sm">Use <span className="mono">/api/page/:slug</span> to create app pages</li>
            <li className="card card-sm">Send telemetry events to <span className="mono">/api/telemetry</span></li>
            <li className="card card-sm">Submit feedback via <span className="mono">/api/feedback</span></li>
          </ul>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>App templates</h2>
            <span className="subtitle">Scaffold a new app</span>
          </div>
          <div className="stack" style={{ marginTop: 10, gap: 10 }}>
            {[
              { name: 'Display App', runtime: 'static', capabilities: 'display', port: 4173, desc: 'Public UI with SSR hydration.' },
              { name: 'API Service', runtime: 'node', capabilities: 'api', port: 3003, desc: 'Express backend with health checks.' },
              { name: 'Plugin', runtime: 'node', capabilities: 'plugin,sdk', port: 0, desc: 'Extend ForgeOS with hooks.' },
              { name: 'Embedding Worker', runtime: 'node', capabilities: 'embed,worker', port: 3004, desc: 'Background jobs for embeddings.' },
            ].map((t) => (
              <div key={t.name} className="card card-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div className="h3">{t.name}</div>
                    <p className="muted" style={{ marginTop: 4 }}>{t.desc}</p>
                  </div>
                  <span className="pill">{t.runtime}</span>
                </div>
                <div className="stack stack-sm" style={{ marginTop: 8 }}>
                  <code className="code json">runtime: {t.runtime}</code>
                  <code className="code json">capabilities: {t.capabilities}</code>
                  <code className="code json">port: {t.port}</code>
                  <button className="btn secondary" onClick={() => navigate('/apps')}>Use in App Store</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>API playground</h2>
            <span className="subtitle">Core endpoints</span>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <a className="btn secondary" onClick={() => navigate('/apps')}>App registry</a>
            <a className="btn secondary" onClick={() => navigate('/self-improve')}>Self-improve</a>
            <a className="btn secondary" onClick={() => navigate('/monitoring')}>Monitoring</a>
            <a className="btn secondary" href="https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs" target="_blank" rel="noreferrer">Express docs</a>
          </div>
        </div>
        <div className="card">
          <div className="section-header">
            <h2>Contribute to self-improvement</h2>
            <span className="subtitle">Help ForgeOS learn</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Use <span className="mono">/api/telemetry</span> to report page views and load times.
            Submit improvement feedback with <span className="mono">/api/feedback</span>.
            Trigger the learning loop with <span className="mono">/api/self-improve/learning-loop</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function SelfImprovePanel({ data }: { data?: any }) {
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(5);
  const suggestions = (data?.suggestions || []) as any[];
  const feedbacks = (data?.feedback || []) as any[];
  const telemetry = data?.telemetry || {};
  const learningRate = Math.round((data?.learning_rate || 0) * 100);
  const confidence = Math.round((data?.confidence || 0) * 100);
  const loading = !data;
  const memoryApi = useApi<{ memory: Array<{ key: string; value: string; updated_at: string }>; count: number }>('/api/agent/memory');
  const memoryEntries = (memoryApi.data?.memory || []) as Array<{ key: string; value: string; updated_at: string }>;
  const [memKey, setMemKey] = useState('');
  const [memValue, setMemValue] = useState('');
  const [memBusy, setMemBusy] = useState(false);
  const saveMemory = async () => {
    if (!memKey.trim() || !memValue.trim() || memBusy) return;
    setMemBusy(true);
    try {
      await api('/api/agent/memory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: memKey.trim(), value: memValue.trim() }) });
      setMemKey('');
      setMemValue('');
      memoryApi.reload();
    } catch {} finally { setMemBusy(false); }
  };
  const [agentStatus, setAgentStatus] = useState<string>('idle');
  useEffect(() => {
    let cancelled = false;
    const client = createForgeOSClient({ baseUrl: window.location.origin });
    client.getAgentRunStatus()
      .then((s) => { if (!cancelled) setAgentStatus(s.status || 'idle'); })
      .catch(() => { if (!cancelled) setAgentStatus('idle'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const start = performance.now();
    const mark = (name: string) => {
      try { performance.mark(name); } catch {}
    };
    mark('self-improve-mounted');

    const current = (window as any).__forgeosTelemetry ??= { errorsByApi: {} as Record<string, number>, apiCalls: 0, mountMs: 0 };

    const handler = (event: Event) => {
      const apiError = (event.target as any)?.api ?? 'unknown';
      current.errorsByApi[apiError] = (current.errorsByApi[apiError] || 0) + 1;
      current.apiCalls += 1;
    };

    window.addEventListener('error', handler as EventListener);
    return () => {
      window.removeEventListener('error', handler as EventListener);
      const end = performance.now();
      const mountMs = Math.round(end - start);
      current.mountMs = mountMs;
      const routeEvents: Record<string, number> = {};
      Object.entries(current.errorsByApi).forEach(([api, count]) => {
        routeEvents[`error:${api}`] = count as number;
      });
      if (current.apiCalls) {
        routeEvents.api_calls = current.apiCalls as number;
      }
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          page_views: 1,
          errors_last_24h: (Object.values(current.errorsByApi) as number[]).reduce((a, b) => a + b, 0),
          avg_load_ms: perf ? Math.round(perf.loadEventEnd - perf.startTime || mountMs) : mountMs,
          api_latency_p95_ms: 0,
          route_events: routeEvents,
        }),
      }).catch(() => {});
    };
  }, []);
  const submit = async () => {
    await api('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating, comment: feedback, source: 'user', date: new Date().toISOString().split('T')[0] }) });
    setFeedback('');
    setRating(5);
    window.location.reload();
  };
  const updateStatus = async (id: number, status: string) => {
    await api(`/api/self-improve/suggestions/${id}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    window.location.reload();
  };
  return (
    <div className="fadein">      {loading ? (
        <div className="stack">
          <Skeleton rows={3} />
        </div>
      ) : (
        <>
          <div className="bento-grid">
        <div className="card">
              <div className="section-header">
                <h2>Telemetry</h2>
                <span className="subtitle">Live app metrics</span>
              </div>
              <div className="stack" style={{ marginTop: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>Page views</span>
                  <span className="pill">{telemetry.page_views ?? 0}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>Errors (24h)</span>
                  <span className="pill">{telemetry.errors_last_24h ?? 0}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>P95 latency</span>
                  <span className="pill">{`${telemetry.api_latency_p95_ms ?? 0}ms`}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>Avg load</span>
                  <span className="pill">{`${telemetry.avg_load_ms ?? 0}ms`}</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span>Last improvement</span>
                  <span className="pill">{new Date(data?.last_improvement || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
        <div className="card">
              <div className="section-header">
                <h2>Learning progress</h2>
                <span className="subtitle">Model improvement over time</span>
              </div>
              <div className="stack" style={{ marginTop: 10 }}>
                <GaugeChart value={learningRate} label="Learning" />
                <GaugeChart value={confidence} label="Confidence" />
                <GaugeChart value={Math.min(100, ((data?.iterations || 0) / 200) * 100)} label="Iterations" />
              </div>
            </div>
        <div className="card">
              <div className="section-header">
                <h2>Improvement suggestions</h2>
                <span className="subtitle">Prioritized backlog</span>
              </div>
              <div className="stack stack-sm" style={{ marginTop: 10 }}>
                {suggestions.map((s) => (
                  <div key={s.id} className="card card-sm">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div className="h3">{s.title}</div>
                        {s.detail ? <p className="muted" style={{ marginTop: 6 }}>{s.detail}</p> : null}
                        <div className="row" style={{ marginTop: 6, gap: 8 }}>
                          <span className={cn('tag', s.impact === 'high' ? 'success' : s.impact === 'medium' ? 'warn' : 'info')}>{s.impact} impact</span>
                          <span className={cn('tag', s.effort === 'low' ? 'success' : s.effort === 'medium' ? 'warn' : 'danger')}>{s.effort} effort</span>
                        </div>
                      </div>
                      <span className={cn('tag', s.status === 'done' ? 'success' : s.status === 'in-progress' ? 'warn' : 'info')}>{s.status}</span>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <select className="select" style={{ width: 220 }} value={s.status} onChange={(e) => updateStatus(s.id, e.target.value)}>
                        <option value="proposed">proposed</option>
                        <option value="in-progress">in-progress</option>
                        <option value="done">done</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        <div className="card">
              <div className="section-header">
                <h2>Self-improve agent</h2>
                <span className="subtitle">Run bounded repo improvements</span>
              </div>
              <div className="stack" style={{ marginTop: 10, gap: 10 }}>
                <input className="input" placeholder="Improvement prompt..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn primary" onClick={async () => { setAgentStatus('running'); const client = createForgeOSClient({ baseUrl: window.location.origin }); try { await client.runAgentSelfImprove(feedback || 'Make one small safe improvement', ['apps/brain-console']); } catch {} window.location.reload(); }}>Run agent</button>
                  <button className="btn secondary" onClick={async () => { const client = createForgeOSClient({ baseUrl: window.location.origin }); const s = await client.getAgentRunStatus(); setAgentStatus(s.status || 'idle'); alert(s.status + '\n' + (s.latestLog || []).join('\n')); }}>Status</button>
                  <span className={cn('pill', agentStatus === 'ok' ? 'success' : agentStatus === 'running' ? 'warn' : 'ok')} style={{ marginLeft: 'auto' }}>{agentStatus}</span>
                </div>
              </div>
            </div>
        <div className="card">
              <div className="section-header">
                <h2>Feedback</h2>
                <span className="subtitle">Community input</span>
              </div>
              <div className="stack" style={{ marginTop: 10 }}>
                {feedbacks.map((f) => (
                  <div key={f.id} className="card card-sm">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <div className="h3">{f.source} feedback</div>
                        <p className="muted mono">{f.date}</p>
                      </div>
                      <span className="pill">{f.rating}/5</span>
                    </div>
                    <p className="muted" style={{ marginTop: 8 }}>{f.comment}</p>
                  </div>
                ))}
              </div>
            </div>
        <div className="card">
              <div className="section-header">
                <h2>Submit feedback</h2>
                <span className="subtitle">Submit Feedback overview</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Your feedback..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                <select className="select" style={{ width: 140 }} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}/5</option>)}
                </select>
                <button className="btn primary" onClick={submit} disabled={!feedback.trim()}>Submit</button>
              </div>
            </div>
        <div className="card">
              <div className="section-header">
                <h2>Agent memory</h2>
                <span className="subtitle">Persisted context across sessions</span>
              </div>
              <div className="stack stack-sm" style={{ marginTop: 10 }}>
                {memoryEntries.length === 0 ? (
                  <p className="muted">No memory entries yet. Add one below.</p>
                ) : (
                  memoryEntries.map((m) => (
                    <div key={m.key} className="card card-sm">
                      <div className="h3 mono">{m.key}</div>
                      <p className="muted" style={{ marginTop: 6 }}>{m.value}</p>
                      <p className="muted mono" style={{ marginTop: 6, fontSize: 11 }}>updated {new Date(m.updated_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="key" value={memKey} onChange={(e) => setMemKey(e.target.value)} />
                <input className="input" style={{ flex: 2, minWidth: 180 }} placeholder="value / note" value={memValue} onChange={(e) => setMemValue(e.target.value)} />
                <button className="btn primary" onClick={saveMemory} disabled={!memKey.trim() || !memValue.trim() || memBusy}>{memBusy ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </>
      )}
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
  const { navigate } = usePathRoute();
  return (
    <div className="fadein">      <p className="muted">This panel hasn't been wired yet.</p>
      <a className="btn primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</a>
    </div>
  );
}

function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: 'Welcome to ForgeOS', body: 'Use the sidebar to navigate between governance, knowledge, and platform panels.' },
    { title: 'Keyboard shortcuts', body: 'Press ? to view shortcuts, or Ctrl/Cmd+K to open the command palette.' },
    { title: 'Stay synced', body: 'The runtime persists state and feedback automatically as you work.' },
  ];
  const current = steps[step];
  return (
    <div className="cmdk open" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: 16, maxWidth: 420 }}>
        <div className="h3">{current.title}</div>
        <p className="muted" style={{ marginTop: 8 }}>{current.body}</p>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
          <button className="btn secondary" onClick={onClose}>Skip</button>
          <button className="btn primary" onClick={() => { if (step + 1 >= steps.length) { localStorage.setItem('forgeos-tour-done', 'true'); onClose(); } else setStep((s) => s + 1); }}>{step + 1 >= steps.length ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

// Real-time brain sync indicator. Opens a WebSocket to ws://<host>/ws and
// reflects the live connection state as a small pill in the top nav. Falls
// back gracefully and auto-reconnects if the socket drops.
function SyncPill() {
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${proto}//${location.host}/ws`);
      } catch {
        setState('closed');
        return;
      }
      ws.onopen = () => setState('open');
      ws.onmessage = () => setState('open');
      ws.onclose = () => {
        setState('closed');
        if (!stopped) retry = setTimeout(connect, 2500);
      };
      ws.onerror = () => {
        setState('closed');
        try { ws?.close(); } catch { /* ignore */ }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, []);

  const label = state === 'open' ? 'LIVE SYNC' : state === 'connecting' ? 'SYNCING' : 'SYNC OFFLINE';
  const cls = state === 'open' ? 'ok' : state === 'connecting' ? 'warn' : 'err';
  return (
    <span className={`pill ${cls}`} data-tooltip="Real-time brain sync (WebSocket)">
      <span className="dot"></span>{label}
    </span>
  );
}

export default function App() {
  const { path, navigate } = usePathRoute();
  const route = useMemo(() => matchRoute(path), [path]);
  const { theme, setTheme, contrast, setContrast } = useTheme();
  const { showShortcuts, setShowShortcuts } = useShortcuts();
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const [showTour, setShowTour] = useState<boolean>(() => {
    try { return localStorage.getItem('forgeos-tour-done') !== 'true'; } catch { return true; }
  });

  const statusApi = useApi('/api/status');
  const rolesApi = useApi('/api/roles');
  const searchApi = useApi('/api/search?q=' + encodeURIComponent(new URLSearchParams(window.location.search.slice(1)).get('q') || ''));
  const missionsApi = useApi('/api/missions');
  const timelineApi = useApi('/api/timeline');
  const complianceApi = useApi('/api/compliance');
  const federationApi = useApi('/api/federation');
  const webhooksApi = useApi('/api/webhooks');
  const ledgerApi = useApi('/api/ledger?from=2000-01-01');
  const appsApi = useApi('/api/apps');
  const developersApi = useApi('/api/developers');
  const projectsApi = useApi('/api/projects');
  const marketplaceApi = useApi('/api/marketplace');
  const pluginsApi = useApi('/api/plugins');
  const monitoringApi = useApi('/api/monitoring');
  const workflowsApi = useApi('/api/workflows');
  const configApi = useApi('/api/config');
  const settingsApi = useApi('/api/settings');
  const selfImproveApi = useApi('/api/self-improve');
  const embedApi = useApi('/api/embed');
  const vaultApi = useApi('/api/vault');
  const mcpApi = useApi('/api/mcp');
  const poolLeagueApi = useApi('/api/poolleague');
  const schemaApi = useApi('/api/schema');
  const governanceApi = useApi('/api/governance');
  const auditApi = useApi('/api/audit');
  const apiErrors = [statusApi, rolesApi, searchApi, missionsApi, timelineApi, complianceApi, federationApi, webhooksApi, ledgerApi, appsApi, developersApi, projectsApi, marketplaceApi, pluginsApi, monitoringApi, workflowsApi, configApi, settingsApi, selfImproveApi, embedApi, vaultApi, mcpApi, poolLeagueApi, schemaApi, governanceApi, auditApi];
  const routeError = apiErrors.find((api) => api.error)?.error || null;
  void apiErrors;

  const renderPanel = () => {
    if (route.startsWith('/page/')) {
      const slug = route.slice('/page/'.length);
      return <PagePanel slug={slug} />;
    }
    if (isFeatureRoute(route)) return renderFeature(route);
    switch (route) {
      case '/dashboard':
        return <Dashboard status={statusApi.data} roles={rolesApi.data} />;
      case '/roles':
        return <Roles roles={rolesApi.data} />;
      case '/search':
        return <Search data={searchApi.data} />;
      case '/capture':
        return <Capture />;
      case '/decisions':
        return <Decisions />;
      case '/timeline':
        return <TimelinePanel data={timelineApi.data} />;
      case '/ledger':
        return <LedgerPanel data={ledgerApi.data} />;
      case '/missions':
        return <MissionsPanel data={missionsApi.data} />;
      case '/compliance':
        return <CompliancePanel data={complianceApi.data} />;
      case '/federation':
        return <FederationPanel data={federationApi.data} />;
      case '/webhooks':
        return <WebhooksPanel data={webhooksApi.data} />;
      case '/apps':
        return <AppStorePanel data={appsApi.data} />;
      case '/developers':
        return <DeveloperPanel />;
      case '/self-improve':
        return <SelfImprovePanel data={selfImproveApi.data} />;
      case '/mcp':
        return <McpPanel data={mcpApi.data} />;
      case '/vault':
        return <VaultPanel data={vaultApi.data} />;
      case '/embed':
        return <EmbedPanel data={embedApi.data} />;
      case '/audit':
        return <AuditPanel data={auditApi.data} />;
      case '/schema':
        return <SchemaPanel data={schemaApi.data} />;
      case '/config':
        return <ConfigPanel data={configApi.data} />;
      case '/command':
        return <CommandPanel />;
      case '/governance':
        return <GovernancePanel data={governanceApi.data} />;
      case '/monitoring':
        return <MonitoringPanel data={monitoringApi.data} />;
      case '/workflows':
        return <WorkflowsPanel data={workflowsApi.data} />;
      case '/marketplace':
        return <MarketplacePanel data={marketplaceApi.data} />;
      case '/plugins':
        return <PluginsPanel data={pluginsApi.data} />;
      case '/projects':
        return <ProjectsPanel data={projectsApi.data} />;
      case '/settings':
        return <SettingsPanel data={settingsApi.data} />;
      case '/poolleague':
        return <PoolLeaguePanel data={poolLeagueApi.data} />;
      default:
        return <NotFound />;
    }
  };

  return (
    <div id="app">
      <header className="topnav">
        <div className="topnav-brand">
          <span>ForgeOS</span>
          <span className="topnav-divider" aria-hidden="true"></span>
          <span className="os">Console</span>
        </div>
        <div className="topnav-actions">
          <span className="pill" data-tooltip="Console port">7777</span>
          <OfflineIndicator />
          <SyncPill />
          <div className="cmd-pill" data-tooltip="Open command palette" onClick={() => setCommandOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>search</span>
            CMD+K
          </div>
          <ThemeSwatches value={theme} onChange={setTheme} />
          <select
            data-tooltip="Contrast mode"
            value={contrast}
            onChange={(e) => setContrast(e.target.value)}
            className="select"
            aria-label="Contrast mode"
            style={{ width: 140 }}
          >
            {CONTRASTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="btn secondary sm" aria-label="Show keyboard shortcuts" onClick={() => setShowShortcuts(true)}>Shortcuts</button>
          <button className="btn secondary sm" aria-label="Open command palette" onClick={() => setCommandOpen(true)}>Command</button>
        </div>
      </header>
      <a href="#main-canvas" className="skip-link">Skip to main content</a>
      <div className="app-shell bento-shell">
        <Sidebar route={route} onNavigate={navigate} />
        <main id="main-canvas" tabIndex={-1} className="main-canvas" aria-label="Main content">
          <div className="page-header-row">
            <div>
              <h1 className="page-header">Mission Control</h1>
              <p className="page-subtitle">Real-time monitoring of synaptic pathways and cognitive nodes.</p>
            </div>
            <span className="pill ok"><span className="dot"></span>CORE ACTIVE</span>
          </div>
          <nav className="breadcrumb" aria-label="breadcrumb">
            <a href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>ForgeOS</a>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{route.replace(/^\//, '')}</span>
          </nav>
          <DebugErrorBoundary>
            {renderPanel()}
          </DebugErrorBoundary>
          {routeError ? <div className="page-error" role="alert">{routeError}</div> : null}
        </main>
      </div>
      <div className="status-bar" role="status" aria-live="polite">
        <span className="status-bar-title">ForgeOS Brain Console</span>
        <span className="status-bar-sep">•</span>
        <span className="status-bar-meta">React/Express</span>
        <span className="status-bar-sep">•</span>
        <span className="status-bar-meta">OS_STATUS: NOMINAL</span>
      </div>
      {showShortcuts ? <ShortcutsOverlay onClose={() => setShowShortcuts(false)} /> : null}
      {commandOpen ? <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} onNavigate={navigate} /> : null}
      {showTour ? <OnboardingTour onClose={() => setShowTour(false)} /> : null}
      <div className="toasts" id="toasts" />
    </div>
  );
}