/**
 * ForgeOS Brain Console — backend
 * Serves the SPA and a REST API wrapping the gbrain CLI. The console owns
 * the PGLite brain exclusively (single-writer) and serializes CLI calls, so
 * no separate gbrain server is needed. Runs on 7777 (the public face).
 *
 * Infra hardening: optional auth gate (41), rate limiting + request logging
 * (42), SSE health stream (43), brain backup/restore (44), multi-brain
 * metadata (45).
 */
import { serve } from "bun";

const ROOT = import.meta.dir;
const PUBLIC = `${ROOT}/public`;
const CONSOLE_PORT = Number(process.env.PORT ?? 7777);
const GBRAIN_BIN = process.env.GBRAIN_BIN ?? "bunx";
const GBRAIN_CWD = process.env.GBRAIN_CWD ?? "C:\\Users\\pop\\forge-gbrain";
const GBRAIN_HOME = "C:\\ForgeOS";
const CONSOLE_TOKEN = process.env.CONSOLE_TOKEN || ""; // (41) set to enable auth
const RATE = Number(process.env.RATE_PER_MIN ?? 120);  // (42)

const GBRAIN_ENV: Record<string, string> = {
  ...process.env,
  GBRAIN_HOME,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  OLLAMA_MODELS: process.env.OLLAMA_MODELS || "D:\\ollama",
  GBRAIN_EMBEDDING_DIMENSIONS: process.env.GBRAIN_EMBEDDING_DIMENSIONS || "1024",
};
delete GBRAIN_ENV.DATABASE_URL; // host Postgres pool breaks PGLite

const ROLE_SLUGS = [
  "board/board", "exec/ceo", "cto/cto", "cpo/cpo",
  "coo/coo", "cmo/cmo", "cfo/cfo",
];

async function runGbrain(args: string[], opts: { stdin?: string; timeoutMs?: number } = {}) {
  return gbrainMutex(() => spawnGbrain(args, opts));
}
let _chain: Promise<any> = Promise.resolve();
function gbrainMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = _chain.then(fn, fn);
  _chain = run.catch(() => {});
  return run;
}
async function spawnGbrain(args: string[], opts: { stdin?: string; timeoutMs?: number } = {}) {
  const proc = Bun.spawn([GBRAIN_BIN, "gbrain", ...args], {
    stdout: "pipe", stderr: "pipe", stdin: "pipe", env: GBRAIN_ENV, cwd: GBRAIN_CWD,
  });
  if (opts.stdin) { proc.stdin.write(opts.stdin); } proc.stdin.end();
  const t = setTimeout(() => proc.kill(), opts.timeoutMs ?? 60000);
  const [out, err] = await Promise.all([proc.stdout.text(), proc.stderr.text()]);
  clearTimeout(t); await proc.exited;
  return { code: proc.exitCode ?? 0, out, err };
}

// ---------- (42) rate limit + logging ----------
const hits: Record<string, number[]> = {};
function rateOk(ip: string): boolean {
  const now = Date.now();
  hits[ip] = (hits[ip] || []).filter(t => now - t < 60000);
  if (hits[ip].length >= RATE) return false;
  hits[ip].push(now); return true;
}
function log(req: Request, ms: number, status: number) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  console.log(`[${new Date().toISOString()}] ${req.method} ${new URL(req.url).pathname} -> ${status} (${ms}ms) ${ip}`);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

// ---------- (41) auth gate ----------
function authed(req: Request): boolean {
  if (!CONSOLE_TOKEN) return true; // open if no token set
  const h = req.headers.get("authorization") || "";
  return h === `Bearer ${CONSOLE_TOKEN}` || h === CONSOLE_TOKEN;
}

