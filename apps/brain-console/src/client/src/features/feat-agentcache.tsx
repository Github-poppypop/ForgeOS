// Client feature: Agent Cache UI — set/get/delete keys (with TTL) and view meta + keys.
// Conflict-free: auto-discovered by features/registry.ts; no edits to App.tsx or server.ts.
// Closes backlog item #25. Reuses existing design-system classes (panel, card, btn, input, table).
// Note: automatic JSX runtime — do NOT import React; import hooks directly.
import { useEffect, useState } from 'react';

interface CacheKey {
  key: string;
  expiresAt: number;
}

interface Meta {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

interface GetResult {
  ok: boolean;
  key?: string;
  value?: unknown;
  expiresAt?: number;
  error?: string;
}

function fmtExpiry(exp: number | undefined): string {
  if (exp === undefined || !Number.isFinite(exp)) return 'no TTL';
  const ms = exp - Date.now();
  if (ms <= 0) return 'expired';
  if (ms < 60000) return Math.ceil(ms / 1000) + 's';
  if (ms < 3_600_000) return Math.ceil(ms / 60000) + 'm';
  return Math.ceil(ms / 3_600_000) + 'h';
}

export default {
  path: '/feature/agent-cache',
  label: 'Agent Cache',
  category: 'Features',
  component: function AgentCacheFeature() {
    const [key, setKey] = useState('');
    const [value, setValue] = useState('');
    const [ttl, setTtl] = useState('');
    const [msg, setMsg] = useState('');
    const [meta, setMeta] = useState<Meta | null>(null);
    const [keys, setKeys] = useState<CacheKey[]>([]);
    const [lastValue, setLastValue] = useState<GetResult | null>(null);

    async function refresh(): Promise<void> {
      try {
        const [m, k] = await Promise.all([
          fetch('/api/agent-cache/meta').then((r) => r.json() as Promise<Meta>),
          fetch('/api/agent-cache').then((r) => r.json() as Promise<{ keys: CacheKey[] }>),
        ]);
        setMeta(m);
        setKeys(k.keys ?? []);
      } catch {
        setMsg('Failed to load cache state');
      }
    }

    useEffect(() => {
      void refresh();
    }, []);

    async function setKey_(): Promise<void> {
      if (!key) {
        setMsg('Enter a key');
        return;
      }
      setMsg('');
      try {
        const r = await fetch('/api/agent-cache', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            key,
            value: value === '' ? null : safeParse(value),
            ttlSec: ttl === '' ? undefined : Number(ttl),
          }),
        });
        const d = (await r.json()) as { ok: boolean; error?: string };
        if (!r.ok) {
          setMsg('Error: ' + (d.error ?? String(r.status)));
          return;
        }
        setMsg('Stored "' + key + '"');
        setLastValue(null);
        await refresh();
      } catch {
        setMsg('Request failed');
      }
    }

    async function getKey(k: string): Promise<void> {
      setMsg('');
      try {
        const r = await fetch('/api/agent-cache/' + encodeURIComponent(k));
        const d = (await r.json()) as GetResult;
        setLastValue(d);
        if (!r.ok) setMsg('Miss: ' + (d.error ?? 'not found'));
        await refresh();
      } catch {
        setMsg('Request failed');
      }
    }

    async function delKey(k: string): Promise<void> {
      setMsg('');
      try {
        const r = await fetch('/api/agent-cache/' + encodeURIComponent(k), { method: 'DELETE' });
        const d = (await r.json()) as { ok: boolean; deleted?: boolean };
        setMsg(d.deleted ? 'Deleted "' + k + '"' : 'Key not present');
        setLastValue(null);
        await refresh();
      } catch {
        setMsg('Request failed');
      }
    }

    return (
      <div className="panel">
        <h2 className="section-header">Agent Cache</h2>
        <p className="subtitle">
          In-memory agent memory with per-key TTL and LRU eviction (cap 1000).
        </p>

        <div className="card">
          <div className="section-header">
            <h3>Set / Update key</h3>
          </div>
          <div className="stack gap-2 mt-2">
            <div className="field">
              <label htmlFor="ac-key">Key</label>
              <input
                id="ac-key"
                className="input"
                placeholder="memory key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ac-value">Value (JSON or text)</label>
              <input
                id="ac-value"
                className="input"
                placeholder='e.g. "hello" or {"a":1}'
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ac-ttl">TTL (seconds, blank = infinite)</label>
              <input
                id="ac-ttl"
                className="input"
                type="number"
                min="1"
                placeholder="e.g. 60"
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
              />
            </div>
            <div className="row gap-2 mt-2 wrap items-center">
              <button className="btn primary" onClick={() => void setKey_()}>
                Set key
              </button>
              <button
                className="btn secondary"
                disabled={!key}
                onClick={() => void getKey(key)}
              >
                Get key
              </button>
              <button
                className="btn secondary"
                disabled={!key}
                onClick={() => void delKey(key)}
              >
                Delete key
              </button>
              <button className="btn ghost" onClick={() => void refresh()}>
                Refresh
              </button>
              <span className="muted">{msg}</span>
            </div>
          </div>
        </div>

        {lastValue ? (
          <div className="card mt-3">
            <div className="section-header">
              <h3>Last get: {lastValue.key}</h3>
              <span className="subtitle">
                {lastValue.ok
                  ? 'hit · expires ' + fmtExpiry(lastValue.expiresAt)
                  : 'miss'}
              </span>
            </div>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {lastValue.ok
                ? JSON.stringify(lastValue.value, null, 2)
                : 'not found'}
            </pre>
          </div>
        ) : null}

        <div className="card mt-3">
          <div className="section-header">
            <h3>Cache meta</h3>
          </div>
          {meta ? (
            <div className="stats cols-4 dashboard-stats mt-2">
              <div className="stat">
                <div className="h3">Size</div>
                <div className="value">{meta.size}</div>
                <div className="caption">live keys</div>
              </div>
              <div className="stat">
                <div className="h3">Hits</div>
                <div className="value">{meta.hits}</div>
                <div className="caption">cache reads</div>
              </div>
              <div className="stat">
                <div className="h3">Misses</div>
                <div className="value">{meta.misses}</div>
                <div className="caption">not found</div>
              </div>
              <div className="stat">
                <div className="h3">Evictions</div>
                <div className="value">{meta.evictions}</div>
                <div className="caption">expired + LRU</div>
              </div>
            </div>
          ) : (
            <p className="muted mt-2">Loading…</p>
          )}
        </div>

        <div className="card mt-3">
          <div className="section-header">
            <h3>Current keys</h3>
            <span className="subtitle">{keys.length} stored</span>
          </div>
          <div className="table-wrap mt-2">
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>TTL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.key}>
                    <td>
                      <code>{k.key}</code>
                    </td>
                    <td>{fmtExpiry(k.expiresAt)}</td>
                    <td>
                      <div className="row gap-2 wrap items-center">
                        <button
                          className="btn secondary sm"
                          onClick={() => {
                            setKey(k.key);
                            void getKey(k.key);
                          }}
                        >
                          Get
                        </button>
                        <button
                          className="btn danger sm"
                          onClick={() => void delKey(k.key)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No keys in cache.
                    </td>
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

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
