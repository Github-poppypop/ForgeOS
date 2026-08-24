// Agent Cost & Token Accounting feature — closes Batch C #27 (per-role cost/token
// accounting). Auto-appears in the sidebar under "Observability" with NO edits to
// App.tsx or server.ts. Mock-first: prefers a live /api/agent-cost endpoint if the
// runtime accumulator is deployed, otherwise falls back to a demo dataset shaped like
// the per-role telemetry the agent runtime will emit once token/cost tracking is
// wired into runtime.ts (backend follow-up).
import { useEffect, useState } from 'react';

interface RoleAccounting {
  role: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  errors: number;
}

// Demo dataset — mirrors the shape the agent runtime will emit once the per-role
// token/cost accumulator is wired into runtime.ts.
const DEMO: RoleAccounting[] = [
  { role: 'planner', requests: 1284, inputTokens: 4_210_000, outputTokens: 1_120_000, costUsd: 18.42, avgLatencyMs: 1320, errors: 7 },
  { role: 'researcher', requests: 942, inputTokens: 9_880_000, outputTokens: 2_040_000, costUsd: 41.07, avgLatencyMs: 2410, errors: 12 },
  { role: 'coder', requests: 1760, inputTokens: 6_540_000, outputTokens: 3_310_000, costUsd: 33.55, avgLatencyMs: 1840, errors: 19 },
  { role: 'reviewer', requests: 610, inputTokens: 2_010_000, outputTokens: 540_000, costUsd: 8.93, avgLatencyMs: 980, errors: 3 },
  { role: 'summarizer', requests: 2210, inputTokens: 3_300_000, outputTokens: 880_000, costUsd: 9.71, avgLatencyMs: 610, errors: 2 },
];

type SortKey = 'costUsd' | 'requests' | 'inputTokens' | 'outputTokens' | 'avgLatencyMs' | 'errors';

function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}
function fmtUsd(n: number): string {
  return '$' + n.toFixed(2);
}
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export default {
  path: '/feature/agent-cost',
  label: 'Agent Cost Accounting',
  category: 'Observability',
  component: function AgentCostPanel() {
    const [rows, setRows] = useState<RoleAccounting[]>([]);
    const [loading, setLoading] = useState(true);
    const [demo, setDemo] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('costUsd');

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      fetch('/api/agent-cost')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no endpoint'))))
        .then((d) => {
          if (!cancelled && Array.isArray(d?.roles)) setRows(d.roles as RoleAccounting[]);
          else if (!cancelled) {
            setDemo(true);
            setRows(DEMO);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDemo(true);
            setRows(DEMO);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    function sortBy(key: SortKey): void {
      setSortKey(key);
    }

    const sorted = [...rows].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    const maxCost = Math.max(1, ...rows.map((r) => r.costUsd));
    const totalCost = rows.reduce((s, r) => s + r.costUsd, 0);
    const totalTokens = rows.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
    const totalRequests = rows.reduce((s, r) => s + r.requests, 0);
    const totalErrors = rows.reduce((s, r) => s + r.errors, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return (
      <div className="card">
        <div className="section-header">
          <h2>Agent Cost &amp; Token Accounting</h2>
          <span className="subtitle">per-role spend · Batch C #27</span>
        </div>
        {demo && (
          <p className="muted mt-2">
            Showing demo telemetry — live per-role cost accumulator not yet deployed
            (wire <code>/api/agent-cost</code> from the agent runtime to replace this).
          </p>
        )}

        <div className="row wrap gap-2 mt-3">
          <div className="card" style={{ flex: '1 1 160px', padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Total spend</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtUsd(totalCost)}</div>
          </div>
          <div className="card" style={{ flex: '1 1 160px', padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Total tokens</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtTokens(totalTokens)}</div>
          </div>
          <div className="card" style={{ flex: '1 1 160px', padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Total requests</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtInt(totalRequests)}</div>
          </div>
          <div className="card" style={{ flex: '1 1 160px', padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Error rate</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{errorRate.toFixed(2)}%</div>
          </div>
        </div>

        {loading && <p className="muted mt-3">Loading agent accounting…</p>}

        {!loading && (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => sortBy('requests')}>Requests</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => sortBy('inputTokens')}>In tokens</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => sortBy('outputTokens')}>Out tokens</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => sortBy('avgLatencyMs')}>Avg latency</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => sortBy('errors')}>Errors</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => sortBy('costUsd')}>Cost</th>
                  <th>Cost share</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.role}>
                    <td><span className="pill">{r.role}</span></td>
                    <td className="mono">{fmtInt(r.requests)}</td>
                    <td className="mono">{fmtTokens(r.inputTokens)}</td>
                    <td className="mono">{fmtTokens(r.outputTokens)}</td>
                    <td className="mono">{(r.avgLatencyMs / 1000).toFixed(1)}s</td>
                    <td className="mono">{fmtInt(r.errors)}</td>
                    <td className="mono">{fmtUsd(r.costUsd)}</td>
                    <td style={{ minWidth: 160 }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 6,
                          background: 'var(--surface-2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: (r.costUsd / maxCost) * 100 + '%',
                            background: 'var(--accent)',
                            borderRadius: 6,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={8} className="muted">No role accounting available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  },
};
