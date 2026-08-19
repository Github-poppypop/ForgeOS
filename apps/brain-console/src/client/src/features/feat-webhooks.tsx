// Webhook Management feature — conflict-free. Auto-appears in the sidebar /
// command palette with NO edits to App.tsx or server.ts. Lists registered
// outbound webhooks, lets an operator add one, fire a real test delivery, and
// delete it. Note: this project uses the automatic JSX runtime, so you do NOT
// import React.
import { useEffect, useState } from 'react';

interface Webhook {
  id: string;
  url: string;
  event: string;
  active: boolean;
  createdAt: string;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestError?: string;
}

interface WebhooksData {
  ok: boolean;
  webhooks: Webhook[];
  events: string[];
}

export default {
  path: '/webhooks',
  label: 'Webhooks',
  category: 'Governance',
  component: function WebhooksFeature() {
    const [data, setData] = useState<WebhooksData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [url, setUrl] = useState('');
    const [event, setEvent] = useState('*');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      fetch('/api/webhooks')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: WebhooksData) => {
          if (!cancelled) {
            setData(d);
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

    function refresh() {
      fetch('/api/webhooks')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: WebhooksData) => {
          setData(d);
          setLoading(false);
          setError(null);
        })
        .catch((e: Error) => {
          setError(e.message);
          setLoading(false);
        });
    }

    function add() {
      if (!/^https?:\/\//i.test(url.trim())) {
        setAddError('Enter a valid http(s) URL');
        return;
      }
      setAdding(true);
      setAddError(null);
      fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), event, active: true }),
      })
        .then(async (r) => {
          const d = (await r.json()) as { error?: string };
          if (!r.ok) {
            setAddError(d.error || 'Failed to add webhook');
            setAdding(false);
            return;
          }
          setUrl('');
          setEvent('*');
          setAdding(false);
          refresh();
        })
        .catch((e: Error) => {
          setAddError(e.message);
          setAdding(false);
        });
    }

    function test(id: string) {
      setBusyId(id);
      fetch('/api/webhooks/' + id + '/test', { method: 'POST' })
        .then(() => {
          setBusyId(null);
          refresh();
        })
        .catch(() => {
          setBusyId(null);
        });
    }

    function del(id: string) {
      setBusyId(id);
      fetch('/api/webhooks/' + id, { method: 'DELETE' })
        .then(() => {
          setBusyId(null);
          refresh();
        })
        .catch(() => {
          setBusyId(null);
        });
    }

    return (
      <div className="panel">
        <h2 className="section-header">Webhooks</h2>
        <p className="subtitle">
          Register outbound HTTP webhooks for platform events. A test delivery fires a real POST to
          your endpoint.
        </p>

        <div className="card">
          <label className="label" htmlFor="wh-url">
            Endpoint URL
          </label>
          <input
            id="wh-url"
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/hook"
          />
          <label className="label" htmlFor="wh-event" style={{ marginTop: '10px' }}>
            Event
          </label>
          <select
            id="wh-event"
            className="input"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            {(data?.events ?? []).map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
          {addError ? (
            <div className="muted" style={{ color: 'var(--danger)', marginTop: '8px' }}>
              {addError}
            </div>
          ) : null}
          <div className="row" style={{ marginTop: '12px' }}>
            <button className="btn btn-primary" onClick={add} disabled={adding}>
              {adding ? 'Adding…' : 'Add webhook'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card">
            <p className="muted">Loading webhooks…</p>
          </div>
        ) : error ? (
          <div className="card error">
            <p className="muted">Failed to load: {error}</p>
          </div>
        ) : !data || data.webhooks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-header">
              <div className="empty-state-title">No webhooks yet</div>
            </div>
            <div className="empty-state-body">
              <p className="muted">Add an endpoint above to start receiving platform event deliveries.</p>
            </div>
          </div>
        ) : (
          <div className="stack stack-md">
            {data.webhooks.map((wh) => (
              <div className="card" key={wh.id}>
                <div
                  className="row"
                  style={{ justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                      <span className={'alert-chip ' + (wh.active ? 'ok' : 'off')}>
                        {wh.active ? 'active' : 'paused'}
                      </span>
                      <span className="tag">{wh.event}</span>
                    </div>
                    <div
                      className="muted"
                      style={{
                        marginTop: '6px',
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {wh.url}
                    </div>
                    <div className="muted" style={{ marginTop: '4px' }}>
                      {wh.lastTestedAt
                        ? `Last test: ${wh.lastTestedAt} · ${
                            wh.lastTestStatus === 'ok'
                              ? 'ok'
                              : 'error' + (wh.lastTestError ? ' — ' + wh.lastTestError : '')
                          }`
                        : 'Not tested yet'}
                    </div>
                  </div>
                  <div className="row" style={{ gap: '8px' }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => test(wh.id)}
                      disabled={busyId === wh.id}
                    >
                      {busyId === wh.id ? 'Testing…' : 'Test'}
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => del(wh.id)}
                      disabled={busyId === wh.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
};
