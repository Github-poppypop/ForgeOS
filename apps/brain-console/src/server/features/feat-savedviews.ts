// Server feature: saved-views / named filter presets for data panels.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
// Closes Batch B #11 (saved views/filters for missions/vault/audit tables).
// Persists to data/saved-views.json (gitignored runtime artifact, like store.json).
import type { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/server/features -> ../../../data == apps/brain-console/data
const DATA_DIR = path.resolve(__dirname, '../../../data');
const FILE = path.join(DATA_DIR, 'saved-views.json');

export const SAVED_VIEW_PANELS = ['vault', 'missions', 'audit', 'ledger'] as const;
export type SavedViewPanel = (typeof SAVED_VIEW_PANELS)[number];

export interface SavedView {
  id: string;
  panel: SavedViewPanel;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

const isPanel = (v: unknown): v is SavedViewPanel =>
  typeof v === 'string' && (SAVED_VIEW_PANELS as readonly string[]).includes(v);

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAll(): SavedView[] {
  ensureDir();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: SavedView[]): void {
  ensureDir();
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

function genId(): string {
  return 'sv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function registerSavedViews(router: Router): void {
  router.get('/api/saved-views', (req, res) => {
    const panel = typeof req.query.panel === 'string' ? req.query.panel : undefined;
    let list = loadAll();
    if (panel) list = list.filter((v) => v.panel === panel);
    res.json({ ok: true, views: list });
  });

  router.get('/api/saved-views/:id', (req, res) => {
    const v = loadAll().find((x) => x.id === req.params.id);
    if (!v) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true, view: v });
  });

  router.post('/api/saved-views', (req, res) => {
    const body = (req.body ?? {}) as { panel?: unknown; name?: unknown; filters?: unknown };
    const panel = body.panel;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const filters = body.filters;
    if (!isPanel(panel)) return res.status(400).json({ ok: false, error: 'invalid panel' });
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return res.status(400).json({ ok: false, error: 'filters object required' });
    }
    const view: SavedView = {
      id: genId(),
      panel,
      name,
      filters: filters as Record<string, string>,
      createdAt: new Date().toISOString(),
    };
    const list = loadAll();
    list.push(view);
    saveAll(list);
    res.status(201).json({ ok: true, view });
  });

  router.delete('/api/saved-views/:id', (req, res) => {
    const list = loadAll();
    const next = list.filter((x) => x.id !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ ok: false, error: 'not found' });
    saveAll(next);
    res.json({ ok: true, deleted: req.params.id });
  });
}
