#!/usr/bin/env node
/**
 * knowledge-universe/duplicates.ts
 *
 * Enhancement 33 — Duplicate-page detection.
 *
 * Scan all .md files under `dir`, hash their contents, and return groups
 * of files that share identical content.
 *
 * Route (wired in server.ts):
 *   GET /api/knowledge/duplicates -> { groups: DuplicateGroup[] }
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

import { fileURLToPath } from 'node:url';
const REPO_ROOT = process.cwd();

export interface DuplicateGroup {
  hash: string;
  files: string[];
}

function findMdFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const walk = (current: string) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(full);
        }
      }
    };
    walk(dir);
  } catch {
    // ignore
  }
  return files;
}

export function findDuplicates(dir: string = REPO_ROOT): DuplicateGroup[] {
  const files = findMdFiles(dir);
  const hashMap = new Map<string, string[]>();

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      const list = hashMap.get(hash) || [];
      list.push(relative(dir, file));
      hashMap.set(hash, list);
    } catch {
      // skip unreadable files
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [hash, fileList] of Array.from(hashMap.entries())) {
    if (fileList.length > 1) {
      groups.push({ hash, files: fileList.sort() });
    }
  }

  return groups.sort((a, b) => a.files[0].localeCompare(b.files[0]));
}
