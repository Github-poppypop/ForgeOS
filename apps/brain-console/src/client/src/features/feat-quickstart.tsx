// Role-based Quickstart Wizards — closes Batch E #47.
// A self-contained, mock-first onboarding panel that presents a tailored,
// step-by-step quickstart for each operator role (C-Suite, Engineering,
// Admin, Product). Step completion persists in localStorage. Auto-registers
// via the features glob (registry.ts) — no edits to App.tsx / server.ts.
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useMemo, useState } from 'react';
import { FEATURES, findFeature } from './registry';

const STORAGE_KEY = 'forgeos-quickstart';

interface QuickstartStep {
  id: string;
  title: string;
  detail: string;
  /** A console route; only rendered as a link when it is a live feature. */
  route?: string;
}

interface QuickstartRole {
  id: string;
  title: string;
  blurb: string;
  steps: QuickstartStep[];
}

// Mock-first curated guidance. A live ROADMAP/progress API can layer on later
// behind the same UI. Routes are validated against the runtime feature registry
// at render time (findFeature) so no link can 404.
const ROLES: QuickstartRole[] = [
  {
    id: 'csuite',
    title: 'C-Suite',
    blurb: 'Set direction, delegate, and keep a live pulse on the org.',
    steps: [
      { id: 'vision', title: 'Confirm mission & vision', detail: 'Review the charter and make sure the Knowledge Universe reflects your north-star objectives.' },
      { id: 'checklist', title: 'Open the onboarding checklist', detail: 'Track bootstrap progress across ROADMAP phases 0–5.', route: '/feature/onboarding-checklist' },
      { id: 'agents', title: 'Delegate to C-suite agents', detail: 'Stand up one agent per domain (CEO/CFO/CMO/COO/CTO) and wire the reporting pipeline.' },
      { id: 'missions', title: 'Schedule your first mission', detail: 'Use the mission scheduler to assign and monitor cross-functional work.', route: '/feature/mission-scheduler' },
      { id: 'notes', title: 'Review release notes', detail: 'See what shipped and what is live in this build.', route: '/feature/release-notes' },
    ],
  },
  {
    id: 'engineering',
    title: 'Engineering',
    blurb: 'Run the runtime, ship features, and keep the build green.',
    steps: [
      { id: 'registry', title: 'Explore the feature registry', detail: 'Browse every auto-discovered feature module mounted in this build.', route: '/feature/featureflags' },
      { id: 'palette', title: 'Try the command palette', detail: 'Press Cmd/Ctrl+K to fuzzy-search every panel and feature.' },
      { id: 'ratelimit', title: 'Watch rate limits', detail: 'Monitor per-route rate-limit health in real time.', route: '/feature/ratelimit-dash' },
      { id: 'csp', title: 'Verify security headers', detail: 'Confirm CSP/HSTS and other hardening headers are enforced.', route: '/feature/csp-enforce' },
      { id: 'sse', title: 'Open the live brain channel', detail: 'Subscribe to the SSE stream for live brain sync.', route: '/feature/sse' },
    ],
  },
  {
    id: 'admin',
    title: 'Admin / Security',
    blurb: 'Lock down config, alerts, and audit trails.',
    steps: [
      { id: 'csp', title: 'Enforce CSP', detail: 'Move CSP from report-only to enforced and confirm no violations.', route: '/feature/csp-enforce' },
      { id: 'alerts', title: 'Configure alerting', detail: 'Set SENTRY_DSN or ALERT_WEBHOOK_URL and run a self-test.', route: '/feature/alert-status' },
      { id: 'webhooks', title: 'Manage webhooks', detail: 'Register outbound webhooks and test delivery receipts.', route: '/feature/webhooks' },
      { id: 'audit', title: 'Review the audit store', detail: 'Inspect structured audit events and export them.', route: '/feature/auditstore' },
      { id: 'otel', title: 'Check trace propagation', detail: 'Confirm x-trace-id is stamped on every request.', route: '/feature/otel' },
    ],
  },
  {
    id: 'product',
    title: 'Product / CPO',
    blurb: 'Shape the roadmap, marketplace, and onboarding funnel.',
    steps: [
      { id: 'roadmap', title: 'Mirror the ROADMAP', detail: 'Keep the onboarding checklist aligned to Phases 0–5.', route: '/feature/onboarding-checklist' },
      { id: 'marketplace', title: 'Browse the marketplace', detail: 'Discover and install registry plugins.', route: '/feature/marketplace-registry' },
      { id: 'kanban', title: 'Manage the backlog', detail: 'Drag-and-drop work items across pipeline columns.', route: '/feature/kanban' },
      { id: 'reading', title: 'Capture research', detail: 'Save semantic bookmarks to a shared reading list.', route: '/feature/reading-list' },
      { id: 'changelog', title: 'Publish a changelog', detail: 'Surface what is new to your users.', route: '/feature/changelog' },
    ],
  },
];

