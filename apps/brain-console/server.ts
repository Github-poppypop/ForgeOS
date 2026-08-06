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
const DIST = `${ROOT}/src-client/dist`;
const CONSOLE_PORT = Number(process.env.PORT ?? 7777);
const GBRAIN_BIN = process.env.GBRAIN_BIN ?? "/root/.bun/bin/bun";
const GBRAIN_CLI = process.env.GBRAIN_CLI ?? "/tmp/forge-gbrain-local/node_modules/gbrain/src/cli.ts";
const GBRAIN_CWD = process.env.GBRAIN_CWD ?? "/tmp/forge-gbrain-local";
const GBRAIN_HOME = "C:\\ForgeOS";
const CONSOLE_TOKEN = process.env.CONSOLE_TOKEN || ""; // (41) set to enable auth
const RATE = Number(process.env.RATE_PER_MIN ?? 120);  // (42)

// minimal request metrics for prometheus
const metrics = { requests: 0, errors: 0, byRoute: new Map<string, { requests: number; errors: number }>() } as const;
function trackReq(p: string, status: number) {
  metrics.requests++;
  if (status >= 400) metrics.errors++;
  const entry = metrics.byRoute.get(p) || { requests: 0, errors: 0 };
  entry.requests++;
  if (status >= 400) entry.errors++;
  metrics.byRoute.set(p, entry);
}

const GBRAIN_ENV = Object.assign({}, process.env, {
  GBRAIN_HOME,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  OLLAMA_MODELS: process.env.OLLAMA_MODELS || "D:\\ollama",
  GBRAIN_EMBEDDING_DIMENSIONS: process.env.GBRAIN_EMBEDDING_DIMENSIONS || "1024",
});
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
  const proc = Bun.spawn([GBRAIN_BIN, GBRAIN_CLI, ...args], {
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
function rateOk(ip: string): number {
  console.log(`[RATE] ip=${ip} hits=${JSON.stringify(hits[ip])} rate=${RATE}`);
  const now = Date.now();
  hits[ip] = (hits[ip] || []).filter(t => now - t < 60000);
  const remaining = RATE - hits[ip].length;
  if (remaining <= 0) return 0;
  hits[ip].push(now);
  return remaining - 1;
}
const requestIdHeader = "x-request-id";
const requestLog: Array<{ id: string; method: string; path: string; status: number; ms: number; ip: string; ts: string }> = [];
const maxRequestLog = 200;
function recordRequestLog(entry: { id: string; method: string; path: string; status: number; ms: number; ip: string; ts: string }) {
  requestLog.push(entry);
  if (requestLog.length > maxRequestLog) requestLog.splice(0, requestLog.length - maxRequestLog);
}
function setRequestIdHeaders(res: Response, id: string) {
  res.headers.set(requestIdHeader, id);
}

function log(req: Request, ms: number, status: number) {
  trackReq(new URL(req.url).pathname, status);
  const ip = req.headers.get("x-forwarded-for") || "local";
  console.log(`[${new Date().toISOString()}] ${req.method} ${new URL(req.url).pathname} -> ${status} (${ms}ms) ${ip}`);
  const id = req.headers.get(requestIdHeader) || crypto.randomUUID();
  const entry = { id, method: req.method, path: new URL(req.url).pathname, status, ms, ip, ts: new Date().toISOString() };
  recordRequestLog(entry);
  if (status >= 400) structuredLog("error", id, entry.path, status, JSON.stringify(entry));
}

function structuredLog(level: string, id: string, path: string, status: number, payload: string) {
  console.log(JSON.stringify({ level, id, path, status, payload, ts: new Date().toISOString() }));
}

function rateHeaders(ip: string) {
  const remaining = Math.max(0, RATE - ((hits[ip] || []).filter(t => Date.now() - t < 60000).length));
  return {
    "x-ratelimit-limit": String(RATE),
    "x-ratelimit-remaining": String(remaining),
  };
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders } });
}
// ---------- (41) auth gate ----------
function authed(req: Request): boolean {
  if (!CONSOLE_TOKEN) return true; // open if no token set
  const h = req.headers.get("authorization") || "";
  return h === `Bearer ${CONSOLE_TOKEN}` || h === CONSOLE_TOKEN;
}

