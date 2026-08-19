// GraphQL Guard feature — conflict-free. Auto-appears in the sidebar / command
// palette with NO edits to App.tsx or server.ts (discovered via import.meta.glob
// in features/registry.ts). Shows the server's current query limits and lets an
// operator paste a query to validate it (local depth/complexity preview + a live
// POST against the guarded endpoint). Note: this project uses the automatic JSX
// runtime, so you do NOT import React.
import { useEffect, useState } from 'react';

interface Limits {
  maxDepth: number;
  maxComplexity: number;
}

// Mirror of the server-side guards (brace depth + field count) so the UI can
// preview the verdict before hitting the server.
function stripStringsAndComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '"') {
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '"') { i++; break; }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function computeDepth(query: string): number {
  const s = stripStringsAndComments(query);
  let depth = 0;
  let max = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      depth++;
      if (depth > max) max = depth;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

function computeComplexity(query: string): number {
  const s = stripStringsAndComments(query);
  const keywords = new Set(['on', 'true', 'false', 'null', 'fragment', 'query', 'mutation', 'subscription']);
  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_]/.test(c);
  let complexity = 0;
  let depth = 0;
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth = Math.max(0, depth - 1); i++; continue; }
    if (ch === '(') {
      let d = 1;
      i++;
      while (i < n && d > 0) {
        if (s[i] === '(') d++;
        else if (s[i] === ')') d--;
        i++;
      }
      continue;
    }
    if (ch === '@') {
      i++;
      while (i < n && !/\s/.test(s[i]) && s[i] !== '{' && s[i] !== '}') i++;
      continue;
    }
    if (ch === '$') { i++; while (i < n && isIdent(s[i])) i++; continue; }
    if (ch === '.') {
      if (s[i + 1] === '.' && s[i + 2] === '.') { i += 3; continue; }
    }
    if (isIdentStart(ch)) {
      let j = i;
      while (j < n && isIdent(s[j])) j++;
      const ident = s.slice(i, j);
      i = j;
      let k = i;
      while (k < n && /\s/.test(s[k])) k++;
      if (s[k] === ':') { i = k + 1; continue; }
      if (depth > 0 && !keywords.has(ident)) complexity++;
      continue;
    }
    i++;
  }
  return complexity;
}

const SAMPLE = `query {
  server {
    name
    version
    uptimeSeconds
  }
  health {
    ok
  }
}`;

export default {
  path: '/feature/graphql-guard',
  label: 'GraphQL Guard',
  category: 'Features',
  component: function GraphQLGuardFeature() {
    const [limits, setLimits] = useState<Limits | null>(null);
    const [limitsError, setLimitsError] = useState<string | null>(null);
    const [query, setQuery] = useState(SAMPLE);
    const [result, setResult] = useState<string>('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      let cancelled = false;
      fetch('/api/graphql/limits')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then((d: Limits) => {
          if (!cancelled) {
            setLimits(d);
            setLimitsError(null);
          }
        })
        .catch((e: Error) => {
          if (!cancelled) setLimitsError(e.message);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    const depth = computeDepth(query);
    const complexity = computeComplexity(query);
    const tooDeep = limits ? depth > limits.maxDepth : false;
    const tooComplex = limits ? complexity > limits.maxComplexity : false;

    function validate() {
      setBusy(true);
      setResult('');
      fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      })
        .then(async (r) => {
          const text = await r.text();
          let pretty = text;
          try {
            pretty = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            pretty = text;
          }
          setResult('HTTP ' + r.status + '\n\n' + pretty);
        })
        .catch((e: Error) => {
          setResult('Request failed: ' + e.message);
        })
        .finally(() => setBusy(false));
    }

    return (
      <div className="panel">
        <h2 className="section-header">GraphQL Guard</h2>
        <p className="subtitle">
          The <code>/api/graphql</code> endpoint enforces a maximum query depth and a maximum field
          complexity. Paste a query below to preview the server-side verdict and run a live validation.
        </p>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div className="label">Active limits</div>
              {limitsError ? (
                <div className="muted" style={{ color: 'var(--danger)' }}>
                  Failed to load: {limitsError}
                </div>
              ) : limits ? (
                <div className="muted" style={{ marginTop: '4px' }}>
                  maxDepth = <strong>{limits.maxDepth}</strong> · maxComplexity ={' '}
                  <strong>{limits.maxComplexity}</strong>
                </div>
              ) : (
                <div className="muted">Loading limits…</div>
              )}
            </div>
            <div style={{ minWidth: '220px' }}>
              <div className="label">Local preview</div>
              <div className="muted" style={{ marginTop: '4px' }}>
                depth = <strong>{depth}</strong>{' '}
                {tooDeep ? <span style={{ color: 'var(--danger)' }}>(too deep)</span> : null} ·{' '}
                complexity = <strong>{complexity}</strong>{' '}
                {tooComplex ? <span style={{ color: 'var(--danger)' }}>(too complex)</span> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <label className="label" htmlFor="gq-query">
            Query
          </label>
          <textarea
            id="gq-query"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={12}
            style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: '13px' }}
            spellCheck={false}
          />
          <div className="row" style={{ marginTop: '12px' }}>
            <button className="btn btn-primary" onClick={validate} disabled={busy}>
              {busy ? 'Validating…' : 'Validate'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setQuery(SAMPLE);
                setResult('');
              }}
            >
              Reset sample
            </button>
          </div>
        </div>

        {result ? (
          <div className="card">
            <div className="label">Server response</div>
            <pre
              className="muted"
              style={{
                marginTop: '8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
              }}
            >
              {result}
            </pre>
          </div>
        ) : null}
      </div>
    );
  },
};