type CheckedMap = Record<string, boolean>;

function stepKey(roleId: string, stepId: string): string {
  return `${roleId}:${stepId}`;
}

function readChecked(): CheckedMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CheckedMap) : {};
  } catch {
    return {};
  }
}

function writeChecked(map: CheckedMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export default {
  path: '/feature/quickstart',
  label: 'Quickstart Wizard',
  category: 'Onboarding',
  component: function QuickstartWizard() {
    const [selected, setSelected] = useState<string>(ROLES[0].id);
    const [checked, setChecked] = useState<CheckedMap>(() => readChecked());

    useEffect(() => {
      writeChecked(checked);
    }, [checked]);

    const role = useMemo(() => ROLES.find((r) => r.id === selected) ?? ROLES[0], [selected]);

    const total = role.steps.length;
    const done = role.steps.filter((s) => checked[stepKey(role.id, s.id)]).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const toggle = (stepId: string) =>
      setChecked((prev) => ({
        ...prev,
        [stepKey(role.id, stepId)]: !prev[stepKey(role.id, stepId)],
      }));

    const reset = () => {
      setChecked((prev) => {
        const next: CheckedMap = { ...prev };
        for (const s of role.steps) delete next[stepKey(role.id, s.id)];
        return next;
      });
    };

    return (
      <div className="panel">
        <h2 className="section-header">Quickstart Wizard</h2>
        <p className="subtitle">
          Pick your role to get a tailored, step-by-step path through the console.
          Progress is saved in this browser.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--s3)',
            marginBottom: 'var(--s4)',
          }}
        >
          {ROLES.map((r) => {
            const active = r.id === selected;
            const rDone = r.steps.filter((s) => checked[stepKey(r.id, s.id)]).length;
            return (
              <button
                key={r.id}
                type="button"
                className={`card${active ? ' hl' : ''}`}
                style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
                aria-pressed={active}
                onClick={() => setSelected(r.id)}
              >
                <div className="row items-center" style={{ justifyContent: 'space-between' }}>
                  <strong>{r.title}</strong>
                  <span className="pill" style={{ fontSize: 12 }}>{rDone}/{r.steps.length}</span>
                </div>
                <p className="caption" style={{ margin: 'var(--s2) 0 0' }}>{r.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="card" style={{ marginBottom: 'var(--s4)' }}>
          <div className="row items-center" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="mono">{role.title} quickstart</div>
              <p className="caption" style={{ margin: 0 }}>
                {done} of {total} steps complete ({pct}%)
              </p>
            </div>
            <button type="button" className="btn secondary sm" onClick={reset}>
              Reset role
            </button>
          </div>
          <div
            className="progress"
            style={{ marginTop: 'var(--s3)' }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="stack stack-md">
          {role.steps.map((step, idx) => {
            const key = stepKey(role.id, step.id);
            const isDone = !!checked[key];
            const liveRoute = step.route ? findFeature(step.route) : undefined;
            return (
              <div key={step.id} className={`card${isDone ? ' hl' : ''}`}>
                <div className="row items-center wrap" style={{ gap: 'var(--s2)' }}>
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggle(step.id)}
                    style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                    aria-label={`Mark "${step.title}" done`}
                  />
                  <strong style={{ marginRight: 'auto' }}>
                    {idx + 1}. {step.title}
                  </strong>
                  {liveRoute && (
                    <a className="btn primary sm" href={liveRoute.path}>
                      Open →
                    </a>
                  )}
                </div>
                <p className="muted" style={{ margin: 'var(--s2) 0 0' }}>{step.detail}</p>
              </div>
            );
          })}
        </div>

        <p className="caption muted" style={{ marginTop: 'var(--s4)' }}>
          {FEATURES.length} features are live in this build. This wizard is mock-first;
          wire it to a live ROADMAP/progress API later if desired.
        </p>
      </div>
    );
  },
};
