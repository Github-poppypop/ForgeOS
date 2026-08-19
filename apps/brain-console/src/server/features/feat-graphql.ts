// GraphQL endpoint with depth & complexity limiting.
// Self-contained feature: discovers nothing, just registers routes on the
// runtime router. Loaded by features/loader.ts. No edits to runtime.ts.
//
// The `graphql` package is not a project dependency, so we guard the query by
// (1) counting brace-nesting depth and (2) counting field-selection nodes via a
// lightweight scan. Both are crash-proof (wrapped in try/catch) so a malformed
// query yields a 400 instead of crashing the server.
import express from 'express';
import type { Router } from 'express';

const MAX_DEPTH = 8;
const MAX_COMPLEXITY = 200;

// Remove string literals and comments so braces/identifiers inside them never
// affect the guards.
function stripStringsAndComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '"') {
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '"') { i++; break; }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Max brace-nesting depth of '{' in the (stripped) query.
export function computeDepth(query: string): number {
  const s = stripStringsAndComments(query);
  let depth = 0;
  let max = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      depth++;
      if (depth > max) max = depth;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

// Count field-selection nodes (each field = 1).
export function computeComplexity(query: string): number {
  const s = stripStringsAndComments(query);
  const keywords = new Set(['on', 'true', 'false', 'null', 'fragment', 'query', 'mutation', 'subscription']);
  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_]/.test(c);
  let complexity = 0;
  let depth = 0;
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (ch === '(') {
      let d = 1;
      i++;
      while (i < n && d > 0) {
        if (s[i] === '(') d++;
        else if (s[i] === ')') d--;
        i++;
      }
      continue;
    }
    if (ch === '@') {
      i++;
      while (i < n && !/\s/.test(s[i]) && s[i] !== '{' && s[i] !== '}') i++;
      continue;
    }
    if (ch === '$') {
      i++;
      while (i < n && isIdent(s[i])) i++;
      continue;
    }
    if (ch === '.') {
      if (s[i + 1] === '.' && s[i + 2] === '.') {
        i += 3;
        continue;
      }
    }
    if (isIdentStart(ch)) {
      let j = i;
      while (j < n && isIdent(s[j])) j++;
      const ident = s.slice(i, j);
      i = j;
      let k = i;
      while (k < n && /\s/.test(s[k])) k++;
      if (s[k] === ':') {
        // alias: the real field name follows and will be counted in its turn
        i = k + 1;
        continue;
      }
      if (depth > 0 && !keywords.has(ident)) complexity++;
      continue;
    }
    i++;
  }
  return complexity;
}

interface GField {
  name: string;
  alias: string;
  selections: GField[];
}

