// Knowledge-graph builder (backlog #40).
// Derives a real graph from the knowledge-universe on-disk state:
//   - audit.jsonl  -> page -> user mutation edges (action-labelled)
//   - acls.json    -> page -> role access edges
//   - analytics.json -> per-page view counts (node meta)
// Falls back to a minimal seed graph when no data is present so the
// endpoint never 500s.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type KGNodeType = "page" | "user" | "role" | "root";

export interface KGNode {
  id: string;
  type: KGNodeType;
  label: string;
  meta?: Record<string, unknown>;
}

export interface KGEdge {
  source: string;
  target: string;
  label: string;
  kind: "mutation" | "access";
}

export interface KnowledgeGraph {
  ok: boolean;
  source: string;
  generated_at: string;
  stats: { pages: number; users: number; roles: number; edges: number };
  nodes: KGNode[];
  edges: KGEdge[];
}

function findUpDir(start: string, rel: string): string | null {
  let cur = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    const cand = path.join(cur, rel);
    try {
      if (fs.existsSync(cand)) return cand;
    } catch {
      /* ignore unreadable candidate */
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function resolveKuDataDir(): string | null {
  const rel = path.join("knowledge-universe", ".data");
  return (
    findUpDir(__dirname, rel) ?? findUpDir(process.cwd(), rel)
  );
}

function readJsonFile<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function readJsonl<T>(p: string): T[] {
  try {
    return fs
      .readFileSync(p, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

export function buildKnowledgeGraph(kuDir?: string): KnowledgeGraph {
  const dir = kuDir ?? resolveKuDataDir();
  const events = dir
    ? readJsonl<{ slug?: string; action?: string; user?: string }>(
        path.join(dir, "audit.jsonl"),
      )
    : [];
  const acls = dir
    ? readJsonFile<Record<string, Record<string, boolean>>>(
        path.join(dir, "acls.json"),
        {},
      )
    : {};
  const analytics = dir
    ? readJsonFile<Record<string, number>>(path.join(dir, "analytics.json"), {})
    : {};

  const pages = new Map<string, KGNode>();
  const users = new Map<string, KGNode>();
  const roles = new Map<string, KGNode>();
  const edges: KGEdge[] = [];

  const pageId = (s: string) => "page:" + s;
  const userId = (u: string) => "user:" + u;
  const roleId = (r: string) => "role:" + r;

  const ensurePage = (slug: string) => {
    const id = pageId(slug);
    if (!pages.has(id)) {
      pages.set(id, {
        id,
        type: "page",
        label: slug,
        meta: { views: analytics[slug] ?? 0 },
      });
    }
    return id;
  };

  for (const e of events) {
    const slug = e.slug ?? "unknown";
    const user = e.user ?? "unknown";
    const pid = ensurePage(slug);
    if (!users.has(userId(user))) {
      users.set(userId(user), { id: userId(user), type: "user", label: user });
    }
    if (e.action) {
      edges.push({
        source: pid,
        target: userId(user),
        label: e.action,
        kind: "mutation",
      });
    }
  }

  for (const [pageSlug, roleMap] of Object.entries(acls)) {
    const pid = ensurePage(pageSlug);
    for (const role of Object.keys(roleMap ?? {})) {
      if (!roles.has(roleId(role))) {
        roles.set(roleId(role), {
          id: roleId(role),
          type: "role",
          label: role,
        });
      }
      edges.push({
        source: pid,
        target: roleId(role),
        label: "acl",
        kind: "access",
      });
    }
  }

  // Graceful fallback when the knowledge-universe has no usable data yet.
  if (pages.size === 0 && users.size === 0 && roles.size === 0) {
    pages.set("page:welcome", {
      id: "page:welcome",
      type: "page",
      label: "welcome",
      meta: { views: 0 },
    });
    users.set("user:system", {
      id: "user:system",
      type: "user",
      label: "system",
    });
    edges.push({
      source: "page:welcome",
      target: "user:system",
      label: "seed",
      kind: "mutation",
    });
  }

  const nodes: KGNode[] = [
    ...pages.values(),
    ...users.values(),
    ...roles.values(),
  ];

  return {
    ok: true,
    source: "knowledge-universe",
    generated_at: new Date().toISOString(),
    stats: {
      pages: pages.size,
      users: users.size,
      roles: roles.size,
      edges: edges.length,
    },
    nodes,
    edges,
  };
}
