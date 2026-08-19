// Server feature: serve the project CHANGELOG.md as structured JSON at /api/changelog.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
import type { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/server/features -> apps/brain-console
const BC_ROOT = path.resolve(__dirname, '../../..');
// apps/brain-console -> apps -> repo root (/opt/forgeos)
const REPO_ROOT = path.resolve(BC_ROOT, '..', '..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');

interface ChangelogNote {
  type: string;
  notes: string[];
}
interface ChangelogRelease {
  version: string;
  date?: string;
  sections: ChangelogNote[];
}

function parseChangelog(md: string): ChangelogRelease[] {
  const lines = md.split(/\r?\n/);
  const releases: ChangelogRelease[] = [];
  let current: ChangelogRelease | null = null;
  let section: ChangelogNote | null = null;

  const closeSection = () => {
    if (current && section) {
      current.sections.push(section);
      section = null;
    }
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (t === '' || t === '---') continue;
    // Release heading: ## [x.y.z] — date  (the top "# Changelog" has no brackets -> ignored)
    const rel = /^(#{1,2})\s+\[([^\]]+)\](?:\s*[—-]\s*(.+))?/.exec(t);
    if (rel) {
      closeSection();
      if (current) releases.push(current);
      current = { version: rel[2], date: rel[3]?.trim(), sections: [] };
      section = null;
      continue;
    }
    if (!current) continue;
    // Subsection: ### Added / Changed / Fixed
    const sub = /^###\s+(.+)$/.exec(t);
    if (sub) {
      closeSection();
      section = { type: sub[1].trim(), notes: [] };
      continue;
    }
    // Bullet note (top-level or nested — leading whitespace already trimmed)
    const bullet = /^[-*]\s+(.+)$/.exec(t);
    if (bullet) {
      if (!section) section = { type: 'Notes', notes: [] };
      section.notes.push(bullet[1].trim());
      continue;
    }
    // Wrapped continuation line -> append to the previous note
    if (section && section.notes.length) {
      const last = section.notes.length - 1;
      section.notes[last] = `${section.notes[last]} ${t}`;
    }
  }
  closeSection();
  if (current) releases.push(current);
  return releases;
}

export default function registerChangelog(router: Router): void {
  router.get('/api/changelog', (_req, res) => {
    let md: string;
    try {
      md = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    } catch (e) {
      res.status(404).json({ error: 'changelog not found', detail: e instanceof Error ? e.message : String(e) });
      return;
    }
    const releases = parseChangelog(md);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({ releases, markdown: md });
  });
}
