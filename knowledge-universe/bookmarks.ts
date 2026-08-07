#!/usr/bin/env node
/**
 * knowledge-universe/bookmarks.ts
 *
 * Enhancement 34 — Semantic bookmarking.
 *
 * Tag pages and persist bookmarks.  Bookmarks are stored as JSON so they
 * survive restarts.
 *
 * Routes (wired in server.ts):
 *   POST /api/knowledge/bookmarks   body: { slug, tags, user? } -> { ok: true }
 *   GET  /api/knowledge/bookmarks?tags=  -> Bookmark[]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKMARKS_FILE = join(__dirname, '.data', 'bookmarks.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Bookmark {
  slug: string;
  tags: string[];
  user?: string;
  created: string;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readBookmarks(): Bookmark[] {
  try {
    if (existsSync(BOOKMARKS_FILE)) {
      return JSON.parse(readFileSync(BOOKMARKS_FILE, 'utf-8'));
    }
  } catch {
    // ignore corrupt file
  }
  return [];
}

function writeBookmarks(bookmarks: Bookmark[]): void {
  try {
    const dir = dirname(BOOKMARKS_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2), 'utf-8');
  } catch {
    // ignore write errors
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add or update a bookmark for a page.
 */
export async function addBookmark(slug: string, tags: string[], user?: string): Promise<void> {
  const bookmarks = readBookmarks();
  const existing = bookmarks.findIndex(b => b.slug === slug && b.user === user);
  const bookmark: Bookmark = { slug, tags, user, created: new Date().toISOString() };
  if (existing >= 0) {
    bookmarks[existing] = bookmark;
  } else {
    bookmarks.push(bookmark);
  }
  writeBookmarks(bookmarks);
}

/**
 * Retrieve bookmarks, optionally filtered by tags.
 */
export async function getBookmarks(tags?: string[]): Promise<Bookmark[]> {
  let bookmarks = readBookmarks();
  if (tags && tags.length > 0) {
    bookmarks = bookmarks.filter(b => tags.some(t => b.tags.includes(t)));
  }
  return bookmarks.sort((a, b) => b.created.localeCompare(a.created));
}

/**
 * Remove a bookmark.
 */
export async function removeBookmark(slug: string, user?: string): Promise<void> {
  const bookmarks = readBookmarks().filter(b => !(b.slug === slug && b.user === user));
  writeBookmarks(bookmarks);
}
