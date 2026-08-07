/**
 * agents/runbook-selector.ts — Auto-select runbook by mission type
 *
 * Maps mission types / phases to runbook files in docs/runbooks/.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface Runbook {
  id: string;
  title: string;
  path: string;
  owner: string;
  severity: 'P1' | 'P2' | 'P3';
}

const RUNBOOKS_DIR = join(import.meta.dir, '..', 'docs', 'runbooks');

const MISSION_TYPE_RUNBOOK_MAP: Record<string, string[]> = {
  foundation: ['incident-response'],
  backend: ['incident-response', 'cross-functional-qa'],
  toolchain: ['incident-response'],
  security: ['incident-response'],
  deployment: ['incident-response'],
  review: ['cross-functional-qa'],
  'governance-build': ['incident-response'],
  'backend-reconcile': ['incident-response', 'cross-functional-qa'],
  'submodule-conversion': ['incident-response'],
};

const RUNBOOK_META: Record<string, { title: string; owner: string; severity: Runbook['severity'] }> = {
  'incident-response': { title: 'Incident Response', owner: 'COO', severity: 'P1' },
  'cross-functional-qa': { title: 'Cross-Functional QA', owner: 'COO', severity: 'P2' },
};

export class RunbookSelector {
  private cache: Runbook[] | null = null;

  select(missionType?: string, phase?: string): Runbook[] {
    const key = [missionType, phase].filter(Boolean).join('/') || 'default';
    const candidates = new Set<string>();

    const addCandidates = (type: string) => {
      const list = MISSION_TYPE_RUNBOOK_MAP[type] || [];
      list.forEach((r) => candidates.add(r));
    };

    if (missionType) addCandidates(missionType);
    if (phase) addCandidates(phase);
    if (candidates.size === 0) {
      candidates.add('incident-response');
    }

    return this.resolveRunbooks(Array.from(candidates));
  }

  listAll(): Runbook[] {
    if (this.cache) return this.cache;
    const runbooks: Runbook[] = [];
    try {
      if (!existsSync(RUNBOOKS_DIR)) {
        this.cache = runbooks;
        return runbooks;
      }
      const files = readFileSync(RUNBOOKS_DIR, 'utf8');
      // simple file discovery by trying known names
      const known = Object.keys(RUNBOOK_META);
      for (const name of known) {
        const p = join(RUNBOOKS_DIR, `${name}.md`);
        if (existsSync(p)) {
          runbooks.push({
            id: name,
            title: RUNBOOK_META[name].title,
            path: p,
            owner: RUNBOOK_META[name].owner,
            severity: RUNBOOK_META[name].severity,
          });
        }
      }
    } catch {
      // ignore
    }
    this.cache = runbooks;
    return runbooks;
  }

  getById(id: string): Runbook | undefined {
    return this.listAll().find((r) => r.id === id);
  }

  private resolveRunbooks(ids: string[]): Runbook[] {
    return ids
      .map((id) => {
        const meta = RUNBOOK_META[id];
        const p = join(RUNBOOKS_DIR, `${id}.md`);
        if (!meta || !existsSync(p)) return null;
        return { id, title: meta.title, path: p, owner: meta.owner, severity: meta.severity } as Runbook;
      })
      .filter((r): r is Runbook => r !== null);
  }
}

export const runbookSelector = new RunbookSelector();
