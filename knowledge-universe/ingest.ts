#!/usr/bin/env node
/**
 * knowledge-universe/ingest.ts — ForgeOS Knowledge Universe CLI
 *
 * Ingest markdown/YAML into chunked, (optionally) embedded, retrievable records.
 *
 * Commands
 *   ingest  <path> [--format markdown|yaml]  Read a file and emit chunk records to stdout
 *   chunk   <path>                           Split a file into chunks
 *   embed   <path>                           Chunk + attach stub embeddings
 *   search  <query>                          Retrieve chunks matching a query
 *
 * No external embedding service is required at bootstrap; embed produces
 * deterministic stub vectors so the pipeline is testable.  Swap the embedder
 * function for a real OpenAI/Cohere/Gemini call when ready.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

import type {
  ActionCategory,
  Chunk,
  EmbeddedChunk,
  IngestSource,
  RetrievalResult,
} from '../packages/shared/src/types';

/* ─────────────────────────────────────────────
 * Chunking
 * ───────────────────────────────────────────── */

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP = 200;

interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

/**
 * Split markdown/YAML text into chunks.
 *
 * Strategy:
 *  - For Markdown: prefer breaking on `## ` / `### ` headings so chunks
 *    stay topic-aligned.  Fall back to character windows for oversized
 *    sections.
 *  - For YAML: split on document boundaries (`---`), then window if needed.
 */
