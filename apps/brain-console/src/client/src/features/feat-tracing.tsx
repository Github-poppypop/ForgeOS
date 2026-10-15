import { useEffect, useState } from 'react';

// Tracing feature — conflict-free.
// Reads the `x-trace-id` header set by the server-side tracing middleware
// (src/server/features/feat-tracing.ts -> createTracingMiddleware) and explains
// the OpenTelemetry wiring. Auto-discovered by features/registry.ts.
// Automatic JSX runtime: do not import React.
export default {
  path: '/feature/tracing',
  label: 'Tracing',
  category: 'Observability',
  component: function TracingFeature() {
    const [traceId, setTraceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      fetch('/api/status')
        .then(async (r) => {
          if (!cancelled) {
            setTraceId(r.headers.get('x-trace-id') || '(no x-trace-id header)');
            setLoading(false);
          }
        })
        .catch((e: Error) => {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        });
      return () => { cancelled = true; };
    }, []);

    return (
      <div className="panel">
        <h2 className="section-header">Request Tracing</h2>
        <p className="subtitle">
          Every HTTP request is assigned a trace id (W3C-compatible) returned in the{' '}
          <code>x-trace-id</code> response header and attached to structured logs.{' '}
          OpenTelemetry spans are wired via <code>@opentelemetry/api</code> — add an SDK
          exporter to visualize them.
        </p>
        <div className="card">
          {loading ? (
            <p className="muted">Probing /api/status…</p>
          ) : error ? (
            <p className="muted" style={{ color: 'var(--danger)' }}>Error: {error}</p>
          ) : (
            <div className="row items-center" style={{ gap: 12 }}>
              <span className="tag mono">{traceId}</span>
              <span className="pill ok">active</span>
            </div>
          )}
        </div>
        <div className="card mt-3">
          <div className="section-header">
            <h3>Trace propagation</h3>
            <span className="subtitle">How to correlate across hops</span>
          </div>
          <ul className="muted" style={{ marginTop: 8 }}>
            <li>Send an <code>x-trace-id</code> header to continue an existing trace.</li>
            <li>Structured log lines for that request carry the same id.</li>
            <li>Add <code>@opentelemetry/sdk-node</code> + an exporter to observe spans.</li>
          </ul>
        </div>
      </div>
    );
  },
};
