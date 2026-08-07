#!/usr/bin/env node
/**
 * knowledge-universe/link-checker.ts
 *
 * Enhancements 32 + 40
 *   (32) Link-health checker — crawl internal markdown links, report broken refs.
 *   (40) Knowledge graph endpoint — build nodes/edges JSON from page links.
 *
 * Routes (wired in server.ts):
 *   GET /api/knowledge/links        -> { broken: BrokenLink[] }
 *   GET /api/knowledge/graph        -> { nodes: GraphNode[]; edges: GraphEdge[] }
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Link {
  source: string;
  target: string;
  line?: number;
}

export interface BrokenLink {
  source: string;
  target: string;
  reason: string;
}

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    // ignore permission errors
  }
  return files;
}

function extractLinks(content: string, filePath: string): Link[] {
  const links: Link[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Wiki-style links: [[target]] or [[target|label]]
    const wikiRe = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
    let m;
    while ((m = wikiRe.exec(line)) !== null) {
      links.push({ source: filePath, target: m[1].trim(), line: i + 1 });
    }

    // Markdown inline links: [text](target) — ignore http(s) and anchors
    const mdRe = /\[([^\]]*)\]\(([^)]+)\)/g;
    while ((m = mdRe.exec(line)) !== null) {
      const target = m[2].trim();
      if (!/^(https?:|#|mailto:)/.test(target)) {
        links.push({ source: filePath, target, line: i + 1 });
      }
    }

    // Reference-style links: [text][ref]
    const refRe = /\[([^\]]+)\]\[([^\]]+)\]/g;
    while ((m = refRe.exec(line)) !== null) {
      const ref = m[2].trim();
      if (!ref.startsWith('http') && !ref.startsWith('#')) {
        links.push({ source: filePath, target: ref, line: i + 1 });
      }
    }
  }

  return links;
}

function resolveTarget(baseDir: string, target: string): string {
  if (target.startsWith('/')) {
    return join(baseDir, target);
  }
  return join(baseDir, target);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan all .md files under `dir` and return internal links that point to
 * missing targets.
 */
export function checkLinks(dir: string = REPO_ROOT): BrokenLink[] {
  const files = findMdFiles(dir);
  const broken: BrokenLink[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const links = extractLinks(content, file);
    const fileDir = dirname(file);

    for (const link of links) {
      const resolved = resolveTarget(fileDir, link.target);
      const candidates = [
        resolved,
        resolved + '.md',
        join(resolved, 'index.md'),
        join(resolved, 'README.md'),
      ];

      const exists = candidates.some(c => {
        try { return statSync(c).isFile(); } catch { return false; }
      });

      if (!exists) {
        broken.push({
          source: relative(dir, file),
          target: link.target,
          reason: `target not found (tried: ${candidates.map(c => relative(dir, c)).join(', ')})`,
        });
      }
    }
  }

  return broken;
}

/**
 * Build a simple knowledge graph: nodes = markdown files, edges = internal links.
 */
export function buildGraph(dir: string = REPO_ROOT): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const files = findMdFiles(dir);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // Normalize a file path to a stable graph node id
  const nodeId = (file: string) => relative(dir, file).replace(/\\/g, '/').replace(/\.md$/, '');

  // First pass: create nodes
  for (const file of files) {
    const id = nodeId(file);
    const node: GraphNode = { id, label: id.split('/').pop() || id };
    nodes.push(node);
    nodeMap.set(id, node);
  }

  // Second pass: create edges from internal links
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const links = extractLinks(content, file);
    const sourceId = nodeId(file);
    const fileDir = dirname(file);

    for (const link of links) {
      let targetId = link.target;
      if (targetId.endsWith('.md')) {
        targetId = targetId.slice(0, -3);
      }
      if (targetId.startsWith('./')) {
        targetId = targetId.slice(2);
      }
      if (targetId.startsWith('../')) {
        // Resolve upward if possible
        const resolved = resolveTarget(fileDir, targetId);
        targetId = relative(dir, resolved).replace(/\\/g, '/').replace(/\.md$/, '');
      }
      targetId = targetId.replace(/\\/g, '/');

      if (nodeMap.has(targetId)) {
        edges.push({ source: sourceId, target: targetId });
      }
    }
  }

  return { nodes, edges };
}
