import { useEffect, useState } from 'react';

// Client feature: live brain-sync status panel. Opens an EventSource to the SSE hub that
// feat-sse.ts registers on the server. Self-contained — no edits to App.tsx.
export default {
  path: '/feature/sse',
  label: 'Live Brain Sync',
  category: 'Features',
  component: function SSEStatusPanel() {
    const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
    const [lastEvent, setLastEvent] = useState<string | null>(null);

    useEffect(() => {
      setStatus('connecting');
      const es = new EventSource('/api/brain/stream');
      es.onopen = () => setStatus('open');
      es.onmessage = (e) => setLastEvent(`${new Date().toLocaleTimeString()}: ${e.data}`);
      es.onerror = () => setStatus('closed');
      return () => es.close();
    }, []);

    return (
      <div className="panel">
        <h2 className="section-header">Live Brain Sync</h2>
        <p className="subtitle">Server-Sent Events stream for real-time console state.</p>
        <div className="card">
          <div className="row items-center" style={{ justifyContent: 'space-between' }}>
            <span>
              Connection:{' '}
              <strong className={status === 'open' ? 'tag done' : 'tag info'}>{status}</strong>
            </span>
            <button
              className="btn primary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reconnect
            </button>
          </div>
          {lastEvent && <p className="muted">Last event: {lastEvent}</p>}
        </div>
      </div>
    );
  },
};
