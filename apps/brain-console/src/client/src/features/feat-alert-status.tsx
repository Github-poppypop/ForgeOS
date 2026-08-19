// Alerting Status feature — conflict-free. Auto-appears in the sidebar / command
// palette with NO edits to App.tsx or server.ts. Surfaces whether error alerts
// reach Sentry or an alert webhook, and lets an operator fire a manual self-test.
// Note: this project uses the automatic JSX runtime, so you do NOT import React.
import { useEffect, useState } from 'react';

interface AlertStatus {
  ok: boolean;
  sentryConfigured: boolean;
  webhookConfigured: boolean;
  mode: 'sentry' | 'webhook' | 'disabled';
  note: string;
}

export default {
  path: '/feature/alert-status',
  label: 'Alerting Status',
  category: 'Observability',
  component: function AlertStatusFeature() {
    const [status, setStatus] = useState<AlertStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);

    function refresh() {
      fetch('/api/alerting/status')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: AlertStatus) => {
          setStatus(d);
          setLoading(false);
          setError(null);
        })
        .catch((e: Error) => {
          setError(e.message);
          setLoading(false);
        });
    }

    useEffect(() => {
      let cancelled = false;
      fetch('/api/alerting/status')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: AlertStatus) => {
          if (!cancelled) {
            setStatus(d);
            setLoading(false);
          }
        })
        .catch((e: Error) => {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []);

    function sendTest() {
      setSending(true);
      setTestResult(null);
      fetch('/api/alerting/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || undefined }),
      })
        .then((r) => r.json())
        .then((d: { ok: boolean; dispatched: boolean; mode: string; note?: string }) => {
          setSending(false);
          setTestResult(
            d.dispatched
              ? `Self-test dispatched via ${d.mode}. Check your sink.`
              : `Not dispatched — alerting disabled (${d.note ?? 'set SENTRY_DSN or ALERT_WEBHOOK_URL'}).`
          );
          refresh();
        })
        .catch((e: Error) => {
          setSending(false);
          setTestResult('Self-test failed: ' + e.message);
        });
    }

    return (
      <div className="panel">
        <h2 className="section-header">Alerting Status</h2>
        <p className="subtitle">
          Whether error alerts reach Sentry or an alert webhook, plus a manual self-test.
        </p>
        {loading ? (
          <div className="card">
            <p className="muted">Loading alerting status…</p>
          </div>
        ) : error ? (
          <div className="card error">
            <p className="muted">Failed to load: {error}</p>
          </div>
        ) : !status ? (
          <div className="card">
            <p className="muted">No status.</p>
          </div>
        ) : (
          <div className="stack stack-md">
            <div className="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
              <span className={'alert-chip ' + (status.sentryConfigured ? 'ok' : 'off')}>
                Sentry {status.sentryConfigured ? 'configured' : 'not set'}
              </span>
              <span className={'alert-chip ' + (status.webhookConfigured ? 'ok' : 'off')}>
                Webhook {status.webhookConfigured ? 'configured' : 'not set'}
              </span>
              <span className={'alert-chip ' + (status.mode === 'disabled' ? 'warn' : 'ok')}>
                Mode: {status.mode}
              </span>
            </div>
            <div className="card">
              <p className="muted">{status.note}</p>
            </div>
            <div className="card">
              <label className="alert-label" htmlFor="alert-msg">
                Test message
              </label>
              <input
                id="alert-msg"
                className="alert-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional message to send to the alert sink"
              />
              <div className="row" style={{ gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button className="btn" onClick={sendTest} disabled={sending}>
                  {sending ? 'Sending…' : 'Send test alert'}
                </button>
                {testResult ? <span className="muted">{testResult}</span> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
};
