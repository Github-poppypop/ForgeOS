// AI / Ollama Status & Graceful Degradation — closes next-50 #29.
//
// Self-contained, mock-first panel that probes the local Ollama runtime and
// surfaces a graceful-degradation state when it is offline. The console already
// shows an `ollama` pill in the status bar; this panel turns that signal into an
// operator-facing experience: it explains WHAT still works, WHAT is reduced, and
// HOW to recover, and it lets you preview the degraded UX without a real outage.
//
// Auto-registers via the features glob (registry.ts) — no edits to App.tsx or
// server.ts required. Note: automatic JSX runtime, so React is not imported.
import { useEffect, useRef, useState } from 'react';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

type ConnState = 'idle' | 'checking' | 'online' | 'offline';

interface OllamaModel {
  name: string;
  size?: number;
}

export default {
  path: '/feature/ai-degradation',
  label: 'AI / Ollama Status',
  category: 'Agent Runtime',
  component: function AiDegradation() {
    const [url, setUrl] = useState<string>(DEFAULT_OLLAMA_URL);
    const [state, setState] = useState<ConnState>('idle');
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [error, setError] = useState<string>('');
    const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
    const abortRef = useRef<AbortController | null>(null);

    async function check() {
      const target = url.trim().replace(/\/$/, '');
      setState('checking');
      setError('');
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const timer = setTimeout(() => ac.abort(), 3500);
      try {
        const res = await fetch(`${target}/api/tags`, { signal: ac.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { models?: OllamaModel[] };
        if (simulateOffline) {
          setState('offline');
          setModels([]);
          setError('Simulated outage — Ollama is actually reachable, but this previews the degraded experience.');
          return;
        }
        setModels(data.models ?? []);
        setState('online');
      } catch (e) {
        clearTimeout(timer);
        if (simulateOffline) {
          setState('offline');
          setError('Simulated outage — degradation UX preview.');
          return;
        }
        setState('offline');
        setError(e instanceof Error ? e.message : 'connection failed');
      }
    }

    useEffect(() => {
      void check();
      return () => abortRef.current?.abort();
      // initial probe only; check() closes over the initial url/simulateOffline
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const degraded = state === 'offline' || simulateOffline;
    const pillCls =
      state === 'online' && !simulateOffline
        ? 'ok'
        : state === 'offline' || simulateOffline
          ? 'bad'
          : 'warn';

    return (
      <div className="panel">
        <div className="section-header">
          <h2>AI / Ollama Status</h2>
          <span className="subtitle">
            Graceful degradation when the local LLM runtime is offline
          </span>
        </div>

        <div className="card" style={{ marginBottom: 'var(--s4)' }}>
          <div className="row items-center" style={{ justifyContent: 'space-between', gap: 'var(--s3)' }}>
            <div>
              <div className="mono">Connection</div>
              <p className="caption" style={{ margin: 0 }}>
                {state === 'checking'
                  ? 'Probing Ollama…'
                  : state === 'online'
                    ? 'Ollama reachable'
                    : state === 'offline'
                      ? 'Ollama unreachable'
                      : 'Not checked yet'}
              </p>
            </div>
            <span className={`pill ${pillCls}`}>{simulateOffline ? 'degraded (sim)' : state}</span>
          </div>

          <div className="row" style={{ marginTop: 'var(--s3)', gap: 'var(--s2)' }}>
            <label className="mono" style={{ alignSelf: 'center' }}>URL</label>
            <input
              className="mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
              }}
              spellCheck={false}
            />
            <button type="button" className="btn secondary sm" onClick={() => void check()}>
              Check now
            </button>
          </div>

          <div className="row" style={{ marginTop: 'var(--s3)' }}>
            <label className="row" style={{ gap: 'var(--s2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={simulateOffline}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSimulateOffline(v);
                  if (v) {
                    setState('offline');
                    setError('Simulated outage — degradation UX preview.');
                  } else {
                    void check();
                  }
                }}
              />
              <span>Simulate offline (demo graceful degradation)</span>
            </label>
          </div>
        </div>

        {degraded && (
          <div className="card hl" style={{ marginBottom: 'var(--s4)', borderColor: 'var(--warn)' }}>
            <div className="section-header">
              <h2>Graceful degradation active</h2>
            </div>
            <p className="caption" style={{ marginTop: 0 }}>
              The local LLM runtime (Ollama) is unavailable. ForgeOS keeps operating
              with reduced AI capability — no data is lost:
            </p>
            <ul className="mono" style={{ lineHeight: 1.7, paddingLeft: 'var(--s4)' }}>
              <li><b>Live embedding / semantic search:</b> paused — cached &amp; exact-match retrieval still works.</li>
              <li><b>Agent summarization &amp; drafting:</b> queued — tasks retry automatically when Ollama returns.</li>
              <li><b>Structured decisions / audit log:</b> fully operational (no LLM dependency).</li>
              <li><b>Saved views, exports, ACL, knowledge graph:</b> fully operational.</li>
            </ul>
            <p className="caption" style={{ marginBottom: 0 }}>
              <b>Recover:</b> start Ollama (<code className="mono">ollama serve</code>) and ensure a model is
              pulled (<code className="mono">ollama pull mxbai-embed-large</code>), then press{' '}
              <b>Check now</b>.
            </p>
            {error && (
              <p className="caption" style={{ color: 'var(--warn)', marginBottom: 0 }}>
                Diagnostic: {error}
              </p>
            )}
          </div>
        )}

        {state === 'online' && !simulateOffline && (
          <div className="card">
            <div className="section-header">
              <h2>Available models</h2>
              <span className="subtitle">
                {models.length} model{models.length === 1 ? '' : 's'} detected
              </span>
            </div>
            {models.length === 0 ? (
              <p className="caption">
                No models pulled yet. Run <code className="mono">ollama pull mxbai-embed-large</code> to
                enable embeddings.
              </p>
            ) : (
              <div className="stack stack-sm">
                {models.map((m) => (
                  <div key={m.name} className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="mono">{m.name}</span>
                    <span className="pill ok">ready</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
};
