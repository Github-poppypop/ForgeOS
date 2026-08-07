#!/usr/bin/env node
/**
 * knowledge-universe/frontmatter.ts
 *
 * Enhancement 36 — Frontmatter normalization.
 *
 * Parse YAML-style frontmatter from markdown, enforce a minimal schema,
 * and re-serialize.  Missing required fields are filled with sensible
 * defaults.
 *
 * Route (wired in server.ts):
 *   POST /api/knowledge/frontmatter   body: { content } -> { normalized: string }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FrontmatterSchema {
  title?: string;
  date?: string;
  tags?: string[];
  status?: string;
  author?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof FrontmatterSchema)[] = ['title', 'date'];
const DEFAULT_DATE = new Date().toISOString().split('T')[0];

function parseFrontmatter(text: string): { meta: FrontmatterSchema; body: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: text };
  }

  const meta: FrontmatterSchema = {};
  const body = match[2];
  const fmText = match[1];

  for (const line of fmText.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim() as keyof FrontmatterSchema;
    let value = line.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1);
      meta[key] = value.split(',').map(s => s.trim()).filter(Boolean) as any;
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      meta[key] = value.slice(1, -1);
    } else {
      meta[key] = value;
    }
  }

  return { meta, body };
}

function serializeFrontmatter(meta: FrontmatterSchema, body: string): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: "${String(value)}"`);
    }
  }
  lines.push('---', '', body);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize frontmatter: ensure required fields exist and re-serialize.
 */
export function normalizeFrontmatter(text: string): string {
  const { meta, body } = parseFrontmatter(text);

  for (const field of REQUIRED_FIELDS) {
    if (!meta[field]) {
      if (field === 'date') {
        meta[field] = DEFAULT_DATE;
      } else if (field === 'title') {
        const h1 = body.match(/^#\s+(.+)$/m);
        meta[field] = h1 ? h1[1].trim() : 'Untitled';
      }
    }
  }

  if (meta.tags && !Array.isArray(meta.tags)) {
    meta.tags = [String(meta.tags)];
  }

  return serializeFrontmatter(meta, body);
}
