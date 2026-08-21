// Access-control lists per role on sensitive pages — closes Batch D #37.
// Mock-first (no backend required): ACL state lives in localStorage. The panel
// auto-registers through features/registry.ts (import.meta.glob) — no edits to
// App.tsx or server.ts. This project uses the automatic JSX runtime, so React
// is not imported.
import { useEffect, useState } from 'react';

export interface Role {
  key: string;
  label: string;
  description: string;
}

export interface SensitivePage {
  path: string;
  label: string;
}

export const ROLES: Role[] = [
  { key: 'admin', label: 'Admin', description: 'Full control over every surface.' },
  { key: 'operator', label: 'Operator', description: 'Runs agents and dispatches missions.' },
  { key: 'auditor', label: 'Auditor', description: 'Read-only access to compliance surfaces.' },
  { key: 'viewer', label: 'Viewer', description: 'Standard read access; no sensitive surfaces.' },
];

// Curated from real console routes (see features/registry.ts discovery).
export const SENSITIVE_PAGES: SensitivePage[] = [
  { path: '/feature/audit-trail', label: 'Audit Trail' },
  { path: '/feature/csp-enforce', label: 'CSP Enforcement' },
  { path: '/feature/rate-limit', label: 'Rate Limiter' },
  { path: '/feature/alert-status', label: 'Alerting' },
  { path: '/feature/dead-letter', label: 'Dead-letter Queue' },
  { path: '/feature/agent-cost', label: 'Agent Cost' },
  { path: '/feature/bulk-vault', label: 'Bulk Vault' },
  { path: '/feature/agent-cache', label: 'Agent Memory Cache' },
  { path: '/feature/ab-routing', label: 'A/B Routing' },
  { path: '/feature/api-docs', label: 'API Docs' },
];

const STORAGE_KEY = 'forgeos-acl';

// role -> pagePath -> allowed
export type AclMatrix = Record<string, Record<string, boolean>>;

export function defaultAcl(): AclMatrix {
  const m: AclMatrix = {};
  for (const r of ROLES) {
    m[r.key] = {};
    for (const p of SENSITIVE_PAGES) {
      if (r.key === 'admin') m[r.key][p.path] = true;
      else if (r.key === 'auditor')
        m[r.key][p.path] =
          p.path === '/feature/audit-trail' ||
          p.path === '/feature/csp-enforce' ||
          p.path === '/feature/api-docs';
      else if (r.key === 'operator') m[r.key][p.path] = p.path !== '/feature/csp-enforce';
      else m[r.key][p.path] = false; // viewer
    }
  }
  return m;
}

function readAcl(): AclMatrix {
  if (typeof localStorage === 'undefined') return defaultAcl();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAcl();
    const parsed = JSON.parse(raw) as Partial<AclMatrix>;
    // Merge over defaults so newly added roles/pages are always covered.
    const base = defaultAcl();
    for (const r of ROLES) base[r.key] = { ...base[r.key], ...(parsed[r.key] ?? {}) };
    return base;
  } catch {
    return defaultAcl();
  }
}

function writeAcl(m: AclMatrix): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

export default {
  path: '/feature/acl',
  label: 'Access Control',
  category: 'Platform',
  component: function AccessControlPanel() {
    const [acl, setAcl] = useState<AclMatrix>(() => readAcl());

    useEffect(() => {
      writeAcl(acl);
    }, [acl]);

    const toggle = (role: string, page: string) => {
      setAcl((prev) => ({
        ...prev,
        [role]: { ...(prev[role] ?? {}), [page]: !(prev[role]?.[page]) },
      }));
    };

    const reset = () => setAcl(defaultAcl());

    const allowedCount = (role: string): number =>
      SENSITIVE_PAGES.filter((p) => acl[role]?.[p.path]).length;

    return (
      <div className="panel">
        <h2 className="section-header">Access Control Lists</h2>
        <p className="subtitle">
          Per-role access to sensitive surfaces (mock-first, stored in your browser). {ROLES.length} roles
          {' × '}
          {SENSITIVE_PAGES.length} sensitive pages.
        </p>
        <div className="wrap items-center" style={{ marginBottom: 'var(--s3)' }}>
          <button type="button" className="btn secondary sm" onClick={reset}>
            Reset to defaults
          </button>
        </div>

        <div className="stack stack-md" style={{ marginBottom: 'var(--s4)' }}>
          {ROLES.map((r) => (
            <div key={r.key} className="card">
              <div className="row items-center" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="mono">{r.label}</div>
                  <p className="caption" style={{ margin: 0 }}>
                    {r.description}
                  </p>
                </div>
                <div className="mono">
                  {allowedCount(r.key)}/{SENSITIVE_PAGES.length} allowed
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="stack stack-md">
          {SENSITIVE_PAGES.map((p) => (
            <div key={p.path} className="card">
              <div
                className="row items-center"
                style={{ justifyContent: 'space-between', marginBottom: 'var(--s2)' }}
              >
                <div className="mono">{p.label}</div>
                <span className="caption">{p.path}</span>
              </div>
              <div className="row wrap items-center" style={{ gap: 'var(--s2)' }}>
                {ROLES.map((r) => {
                  const allowed = acl[r.key]?.[p.path] ?? false;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      className={`btn sm ${allowed ? 'primary' : 'secondary'}`}
                      aria-pressed={allowed}
                      onClick={() => toggle(r.key, p.path)}
                    >
                      {r.label}: {allowed ? 'Allow' : 'Deny'}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};
