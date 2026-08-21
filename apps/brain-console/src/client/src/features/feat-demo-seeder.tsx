// Demo Data Seeder — closes next-50 #48 (Local demo data seeder for offline tours).
// Conflict-free: auto-registers through the features glob, so it needs NO edits to
// App.tsx / server.ts and cannot collide with parallel waves.
//
// Seeds realistic sample data into the localStorage-backed console features so that
// offline tours and screenshots show real-looking content without any backend. Targets:
//   - Reading List        (forgeos.readinglist.v1)            -> Bookmark[]
//   - Onboarding Checklist (forgeos-onboarding-checklist)     -> Record<taskId, boolean>
//   - Quickstart Wizard    (forgeos-quickstart)               -> Record<`${role}:${step}`, boolean>
//   - Feature Flags        (forgeos-feature-flags)            -> Record<flagKey, boolean>
//
// Saved Views is intentionally excluded: it is server-backed (POST /api/savedviews), so
// it cannot be seeded offline. Mock-first; uses the automatic JSX runtime (no React import).
import { useEffect, useState } from 'react';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  note: string;
  tags: string[];
  createdAt: string;
}

const RL_KEY = 'forgeos.readinglist.v1';
const CHECKLIST_KEY = 'forgeos-onboarding-checklist';
const QUICKSTART_KEY = 'forgeos-quickstart';
const FLAGS_KEY = 'forgeos-feature-flags';

const SAMPLE_BOOKMARKS: Omit<Bookmark, 'id' | 'createdAt'>[] = [
  {
    url: 'https://github.com/Github-poppypop/ForgeOS/blob/master/docs/ARCHITECTURE.md',
    title: 'ForgeOS Architecture Overview',
    note: 'Mermaid system diagram + component boundaries.',
    tags: ['rfc', 'architecture'],
  },
  {
    url: '/feature/csp-enforce',
    title: 'Security Headers (CSP/HSTS) Enforcement',
    note: 'Verify CSP moved from report-only to enforced.',
    tags: ['security', 'demo'],
  },
  {
    url: 'https://react.dev/learn',
    title: 'React — Thinking in Components',
    note: 'Reference for panel composition patterns.',
    tags: ['react', 'reference'],
  },
  {
    url: '/feature/sse',
    title: 'Live Brain Sync (SSE) walkthrough',
    note: 'EventSource stream contract and reconnection.',
    tags: ['realtime', 'demo'],
  },
  {
    url: 'https://expressjs.com/en/guide/routing.html',
    title: 'Express routing guide',
    note: 'Clean-path SPA fallback notes for the dev server.',
    tags: ['express', 'reference'],
  },
];

const CHECKLIST_IDS: string[] = [
  'p0-t0', 'p0-t1', 'p0-t2', 'p0-t3', 'p0-t4',
  'p1-t0', 'p1-t1', 'p1-t2', 'p1-t3', 'p1-t4',
  'p2-t0', 'p2-t1', 'p2-t2',
  'p3-t0', 'p3-t1', 'p3-t2',
  'p4-t0', 'p4-t1', 'p4-t2',
  'p5-t0', 'p5-t1', 'p5-t2',
];

const QUICKSTART_KEYS: string[] = [
  'csuite:vision', 'csuite:checklist', 'csuite:agents', 'csuite:missions', 'csuite:notes',
  'engineering:registry', 'engineering:palette', 'engineering:ratelimit', 'engineering:csp', 'engineering:sse',
  'admin:csp', 'admin:alerts', 'admin:webhooks', 'admin:audit', 'admin:otel',
  'product:roadmap', 'product:marketplace', 'product:kanban', 'product:reading', 'product:changelog',
];

const FLAG_KEYS: string[] = [
  'sse-live-sync',
  'agent-memory-cache',
  'dead-letter-queue',
  'rate-limit-telemetry',
  'graphql-guard',
  'mission-scheduler',
];

function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function summarize(key: string): { kind: string; count: number } {
  const raw = safeGet(key);
  if (!raw) return { kind: 'empty', count: 0 };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { kind: 'items', count: parsed.length };
    if (parsed && typeof parsed === 'object') {
      return { kind: 'records', count: Object.values(parsed as Record<string, unknown>).filter(Boolean).length };
    }
  } catch {
    /* ignore */
  }
  return { kind: 'raw', count: 0 };
}

