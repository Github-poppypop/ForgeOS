// Decisions Inline Editor — closes Batch B #15 (inline edit for decisions with
// optimistic rollback). Auto-registers under the "Data" sidebar group with NO edits
// to App.tsx / server.ts. Mock-first: the "save" is simulated by persistDecision(),
// which rejects when the title contains "fail" (or forceFail) so the optimistic
// update visibly rolls back — exactly the failure path real storage would hit.
import { useRef, useState } from 'react';

export type DecisionStatus = 'proposed' | 'approved' | 'rejected' | 'superseded';

export interface Decision {
  id: string;
  title: string;
  owner: string;
  status: DecisionStatus;
  rationale: string;
}

export const STATUSES: DecisionStatus[] = ['proposed', 'approved', 'rejected', 'superseded'];

const SEED: Decision[] = [
  { id: 'DEC-101', title: 'Adopt event-sourced audit log', owner: 'platform', status: 'approved', rationale: 'Immutable trail for compliance.' },
  { id: 'DEC-102', title: 'Default new missions to dry-run', owner: 'safety', status: 'proposed', rationale: 'Reduce blast radius of autonomous waves.' },
  { id: 'DEC-103', title: 'Retire legacy webhook relay', owner: 'platform', status: 'rejected', rationale: 'Superseded by SSE channel.' },
  { id: 'DEC-104', title: 'Require review for prod deploys', owner: 'release', status: 'approved', rationale: 'Two-person rule for :7777.' },
  { id: 'DEC-105', title: 'Cap parallel subagents at 12', owner: 'orchestration', status: 'proposed', rationale: 'Free-model 90s timeout safety.' },
];

/** Pure validation — returns a list of human-readable errors (empty = valid). */
export function validateDecision(d: Decision): string[] {
  const errs: string[] = [];
  if (!d.title.trim()) errs.push('Title is required');
  if (!d.owner.trim()) errs.push('Owner is required');
  if (!STATUSES.includes(d.status)) errs.push('Unknown status');
  return errs;
}

/**
 * Simulate persisting a decision to upstream storage.
 * Resolves with the saved decision on success; rejects to emulate an upstream
 * rejection so the caller can roll back its optimistic update.
 * Deterministic failure: titles containing "fail", or opts.forceFail.
 */
export function persistDecision(d: Decision, opts?: { forceFail?: boolean; latencyMs?: number }): Promise<Decision> {
  const latency = opts?.latencyMs ?? 450;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (opts?.forceFail || /fail/i.test(d.title)) {
        reject(new Error('Upstream rejected the change (simulated)'));
      } else {
        resolve({ ...d });
      }
    }, latency);
  });
}

interface Toast {
  id: number;
  kind: 'ok' | 'err';
  msg: string;
}

export default {
  path: '/feature/inline-edit',
  label: 'Decisions Inline Editor',
  category: 'Data',
  component: function DecisionsInlineEditor() {
    const [decisions, setDecisions] = useState<Decision[]>(SEED);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Decision | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const prevRef = useRef<Decision[] | null>(null);
    const seq = useRef(0);

    function pushToast(kind: 'ok' | 'err', msg: string): void {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, kind, msg }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    }

    function startEdit(d: Decision): void {
      setEditingId(d.id);
      setDraft({ ...d });
      setErrors([]);
    }

    function cancelEdit(): void {
      setEditingId(null);
      setDraft(null);
      setErrors([]);
    }

    function update<K extends keyof Decision>(key: K, value: Decision[K]): void {
      setDraft((d) => (d ? { ...d, [key]: value } : d));
    }

    async function saveEdit(): Promise<void> {
      if (!draft) return;
      const errs = validateDecision(draft);
      if (errs.length) {
        setErrors(errs);
        pushToast('err', 'Cannot save: ' + errs[0]);
        return;
      }
      setErrors([]);
      // OPTIMISTIC UPDATE: apply immediately, keep a snapshot to roll back on failure.
      const snapshot = decisions;
      prevRef.current = snapshot;
      const next = decisions.map((d) => (d.id === draft.id ? { ...draft } : d));
      setDecisions(next);
      setSavingId(draft.id);
      setEditingId(null);
      const savedTitle = draft.title;
      try {
        await persistDecision(draft);
        pushToast('ok', 'Saved "' + savedTitle + '"');
      } catch (e) {
        // ROLLBACK to the pre-edit snapshot.
        setDecisions(prevRef.current ?? snapshot);
        const reason = e instanceof Error ? e.message : 'unknown error';
        pushToast('err', 'Reverted "' + savedTitle + '" — ' + reason);
      } finally {
        setSavingId(null);
        setDraft(null);
        prevRef.current = null;
      }
    }

    return (
      <div className="card">
        <div className="section-header">
          <h2>Decisions — Inline Editor</h2>
          <span className="subtitle">optimistic update + rollback · Batch B #15</span>
        </div>
        <p className="muted mt-2">
          Click <strong>Edit</strong> on any row to edit it in place. Changes apply immediately
          (optimistic). If the simulated save fails, the row rolls back to its previous value.
          Tip: put the word <code>fail</code> in a title to force a rejected save and watch the rollback.
        </p>

        <div className="row wrap gap-2 mt-3" style={{ alignItems: 'flex-start' }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pill"
              style={{
                borderColor: t.kind === 'ok' ? 'rgba(52,211,153,0.6)' : 'rgba(248,113,113,0.6)',
                color: t.kind === 'ok' ? 'var(--success)' : 'var(--danger)',
                background: t.kind === 'ok' ? 'var(--success-dim)' : 'var(--danger-dim)',
              }}
            >
              {t.kind === 'ok' ? '✓ ' : '↺ '}
              {t.msg}
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div
            className="mt-3"
            style={{ padding: 10, borderRadius: 8, border: '1px solid var(--danger)', background: 'var(--danger-dim)', color: 'var(--danger)' }}
          >
            {errors.map((e) => (
              <div key={e}>• {e}</div>
            ))}
          </div>
        )}

        <div className="table-wrap mt-3">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Rationale</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => {
                const isEditing = editingId === d.id;
                const isSaving = savingId === d.id;
                return (
                  <tr key={d.id}>
                    <td className="mono">{d.id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className={'input' + (errors.length && !draft?.title.trim() ? ' input-error' : '')}
                          value={draft?.title ?? ''}
                          onChange={(e) => update('title', e.target.value)}
                          aria-label="Decision title"
                        />
                      ) : (
                        d.title
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="input"
                          value={draft?.owner ?? ''}
                          onChange={(e) => update('owner', e.target.value)}
                          aria-label="Decision owner"
                        />
                      ) : (
                        <span className="pill">{d.owner}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="select"
                          value={draft?.status ?? d.status}
                          onChange={(e) => update('status', e.target.value as DecisionStatus)}
                          aria-label="Decision status"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={'pill ' + (d.status === 'approved' ? 'ok' : d.status === 'rejected' ? 'bad' : 'warn')}>
                          {d.status}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <textarea
                          className="input"
                          rows={2}
                          value={draft?.rationale ?? ''}
                          onChange={(e) => update('rationale', e.target.value)}
                          aria-label="Decision rationale"
                        />
                      ) : (
                        <span className="muted">{d.rationale}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="row gap-2">
                          <button className="btn sm primary" onClick={saveEdit} disabled={isSaving}>
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn sm" onClick={cancelEdit} disabled={isSaving}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="btn sm" onClick={() => startEdit(d)} disabled={isSaving}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
};
