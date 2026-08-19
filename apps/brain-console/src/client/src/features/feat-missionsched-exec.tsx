// Mission Scheduler Executions feature — conflict-free. Auto-appears in the
// sidebar / command palette with NO edits to App.tsx or server.ts. Shows the
// configured scheduled jobs (with last-run / next-run) and a live table of
// recent execution attempts pulled from the server executor. Uses the automatic
// JSX runtime, so React is not imported; hooks are imported directly.
import { useEffect, useState } from 'react';

interface Schedule {
  id: string;
  name: string;
  intervalSec: number;
  target: string;
  method?: 'GET' | 'POST' | 'PUT';
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  failures?: number;
}

interface Execution {
  ts: string;
  scheduleId: string;
  name?: string;
  status: 'ok' | 'error';
  statusCode?: number;
  error?: string;
}

function fmt(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function dueLabel(sched: Schedule): string {
  if (!sched.enabled) return 'paused';
  if (!sched.nextRun) return 'due';
  const next = new Date(sched.nextRun).getTime();
  const diff = next - Date.now();
  if (diff <= 0) return 'due now';
  const s = Math.round(diff / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `in ${m}m`;
  return `in ${Math.round(m / 60)}h`;
}

export default {
  path: '/feature/mission-scheduler-exec',
  label: 'Scheduler Executions',
  category: 'Features',
  component: function MissionSchedulerExecFeature() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;

      const load = () => {
        Promise.all([
          fetch('/api/missions/schedule').then((r) =>
            r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)),
          ),
          fetch('/api/missions/schedule/executions').then((r) =>
            r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)),
          ),
        ])
          .then(([s, e]) => {
            if (cancelled) return;
            const sd = s as { schedules?: Schedule[] };
            const ed = e as { executions?: Execution[] };
            setSchedules(sd.schedules ?? []);
            setExecutions(ed.executions ?? []);
            setError(null);
            setLoading(false);
          })
          .catch((err: Error) => {
            if (cancelled) return;
            setError(err.message);
            setLoading(false);
          });
      };

      load();
      const id = setInterval(load, 5000);
      const maybeUnref = id as unknown as { unref?: () => void };
      if (typeof maybeUnref.unref === 'function') maybeUnref.unref();

      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, []);

    return (
      <div className="panel">
        <h2 className="section-header">Scheduler Executions</h2>
        <p className="subtitle">
          Scheduled jobs are fired by the server executor every 30s. Below are the configured jobs
          and a live log of recent delivery attempts.
        </p>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', gap: '10px' }}>
            <h3 className="section-header" style={{ margin: 0 }}>
              Scheduled Jobs
            </h3>
            <span className="tag">{schedules.length} job{schedules.length === 1 ? '' : 's'}</span>
          </div>

          {loading ? (
            <p className="muted" style={{ marginTop: '10px' }}>
              Loading…
            </p>
          ) : error ? (
            <p className="muted" style={{ marginTop: '10px', color: 'var(--danger)' }}>
              Failed to load: {error}
            </p>
          ) : schedules.length === 0 ? (
            <p className="muted" style={{ marginTop: '10px' }}>
              No scheduled jobs yet. Add one via POST /api/missions/schedule.
            </p>
          ) : (
            <div className="table-wrap" style={{ marginTop: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Method</th>
                    <th>Target</th>
                    <th>Interval</th>
                    <th>State</th>
                    <th>Last Run</th>
                    <th>Next Run</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        {s.failures ? (
                          <span className="tag" style={{ marginLeft: '6px', color: 'var(--danger)' }}>
                            {s.failures} fail{s.failures === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </td>
                      <td className="mono">{s.method || 'POST'}</td>
                      <td className="mono" style={{ maxWidth: '320px', wordBreak: 'break-all' }}>
                        {s.target}
                      </td>
                      <td className="mono">{s.intervalSec}s</td>
                      <td>
                        <span className={'alert-chip ' + (s.enabled ? 'ok' : 'off')}>
                          {s.enabled ? dueLabel(s) : 'paused'}
                        </span>
                      </td>
                      <td className="mono">{fmt(s.lastRun)}</td>
                      <td className="mono">{fmt(s.nextRun)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: '16px' }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: '10px' }}>
            <h3 className="section-header" style={{ margin: 0 }}>
              Recent Executions
            </h3>
            <span className="tag">{executions.length} shown</span>
          </div>

          {executions.length === 0 ? (
            <p className="muted" style={{ marginTop: '10px' }}>
              No executions recorded yet.
            </p>
          ) : (
            <div className="table-wrap" style={{ marginTop: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Code</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((x, i) => (
                    <tr key={i}>
                      <td className="mono">{fmt(x.ts)}</td>
                      <td>
                        <span className="mono">{x.scheduleId}</span>
                        {x.name ? <div className="muted">{x.name}</div> : null}
                      </td>
                      <td>
                        <span className={'status ' + (x.status === 'ok' ? 'ok' : 'error')}>
                          {x.status}
                        </span>
                      </td>
                      <td className="mono">{x.statusCode ?? '—'}</td>
                      <td className="mono" style={{ color: 'var(--danger)' }}>
                        {x.error ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  },
};
