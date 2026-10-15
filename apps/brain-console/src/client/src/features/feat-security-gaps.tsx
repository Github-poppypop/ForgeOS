// Security Posture feature — conflict-free. Auto-registers through the features glob
// (no App.tsx / server.ts / design.css edits), so it cannot collide with parallel waves.
// Surfaces the LIVE security-header enforcement (read from the response headers of a
// same-origin probe to /api/health) plus the documented remaining production
// recommendations carried from SECURITY-GAPS.md, giving operators a single
// production-readiness view. Graceful when the API is unreachable (shows "unknown").
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useState } from 'react';

interface HeaderCheck {
  name: string;
  label: string;
  /** true = header present on the probe response, false = missing, null = unknown. */
  present: boolean | null;
}

// Security headers that should be enforced by applySecurityHeaders() in server.ts.
const SECURITY_HEADERS: { name: string; label: string }[] = [
  { name: 'content-security-policy', label: 'Content-Security-Policy' },
  { name: 'strict-transport-security', label: 'Strict-Transport-Security' },
  { name: 'x-content-type-options', label: 'X-Content-Type-Options' },
  { name: 'x-frame-options', label: 'X-Frame-Options' },
  { name: 'referrer-policy', label: 'Referrer-Policy' },
  { name: 'permissions-policy', label: 'Permissions-Policy' },
];

// Remaining recommendations carried from SECURITY-GAPS.md (verified 2026-08-24).
// Auth, CORS, and CSRF (previously listed here) are now IMPLEMENTED and verified:
//   - Auth gate (feat-auth-gate.ts): env-gated CONSOLE_TOKEN / JWT_SECRET, public
//     allowlist for health/login/stream/csrf-token. Verified live: noTok=401, withTok=200.
//   - CORS restriction (feat-cors.ts): allowlist via ALLOWED_ORIGINS; permissive when unset.
//   - CSRF enforcement (feat-csrf.ts): double-submit cookie on POST/PUT/PATCH/DELETE,
//     env-gated to CONSOLE_TOKEN (no-op in dev/tests).
const REMAINING: { title: string; detail: string }[] = [
  {
    title: 'Reverse proxy ownership',
    detail: 'If fronted by nginx/Cloudflare, let it own HSTS / CDN / WAF.',
  },
  {
    title: 'Activate alerting',
    detail: 'Set SENTRY_DSN or ALERT_WEBHOOK_URL in the VPS env so alertError actually delivers.',
  },
];

export default {
  path: '/feature/security-gaps',
  label: 'Security Posture',
  category: 'Observability',
  component: function SecurityPostureFeature() {
    const [headers, setHeaders] = useState<HeaderCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [checkedAt, setCheckedAt] = useState<number | null>(null);

    useEffect(() => {
      const controller = new AbortController();
      const run = async () => {
        try {
          const res = await fetch('/api/health', { signal: controller.signal });
          const out: HeaderCheck[] = SECURITY_HEADERS.map((h) => ({
            name: h.name,
            label: h.label,
            present: res.headers.get(h.name) !== null,
          }));
          setHeaders(out);
          setCheckedAt(Date.now());
        } catch {
          setHeaders(
            SECURITY_HEADERS.map((h) => ({ name: h.name, label: h.label, present: null })),
          );
        } finally {
          setLoading(false);
        }
      };
      void run();
      return () => controller.abort();
    }, []);

    const enforced = headers.filter((h) => h.present === true).length;
    const unknown = headers.filter((h) => h.present === null).length;
    const probed = unknown === 0;

    return (
      <div className="panel">
        <h2 className="section-header">Security Posture</h2>
        <p className="subtitle">
          Live security-header enforcement (probed from the <code>/api/health</code> response
          headers) and the documented remaining production recommendations from SECURITY-GAPS.md.
        </p>

        <div className="row" style={{ gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
          {probed ? (
            <span className={enforced === SECURITY_HEADERS.length ? 'pill ok' : 'pill warn'}>
              {enforced}/{SECURITY_HEADERS.length} headers enforced
            </span>
          ) : (
            <span
              className="pill"
              style={{
                background: 'rgba(148,163,184,0.18)',
                color: '#cbd5e1',
                borderColor: 'rgba(148,163,184,0.5)',
              }}
            >
              unknown — API unreachable
            </span>
          )}
          {checkedAt !== null && (
            <span className="muted">
              Checked {Math.max(0, Math.round((Date.now() - checkedAt) / 1000))}s ago
            </span>
          )}
        </div>

        <h3 className="section-header" style={{ marginTop: '16px' }}>
          Enforced security headers
        </h3>
        <div className="table-wrap" style={{ marginTop: '8px' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Header</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h) => (
                <tr key={h.name}>
                  <td>
                    <code>{h.label}</code>
                  </td>
                  <td>
                    {h.present === true && <span className="pill ok">enforced</span>}
                    {h.present === false && <span className="pill bad">missing</span>}
                    {h.present === null && (
                      <span
                        className="pill"
                        style={{
                          background: 'rgba(148,163,184,0.18)',
                          color: '#cbd5e1',
                          borderColor: 'rgba(148,163,184,0.5)',
                        }}
                      >
                        unknown
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="section-header" style={{ marginTop: '16px' }}>
          Remaining recommendations
        </h3>
        <div className="table-wrap" style={{ marginTop: '8px' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Area</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {REMAINING.map((r) => (
                <tr key={r.title}>
                  <td>
                    <code>{r.title}</code>
                  </td>
                  <td className="muted">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && headers.length === 0 && (
          <p className="muted" style={{ marginTop: '12px' }}>
            Probing security headers…
          </p>
        )}
      </div>
    );
  },
};
