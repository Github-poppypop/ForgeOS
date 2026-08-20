// Feature Flags for staged rollout — closes Batch E #49.
// Self-contained: flags live in localStorage, no backend required. Auto-registers
// through the features glob — no edits to App.tsx or server.ts.
// Note: this project uses the automatic JSX runtime, so React is not imported.
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'forgeos-feature-flags';

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  defaultOn: boolean;
}

const FLAGS: FeatureFlag[] = [
  { key: 'sse-live-sync', label: 'Live SSE brain sync', description: 'Stream brain events over SSE instead of polling.', defaultOn: false },
  { key: 'agent-memory-cache', label: 'Agent memory cache', description: 'Persist agent memory with TTL eviction.', defaultOn: true },
  { key: 'dead-letter-queue', label: 'Dead-letter queue', description: 'Capture failed agent tasks for later replay.', defaultOn: true },
  { key: 'rate-limit-telemetry', label: 'Rate-limit telemetry', description: 'Emit rate-limit hit metrics to the telemetry sink.', defaultOn: false },
  { key: 'graphql-guard', label: 'GraphQL guard', description: 'Enforce depth/complexity limits on the GraphQL endpoint.', defaultOn: true },
  { key: 'mission-scheduler', label: 'Mission scheduler', description: 'Enable cron-like autonomous mission dispatch.', defaultOn: false },
];

function readFlags(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeFlags(flags: Record<string, boolean>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

export function useFeatureFlag(key: string, defaultOn: boolean): boolean {
  const [enabled] = useState<boolean>(() => readFlags()[key] ?? defaultOn);
  useEffect(() => {
    const flags = readFlags();
    flags[key] = enabled;
    writeFlags(flags);
  }, [key, enabled]);
  return enabled;
}

export default {
  path: '/feature/feature-flags',
  label: 'Feature Flags',
  category: 'Platform',
  component: function FeatureFlagsPanel() {
    const [flags, setFlags] = useState<Record<string, boolean>>(() => {
      const stored = readFlags();
      const init: Record<string, boolean> = {};
      for (const f of FLAGS) init[f.key] = stored[f.key] ?? f.defaultOn;
      return init;
    });

    const toggle = (key: string) => {
      setFlags((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        writeFlags(next);
        return next;
      });
    };

    const reset = () => {
      const init: Record<string, boolean> = {};
      for (const f of FLAGS) init[f.key] = f.defaultOn;
      setFlags(init);
      writeFlags(init);
    };

    const onCount = Object.values(flags).filter(Boolean).length;

    return (
      <div className="panel">
        <h2 className="section-header">Feature Flags</h2>
        <p className="subtitle">
          Staged-rollout toggles stored in your browser (localStorage). {onCount} of {FLAGS.length} enabled.
        </p>
        <div className="wrap items-center" style={{ marginBottom: 'var(--s3)' }}>
          <button type="button" className="btn secondary sm" onClick={reset}>Reset to defaults</button>
        </div>
        <div className="stack stack-md">
          {FLAGS.map((f) => (
            <div key={f.key} className="card">
              <div className="row items-center" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="mono">{f.label}</div>
                  <p className="caption" style={{ margin: 0 }}>{f.description}</p>
                </div>
                <button
                  type="button"
                  className={`btn sm ${flags[f.key] ? 'primary' : 'secondary'}`}
                  aria-pressed={flags[f.key]}
                  onClick={() => toggle(f.key)}
                >
                  {flags[f.key] ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};
