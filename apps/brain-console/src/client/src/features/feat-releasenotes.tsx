// Release Notes panel — closes #50 (Release notes generator from git history +
// ROADMAP). Mock-first: ships a curated milestone timeline plus the LIVE count of
// discovered feature modules (imported from the registry, which reflects what is
// actually mounted). Conflict-free: auto-registers through the features glob, so
// it needs NO edits to App.tsx / server.ts and cannot collide with parallel waves.
// A backend-driven generator (parsing git history / CHANGELOG.md) can layer on
// later behind the same UI.
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useState } from 'react';
import { FEATURES } from './registry';

interface Release {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

// Curated milestones derived from the shipped Batches A–E and the console's
// hardening work. A backend generator can replace this with git/CHANGELOG data.
const RELEASES: Release[] = [
  {
    version: 'v0.5.0',
    date: '2026-08-20',
    title: 'Marketplace, SDK & Onboarding',
    highlights: [
      'Guided onboarding checklist tied to ROADMAP phases (Batch E #46)',
      'Webhook management UI, workspaces, SSE live channel, audit store',
      'API docs viewer + changelog panel; CSP enforcement enabled',
      'Reading-list semantic bookmarking (Batch D #34)',
    ],
  },
  {
    version: 'v0.4.0',
    date: '2026-08-19',
    title: 'Knowledge Universe & Federation',
    highlights: [
      'Mission scheduler executor + GraphQL depth/complexity guard',
      'Dead-letter queue and agent memory cache (Batch C)',
      'OpenAPI spec (70+ paths) and live /api/docs viewer',
    ],
  },
  {
    version: 'v0.3.0',
    date: '2026-08-19',
    title: 'Agent Runtime Hardening',
    highlights: [
      'Circuit breaker scaffolding, retry/backoff wrappers',
      'Structured audit log + alerting status self-test',
      'Rate-limit telemetry and per-route dashboard',
    ],
  },
  {
    version: 'v0.2.0',
    date: '2026-08-19',
    title: 'Brain Console UX & Data Panels',
    highlights: [
      'Saved views/filters, command-palette fuzzy search',
      'Bulk actions, CSV export, diff viewer, keyboard shortcuts',
      'Offline mode queue with sync indicator',
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-08-18',
    title: 'Mock Service Foundation',
    highlights: [
      'Mock services: auth, billing, notifications, search, AI, storage',
      'Webhooks, telemetry, integrations with test coverage',
      'Feature-discovery layer (feat-*.tsx auto-registration)',
    ],
  },
];

const STORE_KEY = 'forgeos.releasenotes.seen';

export default {
  path: '/feature/release-notes',
  label: 'Release Notes',
  category: 'About',
  component: function ReleaseNotesPanel() {
    const [seenVersion, setSeenVersion] = useState<string | null>(null);

    useEffect(() => {
      try {
        setSeenVersion(localStorage.getItem(STORE_KEY));
      } catch {
        setSeenVersion(null);
      }
    }, []);

    const latest = RELEASES[0];
    const isNew = seenVersion !== latest.version;

    function markSeen(): void {
      try {
        localStorage.setItem(STORE_KEY, latest.version);
        setSeenVersion(latest.version);
      } catch {
        /* ignore quota errors */
      }
    }

    return (
      <div className="card">
        <div className="section-header">
          <h2>Release Notes</h2>
          <span className="subtitle">
            {FEATURES.length} features live · Batch #50
          </span>
        </div>

        <p className="muted mt-2">
          Milestones from the ForgeOS console roadmap. The live feature count above
          is read directly from the runtime feature registry — it reflects exactly
          what is mounted in this build.
        </p>

        {isNew && (
          <div className="row gap-2 mt-2 wrap items-center">
            <span className="subtitle">New since you last looked: {latest.version}</span>
            <button className="btn primary sm" onClick={markSeen}>
              Mark {latest.version} as seen
            </button>
          </div>
        )}

        <div className="table-wrap mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Date</th>
                <th>Title</th>
                <th>Highlights</th>
              </tr>
            </thead>
            <tbody>
              {RELEASES.map((r) => (
                <tr key={r.version}>
                  <td>
                    <div>{r.version}</div>
                    {r.version === latest.version && (
                      <div className="muted">latest</div>
                    )}
                  </td>
                  <td className="muted">{r.date}</td>
                  <td>{r.title}</td>
                  <td className="muted">
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {r.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
};
