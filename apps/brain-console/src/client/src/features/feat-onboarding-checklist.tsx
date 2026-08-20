// Guided Onboarding Checklist — closes Batch E #46.
// A self-contained, mock-first panel that mirrors the ForgeOS ROADMAP phases and
// lets a new operator track their bootstrap progress. Progress persists in
// localStorage so it survives reloads. Auto-registers via the features glob
// (registry.ts) — no edits to App.tsx or server.ts required.
// Note: this project uses the automatic JSX runtime, so React is not imported.
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'forgeos-onboarding-checklist';

interface ChecklistTask {
  id: string;
  label: string;
}

interface OnboardingPhase {
  phase: string;
  owner: string;
  target: string;
  tasks: ChecklistTask[];
}

// Derived from ROADMAP.md (Phase 0 → Phase 5). Kept inline so the panel works
// without a backend fetch; swap for a live ROADMAP endpoint later if desired.
const PHASES: OnboardingPhase[] = [
  {
    phase: 'Phase 0 — Charter & Structure (v1.0)',
    owner: 'CEO',
    target: '2026-07',
    tasks: [
      { id: 'p0-t0', label: 'Define mission, vision, org charter' },
      { id: 'p0-t1', label: 'Establish C-suite hierarchy + delegation rules' },
      { id: 'p0-t2', label: 'Scaffold repository structure (/docs /apps /services /agents …)' },
      { id: 'p0-t3', label: 'Author C-suite role profiles' },
      { id: 'p0-t4', label: 'Seed Knowledge Universe with charter docs' },
    ],
  },
  {
    phase: 'Phase 1 — Agent Runtime (v1.1)',
    owner: 'CTO',
    target: '2026-08',
    tasks: [
      { id: 'p1-t0', label: 'Agent runtime: spawn, bound, log, terminate' },
      { id: 'p1-t1', label: 'C-suite agent skeletons (one per domain)' },
      { id: 'p1-t2', label: 'Delegation protocol implementation' },
      { id: 'p1-t3', label: 'Reporting pipeline (agent → owner → CEO digest)' },
      { id: 'p1-t4', label: 'Guardrails enforcement for constitutional rules' },
    ],
  },
  {
    phase: 'Phase 2 — Product & Apps (v1.2)',
    owner: 'CPO',
    target: '2026-09',
    tasks: [
      { id: 'p2-t0', label: 'Reference app(s) in /apps' },
      { id: 'p2-t1', label: 'Service catalog in /services' },
      { id: 'p2-t2', label: 'Marketplace skeleton (publish / discover)' },
    ],
  },
  {
    phase: 'Phase 3 — Operations & Knowledge (v1.3)',
    owner: 'COO',
    target: '2026-10',
    tasks: [
      { id: 'p3-t0', label: 'Knowledge Universe ingestion + retrieval' },
      { id: 'p3-t1', label: 'Decision / incident record standard' },
      { id: 'p3-t2', label: 'Cross-functional QA + incident response runbooks' },
    ],
  },
  {
    phase: 'Phase 4 — Go-To-Market & Finance (v1.4)',
    owner: 'CMO + CFO',
    target: '2026-11',
    tasks: [
      { id: 'p4-t0', label: 'External docs site from /docs' },
      { id: 'p4-t1', label: 'Community + onboarding funnel' },
      { id: 'p4-t2', label: 'Marketplace economics + budgeting model' },
    ],
  },
  {
    phase: 'Phase 5 — v2.0 Autonomous Composition',
    owner: 'CEO (all C-suite)',
    target: '2027-Q1',
    tasks: [
      { id: 'p5-t0', label: 'Cross-org Knowledge Universe inheritance' },
      { id: 'p5-t1', label: 'Self-service org bootstrap from template' },
      { id: 'p5-t2', label: 'Constitutional guardrails hardening' },
    ],
  },
];

type CheckedMap = Record<string, boolean>;

function readChecked(): CheckedMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CheckedMap) : {};
  } catch {
    return {};
  }
}

function writeChecked(map: CheckedMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export default {
  path: '/feature/onboarding-checklist',
  label: 'Onboarding Checklist',
  category: 'Onboarding',
  component: function OnboardingChecklist() {
    const [checked, setChecked] = useState<CheckedMap>(() => readChecked());

    useEffect(() => {
      writeChecked(checked);
    }, [checked]);

    const allIds = useMemo(() => PHASES.flatMap((p) => p.tasks.map((t) => t.id)), []);
    const total = allIds.length;
    const done = allIds.filter((id) => checked[id]).length;
    const overallPct = total === 0 ? 0 : Math.round((done / total) * 100);

    const toggle = (id: string) =>
      setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

    const reset = () => setChecked({});
    const markAll = () => {
      const next: CheckedMap = {};
      for (const id of allIds) next[id] = true;
      setChecked(next);
    };

    return (
      <div className="panel">
        <h2 className="section-header">Onboarding Checklist</h2>
        <p className="subtitle">
          Guided bootstrap tied to the ForgeOS ROADMAP phases. Your progress is
          saved in this browser.
        </p>

        <div className="card" style={{ marginBottom: 'var(--s4)' }}>
          <div className="row items-center" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="mono">Overall completion</div>
              <p className="caption" style={{ margin: 0 }}>
                {done} of {total} steps complete ({overallPct}%)
              </p>
            </div>
            <div className="wrap items-center" style={{ gap: 'var(--s2)' }}>
              <button type="button" className="btn secondary sm" onClick={markAll}>
                Mark all done
              </button>
              <button type="button" className="btn secondary sm" onClick={reset}>
                Reset
              </button>
            </div>
          </div>
          <div className="progress" style={{ marginTop: 'var(--s3)' }} role="progressbar" aria-valuenow={overallPct} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        <div className="stack stack-md">
          {PHASES.map((phase) => {
            const phaseDone = phase.tasks.filter((t) => checked[t.id]).length;
            const phaseTotal = phase.tasks.length;
            const phasePct = phaseTotal === 0 ? 0 : Math.round((phaseDone / phaseTotal) * 100);
            const complete = phaseDone === phaseTotal;
            return (
              <div key={phase.phase} className={`card${complete ? ' hl' : ''}`}>
                <div className="row items-center" style={{ justifyContent: 'space-between', marginBottom: 'var(--s2)' }}>
                  <div>
                    <div className="mono">{phase.phase}</div>
                    <p className="caption" style={{ margin: 0 }}>
                      Owner: {phase.owner} · Target: {phase.target}
                    </p>
                  </div>
                  <span className="pill" style={{ fontSize: 12 }}>
                    {phaseDone}/{phaseTotal}
                  </span>
                </div>
                <div className="progress" style={{ marginBottom: 'var(--s3)' }}>
                  <i style={{ width: `${phasePct}%` }} />
                </div>
                <div className="stack stack-sm">
                  {phase.tasks.map((task) => (
                    <label
                      key={task.id}
                      className="row items-center"
                      style={{ gap: 'var(--s2)', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked[task.id]}
                        onChange={() => toggle(task.id)}
                        style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                      />
                      <span style={checked[task.id] ? { color: 'var(--text-muted)' } : undefined}>
                        {task.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
};
