// Page Analytics feature — conflict-free. Auto-registers through the features glob
// (no App.tsx / server.ts edits), so it cannot collide with parallel waves.
// Tracks which console routes you visit most, persisted locally in localStorage,
// and surfaces the live session telemetry already kept on window.__forgeosTelemetry
// (API call count, error count, mount time). Mock-first: no backend dependency,
// graceful when telemetry is absent. Same-origin reads only.
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

interface Visit {
  count: number;
  last: number;
}

type VisitMap = Record<string, Visit>;

const STORAGE_KEY = 'forgeos:page-analytics:v1';

function safeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* access can throw in some sandboxed contexts */
  }
  return null;
}

function loadVisits(): VisitMap {
  const s = safeStorage();
  if (!s) return {};
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VisitMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveVisits(map: VisitMap): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private-mode — non-fatal */
  }
}

function currentRoute(): string {
  if (typeof window === 'undefined' || !window.location) return '/';
  return window.location.pathname || '/';
}

function age(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

interface SessionTelemetry {
  apiCalls: number;
  errors: number;
  mountMs: number;
}

function readSession(): SessionTelemetry | null {
  if (typeof window === 'undefined') return null;
  const t = (window as unknown as { __forgeosTelemetry?: {
    apiCalls?: number;
    errorsByApi?: Record<string, number>;
    mountMs?: number;
  } }).__forgeosTelemetry;
  if (!t) return null;
  const errors = t.errorsByApi
    ? (Object.values(t.errorsByApi) as number[]).reduce((a, b) => a + b, 0)
    : 0;
  return {
    apiCalls: typeof t.apiCalls === 'number' ? t.apiCalls : 0,
    errors,
    mountMs: typeof t.mountMs === 'number' ? t.mountMs : 0,
  };
}

export default {
  path: '/feature/page-analytics',
  label: 'Page Analytics',
  category: 'Observability',
  component: function PageAnalyticsFeature() {
    const [visits, setVisits] = useState<VisitMap>(loadVisits);
    const [session, setSession] = useState<SessionTelemetry | null>(null);
    const [cleared, setCleared] = useState(false);

    useEffect(() => {
      let stopped = false;
      const record = (route: string) => {
        if (!route) return;
        setVisits((prev) => {
          const next: VisitMap = { ...prev };
          const cur = next[route] ?? { count: 0, last: 0 };
          next[route] = { count: cur.count + 1, last: Date.now() };
          saveVisits(next);
          return next;
        });
      };

      // Seed with the route we are already on, then watch for navigation.
      record(currentRoute());
      setSession(readSession());

      const onPop = () => record(currentRoute());
      window.addEventListener('popstate', onPop);

      // Patch history so SPA route changes are also captured. Restored on cleanup.
      const originalPush = window.history.pushState?.bind(window.history);
      const originalReplace = window.history.replaceState?.bind(window.history);
      if (originalPush) {
        window.history.pushState = function (...args: Parameters<History['pushState']>) {
          const ret = originalPush(...args);
          record(currentRoute());
          return ret;
        } as typeof window.history.pushState;
      }
      if (originalReplace) {
        window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
          const ret = originalReplace(...args);
          record(currentRoute());
          return ret;
        } as typeof window.history.replaceState;
      }

      return () => {
        stopped = true;
        window.removeEventListener('popstate', onPop);
        if (originalPush) window.history.pushState = originalPush;
        if (originalReplace) window.history.replaceState = originalReplace;
        void stopped;
      };
    }, []);

    const rows = Object.entries(visits).sort((a, b) => b[1].count - a[1].count);
    const max = rows.reduce((m, [, v]) => Math.max(m, v.count), 0);
    const total = rows.reduce((sum, [, v]) => sum + v.count, 0);

    const clearAll = () => {
      saveVisits({});
      setVisits({});
      setCleared(true);
      window.setTimeout(() => setCleared(false), 2000);
    };

    return (
      <div className="panel">
        <h2 className="section-header">Page Analytics</h2>
        <p className="subtitle">
          Which console routes you use most, tracked locally in your browser. No server
          calls — counts persist across reloads.
        </p>

        {session && (
          <div className="card" style={{ marginTop: '12px' }}>
            <div className="section-header">Session telemetry</div>
            <p className="muted" style={{ marginTop: '6px' }}>
              Live metrics from this page load (via <code>window.__forgeosTelemetry</code>).
            </p>
            <div className="row" style={{ gap: '18px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div>
                <div className="stat-value">{session.apiCalls}</div>
                <div className="muted">API calls</div>
              </div>
              <div>
                <div className="stat-value">{session.errors}</div>
                <div className="muted">client errors</div>
              </div>
              <div>
                <div className="stat-value">{session.mountMs} ms</div>
                <div className="muted">mount time</div>
              </div>
            </div>
          </div>
        )}

        <div className="row" style={{ gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
          <span className="muted">Total visits tracked: {total}</span>
          <button className="btn primary sm" onClick={clearAll}>
            Clear tracking
          </button>
          {cleared && <span className="pill ok">cleared</span>}
        </div>

        {rows.length === 0 ? (
          <div className="card empty" style={{ marginTop: '12px' }}>
            <p className="muted">
              No visits recorded yet. Navigate around the console and return here to see
              your most-used routes.
            </p>
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: '12px' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Visits</th>
                  <th style={{ width: '40%' }}>Usage</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([route, v]) => {
                  const pct = max > 0 ? Math.round((v.count / max) * 100) : 0;
                  const barStyle: CSSProperties = {
                    height: '8px',
                    width: `${pct}%`,
                    minWidth: v.count > 0 ? '4px' : '0',
                    borderRadius: '4px',
                    background: 'var(--accent, #2BA6C9)',
                  };
                  return (
                    <tr key={route}>
                      <td>
                        <code>{route}</code>
                      </td>
                      <td className="muted">{v.count}</td>
                      <td>
                        <div
                          style={{
                            background: 'rgba(148,163,184,0.18)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={barStyle} />
                        </div>
                      </td>
                      <td className="muted">{age(v.last)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  },
};
