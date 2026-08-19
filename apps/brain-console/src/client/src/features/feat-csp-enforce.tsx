// CSP Enforce feature — conflict-free.
// Shows the currently ENFORCED Content-Security-Policy and the live count of
// captured CSP violation reports. No edits to App.tsx / server.ts; auto-discovered
// by features/registry.ts. Automatic JSX runtime: do not import React.
import { useEffect, useState } from 'react';

interface SecurityHeaders {
  csp: string;
}
interface CspCount {
  count: number;
}

export default {
  path: '/feature/csp-enforce',
  label: 'CSP Enforce',
  category: 'Security',
  component: function CspEnforceFeature() {
    const [csp, setCsp] = useState<string>('');
    const [count, setCount] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    function refresh() {
      Promise.all([
        fetch('/api/security/headers').then((r) =>
          r.ok ? r.json() : Promise.reject(new Error('headers HTTP ' + r.status))
        ),
        fetch('/api/csp-report/count').then((r) =>
          r.ok ? r.json() : Promise.reject(new Error('count HTTP ' + r.status))
        ),
      ])
        .then(([h, c]) => {
          setCsp((h as SecurityHeaders).csp);
          setCount((c as CspCount).count);
          setError(null);
          setLoading(false);
        })
        .catch((e: Error) => {
          setError(e.message);
          setLoading(false);
        });
    }

    useEffect(() => {
      let cancelled = false;
      function tick() {
        fetch('/api/security/headers')
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('headers HTTP ' + r.status))))
          .then((h: SecurityHeaders) => {
            if (!cancelled) setCsp(h.csp);
          })
          .catch(() => {});
        fetch('/api/csp-report/count')
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('count HTTP ' + r.status))))
          .then((c: CspCount) => {
            if (!cancelled) setCount(c.count);
          })
          .catch(() => {});
      }
      tick();
      setLoading(false);
      const id = setInterval(tick, 5000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, []);

    return (
      <div className="panel stack stack-md">
        <div className="page-header-row">
          <div>
            <div className="section-header">CSP Enforce</div>
            <div className="subtitle">
              Content-Security-Policy is enforced (not report-only) with live violation telemetry.
            </div>
          </div>
          <button className="btn btn-ghost" onClick={refresh}>
            Refresh
          </button>
        </div>

        {error && <div className="card error">{error}</div>}

        <div className="row">
          <div className="card stat">
            <div className="label muted">Captured violations</div>
            <div className="h3">{loading ? '—' : (count ?? 0)}</div>
          </div>
          <div className="card stat">
            <div className="label muted">Mode</div>
            <div className="h3">Enforce</div>
          </div>
        </div>

        <div className="card">
          <div className="section-header">Enforced policy</div>
          <div className="code mono">{csp || '—'}</div>
        </div>
      </div>
    );
  },
};
