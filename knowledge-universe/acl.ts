#!/usr/bin/env node
/**
 * knowledge-universe/acl.ts
 *
 * Enhancements 37 + 39
 *   (37) ACLs per role — access-control list per page/role.
 *   (39) Bulk page mover — batch move pages between folders.
 *
 * Routes (wired in server.ts):
 *   GET    /api/knowledge/acl?slug=        -> { slug, roles: Record<string, boolean> }
 *   POST   /api/knowledge/acl              body: { slug, role, allow } -> { ok: true }
 *   POST   /api/knowledge/move              body: { slugs, targetDir }  -> { moved, failed }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACL_FILE = join(__dirname, '.data', 'acls.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ACLStore {
  [pageSlug: string]: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// ACL helpers
// ---------------------------------------------------------------------------

function readACLStore(): ACLStore {
  try {
    if (existsSync(ACL_FILE)) {
      return JSON.parse(readFileSync(ACL_FILE, 'utf-8'));
    }
  } catch {
    // ignore corrupt file
  }
  return {};
}

function writeACLStore(store: ACLStore): void {
  try {
    const dir = dirname(ACL_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(ACL_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // ignore write errors
  }
}

/**
 * Load the entire ACL map.
 */
export async function loadACLs(): Promise<ACLStore> {
  return readACLStore();
}

/**
 * Check whether a role is allowed to access a page.
 * Missing entries default to `true` (open).
 */
export async function checkAccess(slug: string, role: string): Promise<boolean> {
  const store = readACLStore();
  const pageACLs = store[slug];
  if (!pageACLs) return true;
  return pageACLs[role] ?? true;
}

/**
 * Set the access flag for a role on a page.
 */
export async function setACL(slug: string, role: string, allow: boolean): Promise<void> {
  const store = readACLStore();
  if (!store[slug]) store[slug] = {};
  store[slug][role] = allow;
  writeACLStore(store);
}

/**
 * Remove a role ACL entry for a page.
 */
export async function deleteACL(slug: string, role: string): Promise<void> {
  const store = readACLStore();
  if (store[slug]) {
    delete store[slug][role];
    if (Object.keys(store[slug]).length === 0) {
      delete store[slug];
    }
  }
  writeACLStore(store);
}

// ---------------------------------------------------------------------------
// Bulk page mover
// ---------------------------------------------------------------------------

export interface MoveResult {
  moved: string[];
  failed: string[];
}

/**
 * Batch-move markdown files between folders by slug.
 *
 * Looks for `<slug>.md` under `sourceDir` and moves each to
 * `targetDir/<basename>.md`.  Creates `targetDir` if missing.
 */
export async function bulkMove(
  slugs: string[],
  sourceDir: string,
  targetDir: string,
): Promise<MoveResult> {
  const moved: string[] = [];
  const failed: string[] = [];

  if (!existsSync(targetDir)) {
    try {
      mkdirSync(targetDir, { recursive: true });
    } catch {
      failed.push(...slugs);
      return { moved, failed };
    }
  }

  for (const slug of slugs) {
    try {
      const basename = slug.split('/').pop() || slug;
      const src = join(sourceDir, basename + '.md');
      const dest = join(targetDir, basename + '.md');
      if (existsSync(src)) {
        renameSync(src, dest);
        moved.push(slug);
      } else {
        failed.push(slug);
      }
    } catch {
      failed.push(slug);
    }
  }

  return { moved, failed };
}