function seedAll(): void {
  const now = Date.now();
  const bookmarks: Bookmark[] = SAMPLE_BOOKMARKS.map((b, i) => ({
    ...b,
    id: 'bm_demo_' + (i + 1).toString(36),
    createdAt: new Date(now - i * 86_400_000).toISOString(),
  }));
  safeSet(RL_KEY, JSON.stringify(bookmarks));

  const checklist: Record<string, boolean> = {};
  CHECKLIST_IDS.forEach((id) => {
    checklist[id] = true;
  });
  safeSet(CHECKLIST_KEY, JSON.stringify(checklist));

  const qs: Record<string, boolean> = {};
  QUICKSTART_KEYS.forEach((k) => {
    qs[k] = true;
  });
  safeSet(QUICKSTART_KEY, JSON.stringify(qs));

  const flags: Record<string, boolean> = {};
  FLAG_KEYS.forEach((k) => {
    flags[k] = true;
  });
  safeSet(FLAGS_KEY, JSON.stringify(flags));
}

function clearAll(): void {
  safeRemove(RL_KEY);
  safeRemove(CHECKLIST_KEY);
  safeRemove(QUICKSTART_KEY);
  safeRemove(FLAGS_KEY);
}

interface TargetRow {
  name: string;
  key: string;
  kind: string;
  count: number;
}

const TARGETS: { name: string; key: string }[] = [
  { name: 'Reading List', key: RL_KEY },
  { name: 'Onboarding Checklist', key: CHECKLIST_KEY },
  { name: 'Quickstart Wizard', key: QUICKSTART_KEY },
  { name: 'Feature Flags', key: FLAGS_KEY },
];

export default {
  path: '/feature/demo-seeder',
  label: 'Demo Data Seeder',
  category: 'Onboarding',
  component: function DemoSeeder() {
    const [status, setStatus] = useState<string>('');
    const [rows, setRows] = useState<TargetRow[]>([]);

    const refresh = (): void => {
      setRows(
        TARGETS.map((t) => ({
          name: t.name,
          key: t.key,
          ...summarize(t.key),
        }))
      );
    };

    useEffect(() => {
      refresh();
    }, []);

    const onSeed = (): void => {
      seedAll();
      refresh();
      setStatus('Seeded sample data into 4 features. Open a target panel — or refresh it if already open — to see the data.');
    };

    const onClear = (): void => {
      clearAll();
      refresh();
      setStatus('Cleared demo data from all 4 features.');
    };

    return (
      <div className="card">
        <div className="section-header">
          <h2>Demo Data Seeder</h2>
          <span className="subtitle">next-50 #48 · offline tours</span>
        </div>

        <p className="muted mt-2">
          One click populates realistic sample data into the browser-local (localStorage)
          console features so offline demos, screenshots, and onboarding tours show
          real-looking content — no backend required. Saved Views is excluded because it
          is server-backed.
        </p>

        <div className="row gap-2 mt-3 wrap items-center">
          <button className="btn" onClick={onSeed}>
            Seed demo data
          </button>
          <button className="btn secondary" onClick={onClear}>
            Clear demo data
          </button>
        </div>

        {status && (
          <p className="muted mt-2" role="status">
            {status}
          </p>
        )}

        <div className="table-wrap mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Storage key</th>
                <th>Seeded state</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.name}</td>
                  <td className="mono muted">{r.key}</td>
                  <td>
                    <span className={r.count > 0 ? 'pill ok' : 'pill'}>
                      {r.count > 0 ? 'seeded' : 'empty'}
                    </span>
                  </td>
                  <td className="muted">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="muted mt-3">
          Seeds {SAMPLE_BOOKMARKS.length} reading-list bookmarks, {CHECKLIST_IDS.length} onboarding
          tasks, {QUICKSTART_KEYS.length} quickstart steps across 4 roles, and{' '}
          {FLAG_KEYS.length} feature flags.
        </p>
      </div>
    );
  },
};