export function chunkText(
  text: string,
  format: 'markdown' | 'yaml',
  opts: ChunkOptions = {},
): Chunk[] {
  const { maxChars = DEFAULT_MAX_CHARS, overlap = DEFAULT_OVERLAP } = opts;
  const chunks: Chunk[] = [];

  if (format === 'markdown') {
    const headingRe = /^#{1,6}\s+.+$/gm;
    const indices = Array.from(text.matchAll(headingRe)).map((m) => m.index!);

    let currentHeading: string | undefined;
    let start = 0;

    for (const idx of indices) {
      if (idx > start) {
        const section = text.slice(start, idx).trim();
        if (section.length > 0) {
          chunks.push(...windowChunk(section, currentHeading, maxChars, overlap));
        }
      }
      const headingText = text.slice(idx).split('\n')[0].trim();
      currentHeading = headingText.replace(/^#+\s*/, '');
      start = idx;
    }

    const tail = text.slice(start).trim();
    if (tail.length > 0) {
      chunks.push(...windowChunk(tail, currentHeading, maxChars, overlap));
    }
  } else {
    // YAML: split on document separator first
    const docs = text.split(/^---\s*$/gm).filter((d) => d.trim().length > 0);
    for (const doc of docs) {
      const trimmed = doc.trim();
      chunks.push(...windowChunk(trimmed, undefined, maxChars, overlap));
    }
  }

  return chunks;
}

function windowChunk(
  text: string,
  heading: string | undefined,
  maxChars: number,
  overlap: number,
): Chunk[] {
  if (text.length <= maxChars) {
    return [
      {
        id: crypto.randomUUID(),
        sourcePath: '',
        text,
        heading,
        tags: [],
        metadata: { length: text.length },
      },
    ];
  }

  const out: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    // Try to break on a paragraph boundary
    if (end < text.length) {
      const nl = text.lastIndexOf('\n\n', end);
      const space = text.lastIndexOf('. ', end);
      const breakAt = nl > start + maxChars * 0.5 ? nl : space > start + maxChars * 0.5 ? space + 1 : end;
      if (breakAt > start) end = breakAt;
    }
    const slice = text.slice(start, end).trim();
    if (slice.length > 0) {
      out.push({
        id: crypto.randomUUID(),
        sourcePath: '',
        text: slice,
        heading,
        tags: [],
        metadata: { length: slice.length, windowStart: start, windowEnd: end },
      });
    }
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return out;
}

/* ─────────────────────────────────────────────
 * Embedding (pluggable)
 * ───────────────────────────────────────────── */

export interface Embedder {
  (text: string): Promise<number[]>;
}

const stubEmbeddingLength = 16;

export function stubEmbedder(text: string): number[] {
  // Deterministic pseudo-vector from character codes so tests are stable.
  const vec = new Array(stubEmbeddingLength).fill(0);
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
    vec[i % stubEmbeddingLength] += h;
  }
  // Normalize to unit length-ish
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function embedChunks(
  chunks: Chunk[],
  embedder: Embedder = stubEmbedder,
): Promise<EmbeddedChunk[]> {
  const out: EmbeddedChunk[] = [];
  for (const chunk of chunks) {
    const embedding = await embedder(chunk.text);
    out.push({ ...chunk, embedding });
  }
  return out;
}

/* ─────────────────────────────────────────────
 * Retrieval (keyword / BM25-lite)
 * ───────────────────────────────────────────── */

export interface RetrievalIndex {
  chunks: Chunk[];
  /** term -> doc frequency */
  df: Map<string, number>;
}

export function buildIndex(chunks: Chunk[]): RetrievalIndex {
  const df = new Map<string, number>();
  const docs = chunks.map((chunk) => {
    const terms = tokenize(chunk.text);
    const seen = new Set<string>();
    for (const t of terms) {
      df.set(t, (df.get(t) || 0) + 1);
      seen.add(t);
    }
    return { chunk, terms, tf: new Map<string, number>() };
  });

  for (const doc of docs) {
    for (const t of doc.terms) {
      doc.tf.set(t, (doc.tf.get(t) || 0) + 1);
    }
  }

  return { chunks, df };
}

export function search(
  query: string,
  index: RetrievalIndex,
  topK = 10,
): RetrievalResult[] {
  const terms = tokenize(query);
  const scored = index.chunks.map((chunk) => {
    let score = 0;
    for (const t of terms) {
      const tf = (() => {
        // Recompute TF on the fly from the chunk text
        const docTerms = tokenize(chunk.text);
        const tfMap = new Map<string, number>();
        for (const dt of docTerms) tfMap.set(dt, (tfMap.get(dt) || 0) + 1);
        return tfMap.get(t) || 0;
      })();
      const df = index.df.get(t) || 0;
      if (tf > 0 && df > 0) {
        // BM25-ish score (k1=1.2, b=0.75 approximated)
        const idf = Math.log(1 + (index.chunks.length - df + 0.5) / (df + 0.5));
        score += tf * idf;
      }
    }
    return { chunk, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/* ─────────────────────────────────────────────
 * Source discovery & parsing
 * ───────────────────────────────────────────── */

export function resolveSource(input: string): IngestSource | null {
  const path = resolve(input);
  if (!existsSync(path)) {
    return null;
  }
  const stat = statSync(path);
  if (stat.isDirectory()) {
    return { path, format: 'markdown' }; // default for dirs
  }
  const ext = extname(path).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return { path, format: 'markdown' };
  if (ext === '.yaml' || ext === '.yml') return { path, format: 'yaml' };
  return null;
}

export function readSource(source: IngestSource): string {
  return readFileSync(source.path, 'utf-8');
}

/* ─────────────────────────────────────────────
 * CLI
 * ───────────────────────────────────────────── */

interface CliArgs {
  command: string;
  path?: string;
  query?: string;
  format?: 'markdown' | 'yaml';
  topK?: number;
}

function printChunk(chunk: Chunk): void {
  console.log(`--- chunk ${chunk.id} ---`);
  if (chunk.heading) console.log(`heading: ${chunk.heading}`);
  console.log(chunk.text);
  console.log(`tags: ${chunk.tags.join(', ')}`);
  console.log(`meta: ${JSON.stringify(chunk.metadata)}`);
}

function printEmbedded(chunk: EmbeddedChunk): void {
  printChunk(chunk);
  console.log(`embedding: [${chunk.embedding.map((v) => v.toFixed(4)).join(', ')}]`);
}

function printResult(result: RetrievalResult): void {
  console.log(`--- result score=${result.score.toFixed(4)} ---`);
  printChunk(result.chunk);
}

function parseArgs(argv: string[]): CliArgs {
  const [,, command, ...rest] = argv;
  if (!command) {
    printHelp();
    process.exit(1);
  }
  const args: CliArgs = { command };
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--format' || token === '-f') {
      const fmt = rest[++i];
      if (fmt !== 'markdown' && fmt !== 'yaml') {
        console.error(`Unknown format: ${fmt}`);
        process.exit(1);
      }
      args.format = fmt;
    } else if (token === '--top' || token === '-k') {
      args.topK = parseInt(rest[++i], 10) || 10;
    } else if (!token.startsWith('-')) {
      if (command === 'search') args.query = token;
      else args.path = token;
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
ForgeOS Knowledge Universe — Ingest CLI

Usage:
  tsx knowledge-universe/ingest.ts ingest <path> [--format markdown|yaml]
  tsx knowledge-universe/ingest.ts chunk   <path> [--format markdown|yaml]
  tsx knowledge-universe/ingest.ts embed   <path> [--format markdown|yaml]
  tsx knowledge-universe/ingest.ts search  <query>

Commands:
  ingest   Read file(s), chunk, embed, and emit records to stdout
  chunk    Split file into chunks and print them
  embed    Chunk + attach deterministic stub embeddings
  search   Retrieve chunks matching a query from a built index
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  switch (args.command) {
    case 'ingest': {
      if (!args.path) {
        console.error('Missing path for ingest.');
        process.exit(1);
      }
      const source = resolveSource(args.path);
      if (!source) {
        console.error(`Path not found or unsupported: ${args.path}`);
        process.exit(1);
      }
      const text = readSource(source);
      const chunks = chunkText(text, source.format);
      const embedded = await embedChunks(chunks);
      for (const chunk of embedded) printEmbedded(chunk);
      break;
    }
    case 'chunk': {
      if (!args.path) {
        console.error('Missing path for chunk.');
        process.exit(1);
      }
      const source = resolveSource(args.path);
      if (!source) {
        console.error(`Path not found or unsupported: ${args.path}`);
        process.exit(1);
      }
      const text = readSource(source);
      const chunks = chunkText(text, source.format);
      for (const chunk of chunks) printChunk(chunk);
      break;
    }
    case 'embed': {
      if (!args.path) {
        console.error('Missing path for embed.');
        process.exit(1);
      }
      const source = resolveSource(args.path);
      if (!source) {
        console.error(`Path not found or unsupported: ${args.path}`);
        process.exit(1);
      }
      const text = readSource(source);
      const chunks = chunkText(text, source.format);
      const embedded = await embedChunks(chunks);
      for (const chunk of embedded) printEmbedded(chunk);
      break;
    }
    case 'search': {
      if (!args.query) {
        console.error('Missing query for search.');
        process.exit(1);
      }
      // Build an index from the knowledge-universe directory if no path given
      const knowledgeDir = join(__dirname, '..', '..');
      const source = resolveSource(knowledgeDir);
      const chunks: Chunk[] = [];
      if (source) {
        const text = readSource(source);
        chunks.push(...chunkText(text, source.format));
      }
      // Also ingest any immediate markdown/yaml files
      if (existsSync(knowledgeDir) && statSync(knowledgeDir).isDirectory()) {
        for (const entry of readdirSync(knowledgeDir)) {
          const full = join(knowledgeDir, entry);
          if (statSync(full).isFile()) {
            const s = resolveSource(full);
            if (s) {
              const t = readSource(s);
              chunks.push(...chunkText(t, s.format));
            }
          }
        }
      }
      const index = buildIndex(chunks);
      const results = search(args.query, index, args.topK || 10);
      for (const result of results) printResult(result);
      break;
    }
    default: {
      console.error(`Unknown command: ${args.command}`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
