// Demo Data Seeder — closes Batch E #48 (Local demo data seeder for offline tours).
// Self-contained: writes curated sample content into the SAME localStorage stores the
// app's offline-first panels already use (Reading List, Onboarding Checklist, Feature
// Flags), so a new operator can populate a realistic tour/demo state with no backend.
// Auto-registers through the features glob (registry.ts) — NO edits to App.tsx / server.ts.
// Uses the automatic JSX runtime, so React is not imported.
import { useEffect, useState } from 'react';

// --- Real store keys + shapes, mirrored from sibling features (verified in source) ---
const READING_LIST_KEY = 'forgeos.readinglist.v1';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  note: string;
  tags: string[];
  createdAt: string;
}

const ONBOARDING_KEY = 'forgeos-onboarding-checklist';
const ONBOARDING_TASKS = [
  'p0-t0', 'p0-t1', 'p0-t2', 'p0-t3', 'p0-t4',
  'p1-t0', 'p1-t1', 'p1-t2', 'p1-t3', 'p1-t4',
  'p2-t0', 'p2-t1', 'p2-t2',
  'p3-t0', 'p3-t1', 'p3-t2',
  'p4-t0', 'p4-t1', 'p4-t2',
  'p5-t0', 'p5-t1', 'p5-t2',
];

const FEATURE_FLAGS_KEY = 'forgeos-feature-flags';
const DEMO_FLAGS: Record<string, boolean> = {
  'sse-live-sync': true,
  'agent-memory-cache': true,
  'dead-letter-queue': true,
  'rate-limit-telemetry': true,
  'graphql-guard': true,
  'mission-scheduler': true,
};

const DEMO_BOOKMARKS: Bookmark[] = [
  { id: 'demo_bm_1', url: '/feature/self-improve', title: 'Self-Improvement Loop', note: 'Telemetry-driven learning loop + agent controls.', tags: ['core', 'self-improve'], createdAt: new Date().toISOString() },
  { id: 'demo_bm_2', url: '/feature/onboarding-checklist', title: 'Onboarding Checklist', note: 'ROADMAP-phase bootstrap tracker.', tags: ['onboarding'], createdAt: new Date().toISOString() },
  { id: 'demo_bm_3', url: '/feature/saved-views', title: 'Saved Views', note: 'Named filter presets for vault/missions/audit/ledger.', tags: ['data', 'ux'], createdAt: new Date().toISOString() },
  { id: 'demo_bm_4', url: '/feature/missionsched-exec', title: 'Mission Scheduler', note: 'Autonomous mission dispatch executor.', tags: ['agents'], createdAt: new Date().toISOString() },
  { id: 'demo_bm_5', url: '/feature/reading-list', title: 'Reading List', note: 'Semantic bookmarking capture (Batch D #34).', tags: ['knowledge'], createdAt: new Date().toISOString() },
  { id: 'demo_bm_6', url: 'https://hermes-agent.nousresearch.com/docs', title: 'Hermes Agent Docs', note: 'Operator reference for the agent gateway.', tags: ['reference'], createdAt: new Date().toISOString() },
];

function safeGet(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function asRecord(v: unknown): Record<string, boolean> {
  if (v && typeof v === 'object') return v as Record<string, boolean>;
  return {};
}

function readingListCount(): number {
  const v = safeGet(READING_LIST_KEY);
  return Array.isArray(v) ? v.length : 0;
}

function onboardingDone(): number {
  const m = asRecord(safeGet(ONBOARDING_KEY));
  return ONBOARDING_TASKS.filter((t) => m[t]).length;
}

function flagsSet(): number {
  const m = asRecord(safeGet(FEATURE_FLAGS_KEY));
  return Object.keys(DEMO_FLAGS).filter((k) => m[k]).length;
}

export default {
  path: '/feature/demo-data-seeder',
  label: 'Demo Data Seeder',
  category: 'Onboarding',
  component: function DemoDataSeeder() {
    const [counts, setCounts] = useState({ reading: 0, onboarding: 0, flags: 0 });
    const [status, setStatus] = useState<string | null>(null);

    function refresh(): void {
      setCounts({
        reading: readingListCount(),
        onboarding: onboardingDone(),
        flags: flagsSet(),
      });
    }

    useEffect(() => {
      refresh();
    }, []);

    function seed(): void {
      const existing = safeGet(READING_LIST_KEY);
      const list: Bookmark[] = Array.isArray(existing) ? (existing as Bookmark[]) : [];
      const merged: Bookmark[] = [
        ...DEMO_BOOKMARKS,
        ...list.filter((b) => !DEMO_BOOKMARKS.some((d) => d.url === b.url)),
      ];
      safeSet(READING_LIST_KEY, merged);

      const ob: Record<string, boolean> = {};
      for (const t of ONBOARDING_TASKS) ob[t] = true;
      safeSet(ONBOARDING_KEY, ob);

      safeSet(FEATURE_FLAGS_KEY, { ...DEMO_FLAGS });

      setStatus('Seeded demo data into Reading List, Onboarding Checklist, and Feature Flags.');
      refresh();
    }

    function clear(): void {
      safeSet(READING_LIST_KEY, []);
      safeSet(ONBOARDING_KEY, {});
      safeSet(FEATURE_FLAGS_KEY, {});
      setStatus('Cleared demo data from all seeded stores.');
      refresh();
    }

    return (
      <div className="card">
        <div className="section-header">
          <h2>Demo Data Seeder</h2>
          <span className="subtitle">Batch E #48 · offline tours</span>
        </div>

        <p className="muted mt-2">
          Populate the offline-first stores (Reading List, Onboarding Checklist, Feature
          Flags) with curated ForgeOS sample data so you can run a realistic demo or guided
          tour without a backend. All data lives in your browser&rsquo;s localStorage.
        </p>

        <div className="bento-grid mt-3">
          <div className="card">
            <span className="stat-value">{counts.reading}</span>
            <span className="stat-label">Reading List items</span>
          </div>
          <div className="card">
            <span className="stat-value">
              {counts.onboarding}/{ONBOARDING_TASKS.length}
            </span>
            <span className="stat-label">Onboarding tasks done</span>
          </div>
          <div className="card">
            <span className="stat-value">
              {counts.flags}/{Object.keys(DEMO_FLAGS).length}
            </span>
            <span className="stat-label">Feature flags on</span>
          </div>
        </div>

        <div className="row gap-2 mt-3 wrap items-center">
          <button className="btn primary" onClick={seed}>
            Seed demo data
          </button>
          <button className="btn secondary" onClick={clear}>
            Clear demo data
          </button>
          <button className="btn secondary" onClick={refresh}>
            Refresh counts
          </button>
        </div>

        {status && (
          <p className="muted mt-2" role="status">
            {status}
          </p>
        )}
      </div>
    );
  },
};
