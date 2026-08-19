// Page Diff Viewer — Batch B enhancement #16 (Time-Travel / Diff Viewer).
// Self-contained conflict-free feature: compares the `body` of any two knowledge
// pages (by slug) via the existing GET /api/page/:slug endpoint and renders a
// line-level diff. Auto-appears in the sidebar / command palette (no App.tsx edits).
// Note: this project uses the automatic JSX runtime, so React is not imported.
import { useState } from 'react';

interface PagePayload {
  slug: string;
  title?: string;
  body?: string;
  type?: string;
  status?: string;
}

interface PageResponse {
  page?: PagePayload;
  error?: string;
}

type DiffOp = { kind: 'eq' | 'add' | 'del'; text: string };

// Classic LCS line diff — sufficient for document-sized pages.
function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'eq', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'del', text: a[i] });
      i++;
    } else {
      out.push({ kind: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ kind: 'del', text: a[i] });
    i++;
  }
  while (j < m) {
    out.push({ kind: 'add', text: b[j] });
    j++;
  }
  return out;
}

export default {
  path: '/feature/diff-viewer',
  label: 'Page Diff Viewer',
  category: 'Knowledge',
  component: function DiffViewer() {
    const [left, setLeft] = useState('');
    const [right, setRight] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [diff, setDiff] = useState<DiffOp[] | null>(null);
    const [meta, setMeta] = useState<{ leftTitle?: string; rightTitle?: string }>({});

    async function fetchPage(slug: string): Promise<PagePayload> {
      const r = await fetch(`/api/page/${encodeURIComponent(slug)}`);
      const data = (await r.json()) as PageResponse;
      if (!r.ok || !data.page) throw new Error(data.error ?? `Page not found: ${slug}`);
      return data.page;
    }

    async function run(): Promise<void> {
      const ls = left.trim();
      const rs = right.trim();
      if (!ls || !rs) {
        setError('Enter both page slugs to compare.');
        return;
      }
      setLoading(true);
      setError('');
      setDiff(null);
      try {
        const [lp, rp] = await Promise.all([fetchPage(ls), fetchPage(rs)]);
        setMeta({ leftTitle: lp.title, rightTitle: rp.title });
        setDiff(diffLines((lp.body ?? '').split('\n'), (rp.body ?? '').split('\n')));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to compare pages');
      } finally {
        setLoading(false);
      }
    }

    const adds = diff ? diff.filter((d) => d.kind === 'add').length : 0;
    const dels = diff ? diff.filter((d) => d.kind === 'del').length : 0;

    return (
      <div className="panel">
        <h2 className="section-header">Page Diff Viewer</h2>
        <p className="subtitle">
          Compare the body of any two knowledge pages by slug — e.g. two policy or runbook versions —
          to see exactly what changed line by line.
        </p>
        <div className="card">
          <div className="row gap-2 wrap items-end">
            <label className="field" style={{ flex: '1 1 200px' }}>
              <span className="field-label">Left page slug</span>
              <input
                className="input"
                value={left}
                placeholder="decisions/2026-q3-hiring"
                onChange={(e) => setLeft(e.target.value)}
              />
            </label>
            <label className="field" style={{ flex: '1 1 200px' }}>
              <span className="field-label">Right page slug</span>
              <input
                className="input"
                value={right}
                placeholder="decisions/2026-q4-hiring"
                onChange={(e) => setRight(e.target.value)}
              />
            </label>
            <button className="btn primary" onClick={() => void run()} disabled={loading}>
              {loading ? 'Comparing…' : 'Compare'}
            </button>
          </div>
          {error ? (
            <div className="field-error" style={{ marginTop: 10 }}>
              {error}
            </div>
          ) : null}
        </div>

        {diff ? (
          <div className="card mt-3">
            <div className="row gap-2 items-center" style={{ marginBottom: 10 }}>
              <span className="tag info">+{adds}</span>
              <span className="tag danger">−{dels}</span>
              <span className="muted">
                {meta.leftTitle ? `“${meta.leftTitle}”` : left} vs{' '}
                {meta.rightTitle ? `“${meta.rightTitle}”` : right}
              </span>
            </div>
            <div className="diff-wrap">
              {diff.map((op, idx) => (
                <div key={idx} className={`diff-row ${op.kind}`}>
                  <span className="diff-gutter">
                    {op.kind === 'add' ? '+' : op.kind === 'del' ? '−' : ''}
                  </span>
                  <span className="diff-text">{op.text || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
};
