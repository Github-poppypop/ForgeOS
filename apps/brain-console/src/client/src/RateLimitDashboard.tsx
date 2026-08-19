import React, { useEffect, useState } from 'react';

interface RouteLimit {
  remaining: number;
  limit: number;
  windowMs: number;
}

interface RateLimitStatus {
  routes?: Record<string, RouteLimit>;
  total?: { remaining: number; limit: number };
}

const POLL_MS = 5000;

export default function RateLimitDashboard(): React.JSX.Element {
  const [status, setStatus] = useState<RateLimitStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchStatus = async (): Promise<void> => {
      try {
        const res = await fetch('/api/rate-limit/status', {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = (await res.json()) as Partial<RateLimitStatus>;
        setStatus({
          routes: data.routes ?? {},
          total: data.total,
        });
        setError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setError((err as Error).message ?? 'Failed to load rate-limit status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_MS);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  const routeEntries = status?.routes
    ? Object.entries(status.routes)
    : [];

  return (
    <div className="card">
      <div className="section-header">
        <h2>Rate-limit status</h2>
      </div>

      {loading && !status ? (
        <div className="muted">Loading rate-limit status…</div>
      ) : error ? (
        <div className="muted">Error: {error}</div>
      ) : routeEntries.length === 0 ? (
        <div className="muted">No rate-limit data available.</div>
      ) : (
        <div>
          {status?.total ? (
            <div className="row">
              <span>Total</span>
              <div
                className="bar-rect"
                style={{
                  width: `${status.total.limit > 0
                    ? (status.total.remaining / status.total.limit) * 100
                    : 0}%`,
                }}
              />
              <span className="muted">
                {status.total.remaining}/{status.total.limit}
              </span>
            </div>
          ) : null}

          {routeEntries.map(([path, route]) => {
            const pct =
              route.limit > 0 ? (route.remaining / route.limit) * 100 : 0;
            return (
              <div className="row" key={path}>
                <span>{path}</span>
                <div
                  className="bar-rect"
                  style={{ width: `${pct}%` }}
                />
                <span className="muted">
                  {route.remaining}/{route.limit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
