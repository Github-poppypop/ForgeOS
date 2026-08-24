// Client feature: Agent A/B (canary) Routing control panel — closes backlog #28.
// Conflict-free: auto-discovered by features/registry.ts (import.meta.glob); no
// edits to App.tsx or server.ts. Mirrors the canonical, tested implementation in
// `agents/ab-router.ts` (server/runtime) so operators can visualize and reason
// about deterministic canary bucketing without touching production traffic.
// The runtime dispatch wiring (applying selectVariant inside the agent spawn
// path) is the backend follow-up — this panel is mock-first and computes locally.
// Note: automatic JSX runtime — do NOT import React; import hooks directly.
import { useState } from 'react';

type Variant = 'A' | 'B';

interface Decision {
  key: string;
  variant: Variant;
  bucket: number;
  at: number;
}

const TARGETS = ['planner', 'researcher', 'coder', 'reviewer', 'summarizer'];

/** FNV-1a 32-bit hash (mirrors agents/ab-router.ts). */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function bucketOf(key: string, salt: string): number {
  const mixed = salt ? `${salt}::${key}` : key;
  return fnv1a(mixed) % 100;
}

function selectVariant(key: string, percent: number, salt: string): Variant {
  return bucketOf(key, salt) < percent ? 'B' : 'A';
}

export default {
  path: '/feature/ab-routing',
  label: 'Agent A/B Canary Routing',
  category: 'Observability',
  component: function AgentCanaryRoutingFeature() {
    const [percent, setPercent] = useState(10);
    const [salt, setSalt] = useState('');
    const [target, setTarget] = useState('planner');
    const [requestKey, setRequestKey] = useState('');
    const [lastDecision, setLastDecision] = useState<Decision | null>(null);
    const [log, setLog] = useState<Decision[]>([]);
    const [sampleSize, setSampleSize] = useState(200);

    function decide(key: string): Decision {
      const bucket = bucketOf(key, salt);
      const variant: Variant = bucket < percent ? 'B' : 'A';
      const d: Decision = { key, variant, bucket, at: Date.now() };
      setLastDecision(d);
      setLog((prev) => [d, ...prev].slice(0, 12));
      return d;
    }

    function routeRequest(): void {
      const k = requestKey.trim() || `req-${Math.random().toString(36).slice(2, 8)}`;
      decide(k);
    }

    // Live distribution preview over a synthetic sample (no production traffic).
    let bCount = 0;
    for (let i = 0; i < sampleSize; i++) {
      if (selectVariant(`sample-${i}`, percent, salt) === 'B') bCount++;
    }
    const aCount = sampleSize - bCount;
    const bShare = sampleSize > 0 ? (bCount / sampleSize) * 100 : 0;

    return (
      <div className="panel">
        <h2 className="section-header">Agent A/B Canary Routing</h2>
        <p className="subtitle">
          Deterministic canary bucketing for agent prompts · Batch C #28
        </p>
        <p className="muted mt-2">
          Route a configurable % of traffic to the canary variant <span className="pill">B</span>{' '}
          while the stable variant <span className="pill">A</span> serves the rest. Bucketing is
          stable per request key (same key → same variant), so canaries are reproducible. Canonical
          implementation lives in <code>agents/ab-router.ts</code>; runtime dispatch wiring is the
          backend follow-up.
        </p>

        <div className="card mt-3">
          <div className="section-header">
            <h3>Configuration — target: {target}</h3>
          </div>
          <div className="stack gap-2 mt-2">
            <div className="field">
              <label htmlFor="ab-percent">Canary percentage (0–100)</label>
              <div className="row gap-2 wrap items-center">
                <input
                  id="ab-percent"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  style={{ maxWidth: 90 }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  style={{ flex: '1 1 200px' }}
                />
                <span className="mono">{percent}%</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="ab-salt">Salt (reshuffles bucketing per deployment)</label>
              <input
                id="ab-salt"
                className="input"
                placeholder="optional — e.g. prod-us-east"
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ab-target">Agent / prompt group</label>
              <select
                id="ab-target"
                className="input"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ab-key">Request key (prompt / user / mission id)</label>
              <div className="row gap-2 wrap items-center">
                <input
                  id="ab-key"
                  className="input"
                  placeholder="leave blank to auto-generate"
                  value={requestKey}
                  onChange={(e) => setRequestKey(e.target.value)}
                  style={{ flex: '1 1 200px' }}
                />
                <button className="btn primary" onClick={routeRequest}>
                  Route request
                </button>
                <button
                  className="btn secondary"
                  onClick={() => decide(`sample-${Math.floor(Math.random() * sampleSize)}`)}
                >
                  Sample random
                </button>
              </div>
            </div>
          </div>

          {lastDecision && (
            <div className="card mt-3" style={{ background: 'var(--surface-2)' }}>
              <div className="section-header">
                <h3>Last decision</h3>
                <span className="subtitle">
                  bucket {lastDecision.bucket} · {lastDecision.variant === 'B' ? 'canary' : 'stable'}
                </span>
              </div>
              <p className="mono mt-2">
                {lastDecision.key} → <strong>{lastDecision.variant}</strong>
              </p>
            </div>
          )}
        </div>

        <div className="card mt-3">
          <div className="section-header">
            <h3>Live split preview</h3>
            <span className="subtitle">over {sampleSize} synthetic keys</span>
          </div>
          <div className="row gap-2 mt-2 wrap items-center">
            <div className="field" style={{ flex: '1 1 120px' }}>
              <label htmlFor="ab-sample">Sample size</label>
              <input
                id="ab-sample"
                className="input"
                type="number"
                min={10}
                max={5000}
                value={sampleSize}
                onChange={(e) => setSampleSize(Math.max(10, Number(e.target.value) || 10))}
              />
            </div>
          </div>
          <div className="stack gap-2 mt-3">
            <div>
              <div className="row gap-2 items-center" style={{ fontSize: 12 }}>
                <span className="pill">A · stable</span>
                <span className="mono">{(100 - bShare).toFixed(1)}% · {aCount}</span>
              </div>
              <div style={{ height: 10, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 4 }}>
                <div style={{ height: '100%', width: `${100 - bShare}%`, background: 'var(--accent)' }} />
              </div>
            </div>
            <div>
              <div className="row gap-2 items-center" style={{ fontSize: 12 }}>
                <span className="pill">B · canary</span>
                <span className="mono">{bShare.toFixed(1)}% · {bCount}</span>
              </div>
              <div style={{ height: 10, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 4 }}>
                <div style={{ height: '100%', width: `${bShare}%`, background: 'var(--warn, #f2b13a)' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="card mt-3">
          <div className="section-header">
            <h3>Recent decisions</h3>
            <span className="subtitle">{log.length} logged</span>
          </div>
          <div className="table-wrap mt-2">
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Variant</th>
                  <th>Bucket</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {log.map((d, i) => (
                  <tr key={`${d.key}-${i}`}>
                    <td><code>{d.key}</code></td>
                    <td>
                      <span className={d.variant === 'B' ? 'pill' : 'pill'}>{d.variant}</span>
                    </td>
                    <td className="mono">{d.bucket}</td>
                    <td className="muted">{new Date(d.at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {log.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">No decisions yet — route a request above.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  },
};