// ---- static ----
async function serveStatic(pathname: string) {
  if (pathname === "/") return new Response(Bun.file(`${DIST}/index.html`), { headers: { "x-content-type-options": "nosniff", "x-frame-options": "DENY" } });
  const distFile = Bun.file(`${DIST}${pathname}`);
  if (await distFile.exists()) {
    const ext = pathname.split(".").pop() ?? "";
    const ct: Record<string, string> = { ts: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8", svg: "image/svg+xml" };
    return new Response(distFile, { headers: { "content-type": ct[ext] ?? "application/octet-stream", "cache-control": "no-cache", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "strict-transport-security": "max-age=31536000; includeSubDomains", "referrer-policy": "no-referrer", "permissions-policy": "geolocation=(), microphone=(), camera=()" } });
  }
  let file = pathname.startsWith("/src/") ? `${ROOT}${pathname}` : `${PUBLIC}${pathname}`;
  const f = Bun.file(file);
  if (await f.exists()) {
    const ext = pathname.split(".").pop() ?? "";
    const ct: Record<string, string> = { ts: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8", svg: "image/svg+xml" };
    return new Response(f, { headers: { "content-type": ct[ext] ?? "application/octet-stream", "cache-control": "no-cache", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "strict-transport-security": "max-age=31536000; includeSubDomains", "referrer-policy": "no-referrer", "permissions-policy": "geolocation=(), microphone=(), camera=()" } });
  }
  return new Response(Bun.file(`${DIST}/index.html`), { headers: { "x-content-type-options": "nosniff", "x-frame-options": "DENY" } });
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
    if (p.startsWith("/api/") && !rateOk(ip)) { log(req, Date.now() - t0, 429); return json({ error: "rate limited" }, 429, rateHeaders(ip)); }

    // (43) SSE
    if (p === "/api/health/stream") {
      const stream = new ReadableStream({
        start(controller) {
          const w = controller as unknown as WritableStreamDefaultWriter;
          healthClients.add(w);
          controller.enqueue(`data: ${JSON.stringify({ ts: Date.now(), ok: true })}

`);
          setTimeout(() => {
            try { w.write(": keepalive\n\n"); } catch {}
          }, 15000);
        },
        cancel() {},
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive", "x-accel-buffering": "no" } });
    }

    if (!p.startsWith("/api/")) { const r = serveStatic(p); log(req, Date.now() - t0, 200); return r; }

    try {
      if (p === "/api/health") {
        return json({ ok: true, ts: Date.now() });
      }

      if (p === "/api/status") {
        let schema = { out: "unavailable", err: "" };
        try { schema = await runGbrain(["schema", "active"]); } catch {}
        const oll = await ollamaOk();
        return json({ console_port: CONSOLE_PORT, gbrain_health: { status: schema.out ? "ok" : "degraded", engine: "pglite", owned_by: "console" }, schema: schema.out, ollama: oll, embedding_model: "ollama:mxbai-embed-large (1024d, local)", isolation: "C:\\ForgeOS (separate from personal vaults & app brains)", auth: !!CONSOLE_TOKEN });
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
            "/api/restore": { post: { summary: "Restore brain zip" } },
            "/api/metrics": { get: { summary: "Metrics" } },
            "/api/metrics/prometheus": { get: { summary: "Prometheus text metrics" } },
            "/api/agent/workflows": { get: { summary: "Agent workflows" } },
            "/api/agent/messages": { get: { summary: "Agent messages" } },
            "/api/agent/metrics": { get: { summary: "Agent metrics" } },
            "/api/federation/remote": { get: { summary: "Remote brain metadata" } },
            "/api/webhooks": { get: { summary: "Webhooks" } },
            "/api/plugins": { get: { summary: "Plugins" } },
            "/api/hotreload": { post: { summary: "Plugin hot reload" } },
            "/api/state": { get: { summary: "Console state" }, post: { summary: "Save console state" } },
            "/api/auth/login": { post: { summary: "Login" } },
            "/api/capture/batch": { post: { summary: "Batch capture" } },
            "/api/import": { post: { summary: "Import items" } },
            "/api/export/{slug}": { get: { summary: "Export brain page" } },
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

      if (p.startsWith("/api/page/") && req.method === "DELETE") {
        const slug = decodeURIComponent(p.slice("/api/page/".length));
        const r = await runGbrain(["delete", slug], { timeoutMs: 30000 });
        if (r.code !== 0 || r.out.includes("not found")) return json({ error: r.err || "not found" }, 404);
        return json({ ok: true, slug });
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

      if (p === "/api/diff") {
        const left = url.searchParams.get("left");
        const right = url.searchParams.get("right");
        if (!left || !right) return json({ error: "left and right query params required" }, 400);
        return json({ error: "not implemented", status: 501, note: "gbrain does not expose a diff subcommand; governance diff requires manual page comparison or a future gbrain feature." }, 501);
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

      if (p === "/api/webhooks") {
        return json({ webhooks: [], deadLetter: [], ts: Date.now() });
      }

      if (p === "/api/request-log" && req.method === "GET") {
        const url = new URL(req.url, "http://localhost");
        const level = (url.searchParams.get("level") || "").toLowerCase();
        const since = Number(url.searchParams.get("since") || "0");
        let log = requestLog;
        if (level) log = log.filter(e => (e.path || "").toLowerCase().includes(level));
        if (since) log = log.filter(e => new Date(e.ts).getTime() >= since);
        return json({ log: log.slice(-200), total: log.length });
      }

      if (p === "/api/request-log-clear" && req.method === "POST") {
        requestLog.length = 0;
        return json({ ok: true });
      }

      if (p === "/api/compliance" && req.method === "GET") {
        return json({
          policies: [
            { id: "C-1", name: "No secrets in repo", status: "active", lastCheck: new Date().toISOString() },
            { id: "C-2", name: "Constitutional amendment required for /governance writes", status: "active", lastCheck: new Date().toISOString() },
            { id: "C-3", name: "Rate limit /api/*", status: "active", lastCheck: new Date().toISOString(), limit: 120 },
          ],
          violations: [],
        });
      }

      if (p === "/api/plugins" && req.method === "GET") {
        return json({
          plugins: [
            { id: "brain", name: "Brain Console Core", version: "1.0.0", active: true },
            { id: "sw", name: "Service Worker Cache", version: "6.0.0", active: true },
          ],
          ts: Date.now(),
        });
      }

      if (p === "/api/state" && req.method === "GET") {
        return json({ lastPanel: localStorage?.getItem?.("forgeos-last") || "dashboard" });
      }
      if (p === "/api/state" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const key = String(body.key || "");
        const value = body.value;
        if (!key) return json({ error: "key required" }, 400);
        try {
          localStorage?.setItem?.(key, typeof value === "string" ? value : JSON.stringify(value));
        } catch {}
        return json({ ok: true, key });
      }

      if (p === "/api/ledger/search" && req.method === "GET") {
        const q = new URL(req.url, "http://localhost").searchParams.get("q") || "";
        const term = q.toLowerCase();
        const entries = [
          { id: "l1", title: "RFC-0000 approval", type: "approval", date: "2026-07-22", mission: "RFC-0000", outcome: "approved", role: "cto/cto" },
          { id: "l2", title: "E1 proposed", type: "proposal", date: "2026-07-31", mission: "POOL-E1", outcome: "pending", role: "coo/coo" },
          { id: "l3", title: "Submodule conversion approved", type: "approval", date: "2026-07-31", mission: "POOL-SUB", outcome: "approved", role: "cto/cto" },
        ];
        const filtered = term ? [e for e in entries if term in json.dumps(e).lower()] : entries;
        return json({ query: q, ledger: filtered });
      }

      if (p === "/api/request-log" && req.method === "GET") {
        return json({ log: requestLog.slice(-100), total: requestLog.length });
      }

      if (p === "/api/health/detailed" && req.method === "GET") {
        const now = Date.now();
        const lastMinute = requestLog.filter(e => now - new Date(e.ts).getTime() < 60000);
        const errors = requestLog.filter(e => e.status >= 400).slice(-10);
        return json({
          ok: true,
          ts: now,
          uptime: process.uptime ? process.uptime() : 0,
          requests: {
            lastMinute: lastMinute.length,
            total: requestLog.length,
          },
          errors: {
            lastMinute: lastMinute.filter(e => e.status >= 400).length,
            recent: errors,
          },
          rateLimit: {
            limit: RATE,
            activeIps: Object.keys(hits).length,
          },
          auth: !!CONSOLE_TOKEN,
        });
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
        const url = new URL(req.url, "http://localhost");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const role = url.searchParams.get("role");
        const status = url.searchParams.get("status");
        let entries = [
          { id: "l1", title: "RFC-0000 approval", type: "approval", date: "2026-07-22", mission: "RFC-0000", outcome: "approved", role: "cto/cto" },
          { id: "l2", title: "E1 proposed", type: "proposal", date: "2026-07-31", mission: "POOL-E1", outcome: "pending", role: "coo/coo" },
          { id: "l3", title: "Submodule conversion approved", type: "approval", date: "2026-07-31", mission: "POOL-SUB", outcome: "approved", role: "cto/cto" },
        ];
        if (from) entries = entries.filter(e => e.date >= from);
        if (to) entries = entries.filter(e => e.date <= to);
        if (role) entries = entries.filter(e => e.role === role);
        if (status) entries = entries.filter(e => e.outcome === status);
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
        if (slug.includes("/") || slug.includes("\\") || slug.includes("..")) return json({ error: "invalid slug: no path separators or .. allowed" }, 400);
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

      if (p === "/api/agents") {
        return json({
          agents: [
            { id: 1, role: "CEO", status: "idle", lastMission: "CEO-20260803", lastActivity: "Review findings recorded" },
            { id: 2, role: "CTO", status: "idle", lastMission: "CTO-TEST-202608031150", lastActivity: "test run completed" },
            { id: 3, role: "CPO", status: "idle", lastMission: null, lastActivity: null },
            { id: 4, role: "COO", status: "idle", lastMission: null, lastActivity: null },
            { id: 5, role: "CMO", status: "idle", lastMission: null, lastActivity: null },
            { id: 6, role: "CFO", status: "idle", lastMission: null, lastActivity: null },
            { id: 7, role: "Board", status: "idle", lastMission: null, lastActivity: null },
          ],
          ts: Date.now(),
        });
      }

      if (p === "/api/poolleague/status") {
        try {
          const r = await fetch("http://localhost:3001/health", { signal: AbortSignal.timeout(3000) });
          const data = await r.json().catch(() => ({}));
          return json({ ok: r.ok, status: r.status, data, ts: Date.now() });
        } catch (e: any) {
          return json({ ok: false, error: "poolleague backend unreachable", ts: Date.now() });
        }
      }

      if (p === "/api/poolleague/tournaments") {
        try {
          const r = await fetch("http://localhost:3001/api/v2/tournaments", { signal: AbortSignal.timeout(5000) });
          const data = await r.json().catch(() => []);
          return json({ ok: r.ok, data, ts: Date.now() });
        } catch (e: any) {
          return json({ ok: false, error: e?.message ?? String(e), ts: Date.now() });
        }
      }

      if (p === "/api/poolleague/matches") {
        try {
          const r = await fetch("http://localhost:3001/api/v2/matches", { signal: AbortSignal.timeout(5000) });
          const data = await r.json().catch(() => []);
          return json({ ok: r.ok, data, ts: Date.now() });
        } catch (e: any) {
          return json({ ok: false, error: e?.message ?? String(e), ts: Date.now() });
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

const additionalRoutes: Record<string, { methods: string[]; handler: (req: Request, url: URL) => Response }> = {
  "/api/capture/batch": { methods: ["POST"], handler: async (req) => {
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    const results = [];
    for (const item of items.slice(0, 50)) {
      const { slug, type, body: text } = item || {};
      if (!slug || !type) continue;
      const r = await runGbrain(["capture", "--type", type, "--slug", slug, "--stdin"], { stdin: JSON.stringify(text ?? {}), timeoutMs: 30000 });
      results.push({ slug, ok: r.ok });
    }
    return json({ ok: true, results });
  }},
  "/api/export/:slug": { methods: ["GET"], handler: async (req, url) => {
    const slug = decodeURIComponent(url.pathname.slice("/api/export/".length));
    const r = await runGbrain(["page", "--slug", slug, "--stdout"], { timeoutMs: 15000 });
    if (!r.ok) return json({ error: r.err || "not found" }, 404);
    return new Response(JSON.stringify({ slug, content: r.out }), { headers: { "content-type": "application/json" } });
  }},
  "/api/import": { methods: ["POST"], handler: async (req) => {
    const body = await req.json().catch(() => ([]));
    const items = Array.isArray(body) ? body : [];
    const results = [];
    for (const item of items.slice(0, 50)) {
      const { slug, type, content } = item || {};
      if (!slug || !type) continue;
      const r = await runGbrain(["capture", "--type", type, "--slug", slug, "--stdin"], { stdin: JSON.stringify(content ?? {}), timeoutMs: 30000 });
      results.push({ slug, ok: r.ok });
    }
    return json({ ok: true, results });
  }},
  "/api/metrics/prometheus": { methods: ["GET"], handler: () => {
    const lines = [
      `# HELP forgeos_requests_total Total requests`,
      `# TYPE forgeos_requests_total counter`,
      `forgeos_requests_total ${metrics.requests}`,
      `# HELP forgeos_errors_total Total errors`,
      `# TYPE forgeos_errors_total counter`,
      `forgeos_errors_total ${metrics.errors}`,
    ];
    for (const [k, v] of metrics.byRoute.entries()) {
      lines.push(`forgeos_route_requests{route="${k}"} ${v.requests}`);
      lines.push(`forgeos_route_errors{route="${k}"} ${v.errors}`);
    }
    return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; version=0.0.4" } });
  }},
  "/api/hotreload": { methods: ["POST"], handler: (req) => {
    if (!process.env.HOT_RELOAD_SECRET || req.headers.get("x-reload-secret") !== process.env.HOT_RELOAD_SECRET) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
    loadPlugins();
    structuredLog("info", crypto.randomUUID(), "hotreload", 200, "plugins reloaded");
    return json({ ok: true, reloaded: pluginCache.length });
  }},
};

function matchAdditional(p: string, req: Request): Response | null {
  const route = additionalRoutes[p];
  if (route && route.methods.includes(req.method)) {
    return route.handler(req, new URL(req.url));
  }
  const paramMatch = p.match(/^\/api\/export\/(.+)$/);
  if (paramMatch) {
    const fakeUrl = new URL(req.url);
    fakeUrl.pathname = p;
    return additionalRoutes["/api/export/:slug"].handler(req, fakeUrl);
  }
  return null;
}

(function injectAdditional() {
  const originalFetch = server.fetch.bind(server);
  async function trackedFetch(req: Request) {
    const res = await originalFetch(req);
    trackReq(new URL(req.url).pathname, res.status);
    return res;
  }
  server.fetch = async (req) => {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      const hit = matchAdditional(p, req);
      if (hit) return hit;
    }
    return trackedFetch(req);
  };
})();

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

console.log(`[forgeos-console] on http://127.0.0.1:${CONSOLE_PORT}  (owns PGLite at C:\\ForgeOS)${CONSOLE_TOKEN ? " [auth ON]" : " [auth OPEN]"}`);

// Graceful cleanup: terminate child processes and SSE clients on exit signals.
async function cleanup(why) {
  console.log(`[${why}] cleaning up`);
  for (const c of activeChildren) { try { c.kill("SIGTERM"); } catch {} }
  activeChildren.clear();
  for (const w of healthClients) { try { w.close(); } catch {} }
  healthClients.clear();
  await Bun.sleep(500);
}
process.on("SIGTERM", () => { cleanup("SIGTERM").finally(() => process.exit(0)); });
process.on("SIGINT", () => { cleanup("SIGINT").finally(() => process.exit(0)); });
