// System Health feature — conflict-free. Auto-registers through the features glob
// (no App.tsx / server.ts edits), so it cannot collide with parallel waves.
// Aggregates the live status of core console endpoints into a single operations
// view, polling every 10s. Same-origin fetches run against whichever server is
// serving this console. Graceful when the API is unreachable: each endpoint shows
// "unknown" instead of crashing the panel.
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

interface Probe {
  path: string;
  label: string;
}

interface HealthResult {
  path: string;
  label: string;
  /** true = healthy (2xx), false = down (non-2xx), null = unknown / fetch error. */
  ok: boolean | null;
  http: number | null;
  latencyMs: number | null;
  detail: string;
  checkedAt: number | null;
}

// Core console endpoints the ops view should always be able to reach.
const PROBES: Probe[] = [
  { path: '/api/health', label: 'Core health' },
  { path: '/api/rate-limit/status', label: 'Rate limiter' },
  { path: '/api/otel', label: 'OpenTelemetry trace IDs' },
  { path: '/api/alerting/status', label: 'Alerting' },
  { path: '/api/self-improve/learning-loop', label: 'Self-improve loop' },
  { path: '/api/csp-report/count', label: 'CSP reporter' },
  { path: '/api/openapi.json', label: 'OpenAPI spec' },
];

const POLL_MS = 10000;

function age(ts: number | null): string {
  if (ts === null) return 'never';
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

interface PillInfo {
  cls: string;
  text: string;
  style?: CSSProperties;
}

function resultPill(r: HealthResult): PillInfo {
  if (r.ok === true) return { cls: 'pill ok', text: 'healthy' };
  if (r.ok === false) return { cls: 'pill bad', text: 'down' };
  return {
    cls: 'pill',
    text: 'unknown',
    style: {
      background: 'rgba(148,163,184,0.18)',
      color: '#cbd5e1',
      borderColor: 'rgba(148,163,184,0.5)',
    },
  };
}

function summarize(results: HealthResult[]): PillInfo {
  const decided = results.filter((r) => r.ok !== null);
  if (decided.length === 0) return { cls: 'pill warn', text: 'no data' };
  const down = results.filter((r) => r.ok === false).length;
  const up = results.filter((r) => r.ok === true).length;
  if (down === 0 && up > 0) return { cls: 'pill ok', text: 'all operational' };
  if (up === 0) return { cls: 'pill bad', text: 'full outage' };
  return { cls: 'pill warn', text: 'degraded' };
}

function extractDetail(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const obj = body as Record<string, unknown>;
  if (typeof obj.ok === 'boolean') return obj.ok ? 'ok' : 'not ok';
  if (typeof obj.status === 'string') return obj.status;
  return '';
}

export default {
  path: '/feature/health',
  label: 'System Health',
  category: 'Observability',
  component: function SystemHealthFeature() {
    const [results, setResults] = useState<HealthResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRun, setLastRun] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const runRef = useRef<() => void>(() => {});

    useEffect(() => {
      const controller = new AbortController();
      let stopped = false;

      const probeOne = async (p: Probe): Promise<HealthResult> => {
        const start = performance.now();
        try {
          const res = await fetch(p.path, { signal: controller.signal });
          const latency = Math.round(performance.now() - start);
          let detail = '';
          try {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('json')) detail = extractDetail(await res.json());
          } catch {
            /* empty or non-JSON body is fine */
          }
          return {
            path: p.path,
            label: p.label,
            ok: res.ok,
            http: res.status,
            latencyMs: latency,
            detail,
            checkedAt: Date.now(),
          };
        } catch (e) {
          const name = (e as Error)?.name;
          if (stopped || name === 'AbortError') {
            return {
              path: p.path,
              label: p.label,
              ok: null,
              http: null,
              latencyMs: null,
              detail: 'aborted',
              checkedAt: null,
            };
          }
          return {
            path: p.path,
            label: p.label,
            ok: null,
            http: null,
            latencyMs: null,
            detail: 'unreachable',
            checkedAt: null,
          };
        }
      };

      const run = async () => {
        setLoading(true);
        const out = await Promise.all(PROBES.map(probeOne));
        if (stopped) return;
        setResults(out);
        setLastRun(Date.now());
        const allUnknown = out.every((r) => r.ok === null);
        setError(allUnknown ? 'All endpoints unreachable — is the API running?' : null);
        setLoading(false);
      };

      runRef.current = run;
      void run();
      const timer = setInterval(() => void run(), POLL_MS);
      return () => {
        stopped = true;
        clearInterval(timer);
        controller.abort();
      };
    }, []);

    const summary = results.length ? summarize(results) : null;

    return (
      <div className="panel">
        <h2 className="section-header">System Health</h2>
        <p className="subtitle">
          Live status of core console endpoints, polled every {POLL_MS / 1000}s. Same-origin
          fetches run against whichever server is serving this console.
        </p>

        <div className="row" style={{ gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
          {summary && <span className={summary.cls}>{summary.text}</span>}
          <span className="muted">Last check: {age(lastRun)}</span>
          <button className="btn primary sm" onClick={() => runRef.current()}>
            Refresh
          </button>
        </div>

        {loading && results.length === 0 ? (
          <div className="card" style={{ marginTop: '12px' }}>
            <p className="muted">Probing endpoints…</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="card error" style={{ marginTop: '12px' }}>
                <p className="muted">{error}</p>
              </div>
            )}
            <div className="table-wrap" style={{ marginTop: '12px' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>Status</th>
                    <th>HTTP</th>
                    <th>Latency</th>
                    <th>Detail</th>
                    <th>Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const p = resultPill(r);
                    return (
                      <tr key={r.path}>
                        <td>
                          <code>{r.path}</code>
                        </td>
                        <td>
                          <span className={p.cls} style={p.style}>
                            {p.text}
                          </span>
                        </td>
                        <td className="muted">{r.http ?? '—'}</td>
                        <td className="muted">
                          {r.latencyMs != null ? `${r.latencyMs} ms` : '—'}
                        </td>
                        <td className="muted">{r.detail || '—'}</td>
                        <td className="muted">{age(r.checkedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: '10px' }}>
              {results.filter((r) => r.ok === true).length} healthy ·{' '}
              {results.filter((r) => r.ok === false).length} down ·{' '}
              {results.filter((r) => r.ok === null).length} unknown
            </p>
          </>
        )}
      </div>
    );
  },
};
