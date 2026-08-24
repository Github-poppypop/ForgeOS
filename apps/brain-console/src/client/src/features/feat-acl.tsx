// Access Control (RBAC) feature — conflict-free. Auto-registers through the
// features glob (no App.tsx / server.ts edits), so it cannot collide with other
// waves. Renders an ACL matrix of sensitive console pages (derived from the real
// discovered FEATURES) × roles, with allow/deny toggles persisted to
// localStorage. Mock-first: the matrix is a local configuration preview; actual
// request-time enforcement is a backend follow-up (same honesty as the
// audit-trail panel). Uses the automatic JSX runtime, so React is not imported.
import { useMemo, useState } from 'react';
import { FEATURES } from './registry';

const ROLES = ['Admin', 'Engineering', 'Product', 'C-Suite', 'Viewer'] as const;
type Role = (typeof ROLES)[number];

// Categories treated as sensitive for access-control purposes.
const SENSITIVE_CATEGORIES = new Set(['Observability', 'Admin', 'Security']);
// Path fragments that always mark a page sensitive regardless of category.
const SENSITIVE_PATH_FRAGMENTS = ['admin', 'audit', 'secret', 'credential', 'security', 'acl'];

interface SensitivePage {
  path: string;
  label: string;
  category: string;
}

// Derive the sensitive page set from the live feature registry so the matrix
// always reflects shipped routes (no hard-coded page list to drift).
function sensitivePages(): SensitivePage[] {
  const seen = new Set<string>();
  const out: SensitivePage[] = [];
  for (const f of FEATURES) {
    if (seen.has(f.path)) continue;
    const cat = f.category || 'Features';
    const fragMatch = SENSITIVE_PATH_FRAGMENTS.some((frag) => f.path.includes(frag));
    if (SENSITIVE_CATEGORIES.has(cat) || fragMatch) {
      seen.add(f.path);
      out.push({ path: f.path, label: f.label, category: cat });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

const STORAGE_KEY = 'forgeos.acl.matrix.v1';

type Matrix = Record<string, Partial<Record<Role, boolean>>>;

function defaultAllowed(role: Role): boolean {
  // Sensitive pages are allow-by-default only for Admin; everyone else is denied.
  return role === 'Admin';
}

function loadMatrix(pages: SensitivePage[]): Matrix {
  let stored: Matrix = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as Matrix;
    }
  } catch {
    stored = {};
  }
  const out: Matrix = {};
  for (const p of pages) {
    out[p.path] = out[p.path] || {};
    for (const r of ROLES) {
      const saved = stored[p.path]?.[r];
      out[p.path][r] = typeof saved === 'boolean' ? saved : defaultAllowed(r);
    }
  }
  return out;
}

function persistMatrix(m: Matrix): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    }
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

export default {
  path: '/feature/acl',
  label: 'Access Control',
  category: 'Admin',
  component: function AccessControlFeature() {
    const pages = useMemo(() => sensitivePages(), []);
    const [matrix, setMatrix] = useState<Matrix>(() => loadMatrix(pages));
    const [justSaved, setJustSaved] = useState(false);

    const viewerExposed = pages.filter((p) => matrix[p.path]?.Viewer === true).length;

    const toggle = (page: string, role: Role) => {
      if (role === 'Admin') return; // Admin is always allowed on sensitive pages
      setMatrix((prev) => {
        const next: Matrix = { ...prev, [page]: { ...prev[page], [role]: !(prev[page]?.[role] ?? false) } };
        persistMatrix(next);
        return next;
      });
      setJustSaved(false);
    };

    const reset = () => {
      const next = loadMatrix(pages);
      // Re-apply defaults (ignore any stored overrides).
      for (const p of pages) for (const r of ROLES) next[p.path][r] = defaultAllowed(r);
      setMatrix(next);
      persistMatrix(next);
      setJustSaved(false);
    };

    return (
      <div className="panel">
        <h2 className="section-header">Access Control</h2>
        <p className="subtitle">
          Role-based access for sensitive console pages. This is a local configuration
          preview — request-time enforcement is a backend follow-up. Changes are saved to
          this browser only.
        </p>

        <div className="row" style={{ gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
          <span className={`pill ${viewerExposed > 0 ? 'warn' : 'ok'}`}>
            {viewerExposed > 0 ? `${viewerExposed} sensitive page(s) open to Viewer` : 'no Viewer exposure'}
          </span>
          <span className="muted">{pages.length} sensitive page(s)</span>
          {justSaved && <span className="pill ok">saved</span>}
          <button
            className="btn primary sm"
            onClick={() => {
              persistMatrix(matrix);
              setJustSaved(true);
            }}
          >
            Save
          </button>
          <button className="btn sm" onClick={reset}>
            Reset to defaults
          </button>
        </div>

        {pages.length === 0 ? (
          <div className="card" style={{ marginTop: '12px' }}>
            <p className="muted">No sensitive pages discovered in the current build.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: '12px' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Sensitive page</th>
                  {ROLES.map((r) => (
                    <th key={r}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.path}>
                    <td>
                      <code>{p.path}</code>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.label} · {p.category}
                      </div>
                    </td>
                    {ROLES.map((r) => {
                      const allowed = matrix[p.path]?.[r] ?? false;
                      const locked = r === 'Admin';
                      return (
                        <td key={r}>
                          <button
                            className={`btn sm ${allowed ? 'primary' : ''}`}
                            disabled={locked}
                            aria-pressed={allowed}
                            title={
                              locked
                                ? 'Admin is always allowed on sensitive pages'
                                : `${allowed ? 'Deny' : 'Allow'} ${r} on ${p.path}`
                            }
                            onClick={() => toggle(p.path, r)}
                          >
                            {allowed ? 'Allow' : 'Deny'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewerExposed > 0 && (
          <div className="card error" style={{ marginTop: '12px' }}>
            <p className="muted">
              {viewerExposed} sensitive page(s) are open to the Viewer role. Review before
              shipping enforcement — Viewer should typically be denied on sensitive pages.
            </p>
          </div>
        )}
      </div>
    );
  },
};
