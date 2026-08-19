// Rate-Limit Telemetry feature -- conflict-free. Auto-appears in the sidebar / command
// palette with NO edits to App.tsx or server.ts. Complements the Rate-Limit Dashboard
// (which shows remaining budget) by showing ENFORCEMENT: which routes actually returned
// HTTP 429, how often, and when they were last rejected.
// Note: this project uses the automatic JSX runtime, so you do NOT import React.
import { useEffect, useState } from 'react';

interface RouteTelemetry {
  count429: number;
  lastAt: string;
}

interface TelemetryPayload {
  perRoute: Record<string, RouteTelemetry>;
  total429: number;
  trackedRoutes: number;
  lastEventAt: string | null;
  updatedAt: string;
}

const POLL_MS = 5000;

function parseTs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function formatTime(iso: string | null | undefined): string {
  const t = parseTs(iso);
  return t === null ? '--' : new Date(t).toLocaleString();
}

function formatAge(iso: string | null | undefined): string {
  const t = parseTs(iso);
  if (t === null) return 'never';
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return secs + 's ago';
  const mins = Math.round(secs / 60);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.round(hrs / 24) + 'd ago';
}

function severity(count: number): { cls: string; label: string } {
  if (count >= 25) return { cls: 'tag danger', label: 'hot' };
  if (count >= 5) return { cls: 'tag warn', label: 'throttling' };
  if (count > 0) return { cls: 'tag info', label: 'enforced' };
  return { cls: 'tag success', label: 'clear' };
}

export default {
  path: '/feature/ratelimit-telemetry',
  label: 'Rate-Limit Telemetry',
  category: 'Observability',
  component: function RateLimitTelemetryFeature() {
    const [data, setData] = useState<TelemetryPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const controller = new AbortController();
      let stopped = false;

      const load = () => {
        fetch('/api/rate-limit/telemetry', { signal: controller.signal })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
          .then((d: Partial<TelemetryPayload>) => {
            if (stopped) return;
            setData({
              perRoute: d.perRoute ?? {},
              total429: d.total429 ?? 0,
              trackedRoutes: d.trackedRoutes ?? Object.keys(d.perRoute ?? {}).length,
              lastEventAt: d.lastEventAt ?? null,
              updatedAt: d.updatedAt ?? new Date().toISOString(),
            });
            setError(null);
            setLoading(false);
          })
          .catch((e: Error) => {
            if (stopped || e.name === 'AbortError') return;
            setError(e.message);
            setLoading(false);
          });
      };

      load();
      const timer = setInterval(load, POLL_MS);
      return () => {
        stopped = true;
        clearInterval(timer);
        controller.abort();
      };
    }, []);

    const rows = data
      ? Object.entries(data.perRoute).sort((a, b) => b[1].count429 - a[1].count429)
      : [];
    const worst = rows.length > 0 ? rows[0][1].count429 : 0;

    return (
      <div className="panel">
        <h2 className="section-header">Rate-Limit Telemetry</h2>
        <p className="subtitle">
          Per-route HTTP 429 enforcement counts, polled every {POLL_MS / 1000}s. Observed
          passively from finished responses -- limiting itself is untouched.
        </p>

        {loading && !data ? (
          <div className="card">
            <p className="muted">Loading 429 telemetry...</p>
          </div>
        ) : error ? (
          <div className="card error">
            <p className="muted">Failed to load telemetry: {error}</p>
          </div>
        ) : !data ? (
          <div className="card">
            <p className="muted">No telemetry available.</p>
          </div>
        ) : (
          <div className="stack stack-md">
            <div className="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
              <span className={'pill ' + (data.total429 > 0 ? 'bad' : 'ok')}>
                {data.total429} total 429{data.total429 === 1 ? '' : 's'}
              </span>
              <span className="pill">{data.trackedRoutes} route(s) rejected</span>
              <span className={severity(worst).cls}>peak: {severity(worst).label}</span>
              <span className="muted">Last rejection: {formatAge(data.lastEventAt)}</span>
            </div>

            {rows.length === 0 ? (
              <div className="card">
                <p className="muted">
                  No 429 responses since server start -- enforcement has not rejected any
                  request. Rate limiting is active on /api/feedback, /api/telemetry and
                  /api/self-improve/learning-loop.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>429 count</th>
                      <th>Status</th>
                      <th>Last hit</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([path, entry]) => {
                      const sev = severity(entry.count429);
                      return (
                        <tr key={path}>
                          <td>
                            <code>{path}</code>
                          </td>
                          <td>
                            <strong>{entry.count429}</strong>
                          </td>
                          <td>
                            <span className={sev.cls}>{sev.label}</span>
                          </td>
                          <td className="muted">{formatTime(entry.lastAt)}</td>
                          <td className="muted">{formatAge(entry.lastAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="muted">Snapshot taken {formatTime(data.updatedAt)}</p>
          </div>
        )}
      </div>
    );
  },
};