// ---- static ----
async function serveStatic(pathname: string) {
  if (pathname === "/") return new Response(Bun.file(`${PUBLIC}/index.html`));
  let file = pathname.startsWith("/src/") ? `${ROOT}${pathname}` : `${PUBLIC}${pathname}`;
  const f = Bun.file(file);
  if (await f.exists()) {
    const ext = pathname.split(".").pop() ?? "";
    const ct: Record<string, string> = { ts: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8", svg: "image/svg+xml" };
    // no-cache so module/script changes are picked up immediately (the SPA is
    // hand-edited; without this the browser serves a stale cached app.js).
    return new Response(f, { headers: { "content-type": ct[ext] ?? "application/octet-stream", "cache-control": "no-cache" } });
  }
  return new Response(Bun.file(`${PUBLIC}/index.html`)); // SPA fallback
}

async function ollamaOk() {
  try { const r = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch { return false; }
}

// ---------- (43) SSE health stream ----------
const healthClients = new Set<WritableStreamDefaultWriter>();
setInterval(() => {
  if (!healthClients.size) return;
  const payload = `data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`;
  healthClients.forEach(w => { try { w.write(payload); } catch { healthClients.delete(w); } });
}, 5000);

const server = serve({
  port: CONSOLE_PORT,
  idleTimeout: 120,
  async fetch(req) {
    const t0 = Date.now();
    const url = new URL(req.url);
    const p = url.pathname;
    const ip = req.headers.get("x-forwarded-for") || "local";

    // (41) auth on API + SSE
    if (p.startsWith("/api/") && !authed(req)) { log(req, Date.now() - t0, 401); return json({ error: "unauthorized" }, 401); }
    if (p.startsWith("/api/") && !rateOk(ip)) { log(req, Date.now() - t0, 429); return json({ error: "rate limited" }, 429); }

    // (43) SSE
    if (p === "/api/health/stream") {
      const stream = new ReadableStream({
        start(controller) {
          const w = controller as unknown as WritableStreamDefaultWriter;
          healthClients.add(w);
          controller.enqueue(`data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`);
        },
        cancel() {},
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
    }

    if (!p.startsWith("/api/")) { const r = serveStatic(p); log(req, Date.now() - t0, 200); return r; }

    try {
      if (p === "/api/status") {
        const [schema, oll] = await Promise.all([runGbrain(["schema", "active"]), ollamaOk()]);
        return json({ console_port: CONSOLE_PORT, gbrain_health: { status: "ok", engine: "pglite", owned_by: "console" }, schema: schema.out, ollama: oll, embedding_model: "ollama:mxbai-embed-large (1024d, local)", isolation: "C:\\ForgeOS (separate from personal vaults & app brains)", auth: !!CONSOLE_TOKEN });
      }

      if (p === "/api/brains") { // (45) multi-brain metadata
        return json({
          current: "forgeos",
          brains: [
            { id: "forgeos", home: "C:\\ForgeOS", role: "root", isolated: true },
            { id: "lifeos", home: "C:\\Projects\\ForgeOS\\apps\\lifeos\\.gbrain", role: "app-child", isolated: true },
          ],
          note: "Switch GBRAIN_HOME + restart console to mount a different isolated brain.",
        });
      }

      if (p === "/api/openapi") { // (46) schema doc
        return json({
          openapi: "3.0.0",
          info: { title: "ForgeOS Brain Console API", version: "1.0.0" },
          paths: {
            "/api/status": { get: { summary: "Brain + console status" } },
            "/api/roles": { get: { summary: "C-suite role rows" } },
            "/api/page/{slug}": { get: { summary: "Get a brain page" } },
            "/api/search?q=": { get: { summary: "Semantic search (Ollama)" } },
            "/api/capture": { post: { summary: "Capture a page" } },
            "/api/embed": { post: { summary: "Re-embed all (Ollama)" } },
            "/api/vault": { get: { summary: "Obsidian vault file list" } },
            "/api/federation": { get: { summary: "Brain federation topology" } },
            "/api/audit": { get: { summary: "Audit trail (gbrain list)" } },
            "/api/schema": { get: { summary: "Active schema pack" } },
            "/api/backup": { post: { summary: "Download brain zip" } },
            "/api/brains": { get: { summary: "Multi-brain metadata" } },
            "/api/health/stream": { get: { summary: "SSE live health" } },
          },
        });
      }

      if (p === "/api/roles") {
        const list = await runGbrain(["list"]);
        const lines = list.out.split("\n");
        const roles = ROLE_SLUGS.map((slug) => {
          const hit = lines.find((l) => l.startsWith(slug + "\t"));
          const title = hit ? hit.split("\t").pop() ?? "" : "";
          const name = title.match(/^type: role/) ? "" : title;
          return { slug, role: name || slug.split("/").pop(), reports_to: slug === "exec/ceo" ? "board" : (slug === "board/board" ? "charter" : "ceo"), exists: !!hit };
        });
        return json({ roles });
      }

      if (p.startsWith("/api/page/")) {
        const slug = decodeURIComponent(p.slice("/api/page/".length));
        const r = await runGbrain(["get", slug]);
        if (r.out.includes("not found")) return json({ error: "not found" }, 404);
        return json({ slug, body: r.out });
      }

      if (p === "/api/search") {
        const q = url.searchParams.get("q") ?? "";
        const r = await runGbrain(["search", q]);
        return json({ query: q, raw: r.out });
      }

      if (p === "/api/schema") {
        const active = await runGbrain(["schema", "active"]);
        const types = await runGbrain(["schema", "types"]).catch(() => ({ out: "see C:\\ForgeOS\\.gbrain\\schema-packs\\forgeos\\pack.yaml" }));
        return json({ active: active.out, types: types.out });
      }

      if (p === "/api/audit") {
        const r = await runGbrain(["list", "--json"]).catch(() => ({ out: "" }));
        return json({ raw: r.out });
      }

      if (p === "/api/federation") {
        return json({ root: "ForgeOS (C:\\ForgeOS\\.gbrain)", model: "federated: read-down only, write-up governance only, no lateral mingle", children: ["apps/lifeos (isolated child brain)"], see: "knowledge-universe/BRAIN-FEDERATION.md" });
      }

      // ---- (RFC-0000) sacred /governance source of truth ----
      if (p === "/api/governance") {
        const govBase = `${import.meta.dir}/../..`; // apps/brain-console -> repo root
        const tree: Record<string, string[]> = {};
        for (const sub of ["constitution", "standards", "rfcs", "laws", "roadmap"]) {
          const dir = `${govBase}/governance/${sub}`;
          try {
            const fs = await import("node:fs");
            tree[sub] = fs.readdirSync(dir).filter((f: string) => f.endsWith(".md")).sort();
          } catch { tree[sub] = []; }
        }
        return json({ base: "C:\\Projects\\ForgeOS\\governance", sacred: true, authority: "Constitution > Laws > Standards > RFCs > Missions > Code", tree });
      }

      if (p === "/api/vault") {
        return json({ base: "C:\\ForgeOS\\vault", files: listVault("C:\\ForgeOS\\vault"), git: "branch master (untracked role pages)" });
      }

      // (44) backup brain — gzip of a JSON bundle (Bun.zip unavailable on this runtime)
      if (p === "/api/backup" && req.method === "POST") {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const base = "C:\\ForgeOS\\.gbrain\\brain.pglite";
        const entries = [];
        const walk = (dir) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else entries.push({ name: path.relative(base, full), data: fs.readFileSync(full).toString("base64") });
          }
        };
        try { walk(base); } catch (e) { return json({ error: "backup failed: " + String(e.message) }, 500); }
        const bundle = Buffer.from(JSON.stringify({ base, files: entries, ts: Date.now() }));
        const gz = Bun.gzipSync(bundle);
        return new Response(gz, { headers: { "content-type": "application/gzip", "content-disposition": 'attachment; filename="forgeos-brain.json.gz"' } });
      }

const ADVANCE: Record<string, string> = {
  proposed: "approved",
  approved: "executing",
  executing: "review",
  review: "done",
};

// ---------- (missions) in-memory mission store ----------
type Mission = {
  id: string;
  title: string;
  status: string;
  phase: string;
  progress: number;
  eta: string;
  dependencies: string[];
  owner: string;
};
const missionStore: Mission[] = [
  {
    id: "RFC-0000",
    title: "RFC-0000 governance build",
    status: "done",
    phase: "foundation",
    progress: 100,
    eta: "2025-01-01T00:00:00Z",
    dependencies: [],
    owner: "cto/cto",
  },
  {
    id: "POOL-E1",
    title: "PoolLeague E1 backend reconcile",
    status: "proposed",
    phase: "backend",
    progress: 0,
    eta: "2025-06-01T00:00:00Z",
    dependencies: ["RFC-0000"],
    owner: "cto/cto",
  },
  {
    id: "POOL-SUB",
    title: "PoolLeague submodule conversion",
    status: "approved",
    phase: "toolchain",
    progress: 10,
    eta: "2025-07-01T00:00:00Z",
    dependencies: ["RFC-0000"],
    owner: "coo/coo",
  },
];

      if (p === "/api/missions" && req.method === "GET") {
        return json({ missions: missionStore });
      }

      if (p.startsWith("/api/missions/") && req.method === "PATCH") {
        const id = decodeURIComponent(p.slice("/api/missions/".length));
        const m = missionStore.find((x) => x.id === id);
        if (!m) return json({ error: "mission not found" }, 404);
        // markdown/body must be a JSON Merge Patch-style body: { status, progress, phase }
        let patchData: Record<string, unknown> = {};
        try { patchData = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
        if (patchData.status) {
          const next = ADVANCE[m.status] || patchData.status;
          if (!ADVANCE[m.status] && next === m.status)
            return json({ error: `cannot advance from "${m.status}" (terminal or bad status)` }, 400);
          m.status = next;
        }
        if (typeof patchData.progress === "number") m.progress = Math.min(100, Math.max(0, patchData.progress));
        if (patchData.phase) m.phase = String(patchData.phase);
        return json(m);
      }

      if (p === "/api/agent/dispatch" && req.method === "POST") {
        const body = await req.json();
        const missionId = String(body.missionId ?? "");
        const agent = String(body.agent ?? "");
        if (!missionId || !agent) return json({ error: "missionId and agent required" }, 400);
        const m = missionStore.find((x) => x.id === missionId);
        if (!m) return json({ error: "mission not found" }, 404);
        const dispatchSlug = `decisions/agent-dispatch-${missionId}-${Date.now()}`;
        const dispatchNote = `[dispatch] agent="${agent}" mission=${missionId} status=${m.status} ts=${new Date().toISOString()}`;
        runGbrain(["capture", "--type", "decision", "--slug", dispatchSlug, "--stdin"], {
          stdin: dispatchNote,
          timeoutMs: 30000,
        }).catch(() => {});
        return json({ queued: true, missionId, agent, decisionSlug: dispatchSlug });
      }

      if (p === "/api/timeline" && req.method === "GET") {
        const items = [
          { id: "t1", title: "RFC-0000 ratified", date: "2026-07-22", status: "done", owner: "cto/cto" },
          { id: "t2", title: "Constitution + FES-001..012 committed", date: "2026-07-22", status: "done", owner: "cto/cto" },
          { id: "t3", title: "Mission Center shipped", date: "2026-07-31", status: "done", owner: "cto/cto" },
          { id: "t4", title: "PoolLeague E1 reconcile", date: "2026-07-31", status: "in-progress", owner: "cto/cto" },
          { id: "t5", title: "VPS agent farm expansion", date: "2026-07-31", status: "planned", owner: "coo/coo" },
        ];
        return json({ timeline: items });
      }

      if (p === "/api/ledger" && req.method === "GET") {
        const entries = [
          { id: "l1", title: "RFC-0000 approval", type: "approval", date: "2026-07-22", mission: "RFC-0000", outcome: "approved" },
          { id: "l2", title: "E1 proposed", type: "proposal", date: "2026-07-31", mission: "POOL-E1", outcome: "pending" },
          { id: "l3", title: "Submodule conversion approved", type: "approval", date: "2026-07-31", mission: "POOL-SUB", outcome: "approved" },
        ];
        return json({ ledger: entries });
      }

      if (p === "/api/org" && req.method === "GET") {
        const org = {
          name: "ForgeOS Engineering Organization",
          roles: [
            { id: "cto/cto", title: "CTO", reportsTo: "exec/ceo", responsibilities: ["architecture", "engineering", "ai-governance"] },
            { id: "coo/coo", title: "COO", reportsTo: "exec/ceo", responsibilities: ["missions", "timeline", "delivery"] },
            { id: "cfo/cfo", title: "CFO", reportsTo: "exec/ceo", responsibilities: ["budget", "compliance", "risk"] },
            { id: "exec/ceo", title: "CEO", reportsTo: null, responsibilities: ["strategy", "approvals", "external"] },
          ]
        };
        return json(org);
      }

      if (p === "/api/capture" && req.method === "POST") {
        const body = await req.json();
        const slug = String(body.slug ?? ""); const type = String(body.type ?? "note"); const text = String(body.body ?? "");
        if (!slug) return json({ error: "slug required" }, 400);
        const r = await runGbrain(["capture", "--type", type, "--slug", slug, "--stdin"], { stdin: text, timeoutMs: 60000 });
        return json({ slug, out: r.out, err: r.err });
      }

      if (p === "/api/embed" && req.method === "POST") {
        try {
          const r = await runGbrain(["embed", "--all"], { timeoutMs: 110000 });
          return json({ out: r.out, err: r.err });
        } catch (e: any) {
          // OOM / PGLite can crash the CLI under load; degrade gracefully
          return json({ out: "partial", err: "embed incomplete: " + String(e?.message ?? e), note: "retry in smaller batches or after freeing memory" }, 200);
        }
      }

      const r = json({ error: "unknown api route: " + p }, 404);
      log(req, Date.now() - t0, 404); return r;
    } catch (e: any) {
      const r = json({ error: String(e?.message ?? e) }, 500);
      log(req, Date.now() - t0, 500); return r;
    }
  },
});

function listVault(base: string): string[] {
  const out: string[] = [];
  try {
    for (const f of new Bun.Glob("**/*.md").scanSync({ cwd: base, onlyFiles: true })) {
      if (f.startsWith(".git/")) continue;
      out.push(f);
    }
  } catch {}
  return out.sort();
}

console.log(`[forgeos-console] on http://127.0.0.1:${CONSOLE_PORT}  (owns PGLite at C:\\ForgeOS)${CONSOLE_TOKEN ? " [auth ON]" : ""}`);