// Minimal tolerant parser: builds the root selection set so we can resolve a
// small fixed schema. Unknown fields resolve to null (harmless).
function parseQuery(query: string): GField[] {
  let i = 0;
  const n = query.length;

  function skipWs() {
    while (i < n) {
      const c = query[i];
      if (c === ' ' || c === '\n' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '#') { while (i < n && query[i] !== '\n') i++; continue; }
      break;
    }
  }
  function readIdent(): string {
    let j = i;
    while (j < n && /[A-Za-z0-9_]/.test(query[j])) j++;
    const s = query.slice(i, j);
    i = j;
    return s;
  }
  function skipParen(start: number): number {
    let d = 0;
    let k = start;
    while (k < n) {
      if (query[k] === '(') d++;
      else if (query[k] === ')') { d--; if (d === 0) { k++; break; } }
      k++;
    }
    return k;
  }
  function parseSelectionSet(): GField[] {
    skipWs();
    if (query[i] !== '{') return [];
    i++;
    const fields: GField[] = [];
    while (i < n) {
      skipWs();
      const c = query[i];
      if (c === '}') { i++; break; }
      if (c === '.' && query[i + 1] === '.' && query[i + 2] === '.') {
        i += 3;
        skipWs();
        if (query[i] === 'o' && query[i + 1] === 'n') {
          i += 2;
          readIdent();
        } else {
          readIdent();
        }
        skipWs();
        if (query[i] === '{') {
          fields.push(...parseSelectionSet());
        }
        continue;
      }
      if (c === '@') {
        i++;
        readIdent();
        skipWs();
        if (query[i] === '(') i = skipParen(i);
        continue;
      }
      let name = readIdent();
      if (!name) break;
      skipWs();
      let alias = '';
      if (query[i] === ':') { i++; alias = name; name = readIdent(); skipWs(); }
      if (query[i] === '(') { i = skipParen(i); skipWs(); }
      while (query[i] === '@') { i++; readIdent(); skipWs(); if (query[i] === '(') i = skipParen(i); skipWs(); }
      let selections: GField[] = [];
      if (query[i] === '{') selections = parseSelectionSet();
      fields.push({ name, alias, selections });
    }
    return fields;
  }

  while (i < n) {
    skipWs();
    const c = query[i];
    if (c === '{') return parseSelectionSet();
    if (/[A-Za-z_]/.test(c)) {
      readIdent();
      skipWs();
      if (/[A-Za-z_]/.test(query[i])) { readIdent(); skipWs(); }
      if (query[i] === '(') { i = skipParen(i); skipWs(); }
      if (query[i] === '@') { i++; readIdent(); if (query[i] === '(') i = skipParen(i); skipWs(); }
      if (query[i] === '{') return parseSelectionSet();
    }
    i++;
  }
  return [];
}

const resolvers: Record<string, unknown> = {
  hello: 'world',
  server: () => ({
    name: 'forgeos-brain-console',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    node: process.version,
  }),
  health: () => ({ ok: true, status: 'healthy' }),
  limits: () => ({ maxDepth: MAX_DEPTH, maxComplexity: MAX_COMPLEXITY }),
  now: () => new Date().toISOString(),
};

function execObject(fields: GField[], root: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const key = f.alias || f.name;
    const rec = (typeof root === 'object' && root !== null ? root : {}) as Record<string, unknown>;
    const value = rec[f.name];
    if (f.selections.length === 0) {
      out[key] = value ?? null;
    } else if (typeof value === 'function') {
      out[key] = execObject(f.selections, (value as () => unknown)());
    } else if (value !== null && value !== undefined) {
      out[key] = execObject(f.selections, value);
    } else {
      out[key] = null;
    }
  }
  return out;
}

function execute(query: string): Record<string, unknown> {
  const rootFields = parseQuery(query);
  return execObject(rootFields, resolvers);
}

export default function registerGraphql(router: Router): void {
  // Expose current guard limits.
  router.get('/api/graphql/limits', (_req, res) => {
    res.type('application/json; charset=utf-8').json({ maxDepth: MAX_DEPTH, maxComplexity: MAX_COMPLEXITY });
  });

  router.post('/api/graphql', express.json(), (req, res) => {
    const body = (req.body ?? {}) as { query?: unknown; variables?: unknown };
    const query = typeof body.query === 'string' ? body.query : '';
    if (!query) {
      return res.status(400).json({ errors: [{ message: 'Query required' }] });
    }

    let depth = 0;
    try {
      depth = computeDepth(query);
    } catch {
      depth = 0;
    }
    if (depth > MAX_DEPTH) {
      return res.status(400).json({ errors: [{ message: 'Query too deep' }] });
    }

    let complexity = 0;
    try {
      complexity = computeComplexity(query);
    } catch {
      complexity = 0;
    }
    if (complexity > MAX_COMPLEXITY) {
      return res.status(400).json({ errors: [{ message: 'Query too complex' }] });
    }

    try {
      const data = execute(query);
      return res.status(200).type('application/json; charset=utf-8').json({ data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ errors: [{ message: 'Query parse error: ' + message }] });
    }
  });
}
