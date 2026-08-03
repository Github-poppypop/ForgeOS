/**
 * ForgeOS Brain Console — backend
 * Serves the SPA and a REST API wrapping the gbrain CLI. The console owns
 * the PGLite brain exclusively (single-writer) and serializes CLI calls, so
 * no separate gbrain server is needed. Runs on 7777 (the public face).
 *
 * Infra hardening: optional auth gate (41), rate limiting + request logging
 * (42), SSE health stream (43), brain backup/restore (44), multi-brain
 * metadata (45). Phase 6 additions: JWT/OAuth2 auth (47), state persistence
 * (48), structured error tracking (49), metrics (50), detailed health (51).
 */
import { serve } from "bun";

const ROOT = import.meta.dir;
const PUBLIC = `${ROOT}/public`;
const CONSOLE_PORT = Number(process.env.PORT ?? 7777);
const GBRAIN_BIN = process.env.GBRAIN_BIN ?? "bunx";
const GBRAIN_CWD = process.env.GBRAIN_CWD ?? "C:\\Users\\pop\\forge-gbrain";
const GBRAIN_HOME = "C:\\ForgeOS";
const CONSOLE_TOKEN = process.env.CONSOLE_TOKEN || ""; // legacy fallback (41)
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRY = Number(process.env.JWT_EXPIRY ?? 3600); // 1 hour default
const STATE_FILE = `${GBRAIN_HOME}\\.gbrain\\state.json`;
const RATE_DEFAULT = Number(process.env.RATE_PER_MIN ?? 5);
const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/health":        { limit: 30, windowMs: 60_000 },
  "/api/health/stream": { limit: 10, windowMs: 60_000 },
  "/api/capture":       { limit: 10, windowMs: 60_000 },
  "/api/embed":         { limit:  1, windowMs: 60_000 },
};

const GBRAIN_ENV: Record<string, string> = {
  ...process.env,
  GBRAIN_HOME,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  OLLAMA_MODELS: process.env.OLLAMA_MODELS || "D:\\ollama",
  GBRAIN_EMBEDDING_DIMENSIONS: process.env.GBRAIN_EMBEDDING_DIMENSIONS || "1024",
};
delete GBRAIN_ENV.DATABASE_URL; // host Postgres pool breaks PGLite

// ========== Phase 8: API versioning ==========
const API_VERSION = process.env.API_VERSION ?? "2";
const DEPRECATION_DATE = "2026-09-01";
const V1_DEPRECATED = API_VERSION === "2";

function versionDeprecationHeaders(version: "v1" | "v2"): Record<string, string> {
  if (version === "v1" && V1_DEPRECATED) {
    return {
      "x-api-deprecation": "true",
      "x-api-deprecated-version": "v1",
      "x-api-sunset-date": DEPRECATION_DATE,
      "x-api-current-version": "v2",
      "link": `</api/v2>; rel="successor-version"`,
    };
  }
  return { "x-api-version": version };
}

function handleVersionedRoute(pathname: string, req: Request, handler: (innerPath: string) => Response): Response {
  const v1Match = pathname.match(/^\/api\/v1\/(.+)$/);
  const v2Match = pathname.match(/^\/api\/v2\/(.+)$/);
  if (v1Match) {
    const inner = "/api/" + v1Match[1];
    const res = handler(inner);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(versionDeprecationHeaders("v1"))) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  }
  if (v2Match) {
    const inner = "/api/" + v2Match[1];
    const res = handler(inner);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(versionDeprecationHeaders("v2"))) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  }
  return handler(pathname);
}

// ========== Phase 8: Webhook System ==========
type WebhookEvent = "mission.created" | "mission.updated" | "agent.started" | "agent.completed" | "agent.failed";
type WebhookSubscription = {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  createdAt: number;
  active: boolean;
};

const webhookStore: WebhookSubscription[] = [];

function webhookEventsForMission(missionId: string, eventType: WebhookEvent) {
  return webhookStore.filter(w => w.active && w.events.includes(eventType));
}

async function dispatchWebhook(webhook: WebhookSubscription, eventType: WebhookEvent, payload: Record<string, unknown>) {
  const body = JSON.stringify({ event: eventType, ts: new Date().toISOString(), data: payload });
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    await fetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forgeos-event": eventType,
        "x-forgeos-delivery": crypto.randomUUID(),
        ...(webhook.secret ? { "x-forgeos-signature": Bun.hash(webhook.secret + body).toString() } : {}),
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(t);
    structuredLog("info", crypto.randomUUID(), "webhook", 200, `delivered ${eventType} -> ${webhook.url}`);
  } catch (e: any) {
    structuredLog("warn", crypto.randomUUID(), "webhook", 0, `failed ${eventType} -> ${webhook.url}: ${e?.message ?? e}`);
  }
}

function dispatchWebhooks(eventType: WebhookEvent, payload: Record<string, unknown>) {
  for (const wh of webhookEventsForMission(payload.missionId as string, eventType)) {
    dispatchWebhook(wh, eventType, payload).catch(() => {});
  }
}

// ========== Phase 8: Plugin System ==========
type PluginModule = {
  name: string;
  version: string;
  routes?: Record<string, (req: Request) => Response | Promise<Response>>;
  init?: () => void | Promise<void>;
  hooks?: {
    onMissionUpdate?: (mission: Mission) => void;
    onAgentDispatch?: (missionId: string, agent: string) => void;
  };
};

const loadedPlugins: PluginModule[] = [];

async function loadPlugins() {
  const pluginsDir = "C:\\ForgeOS\\plugins";
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const url = await import("node:url");
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".mjs"));
    for (const file of files) {
      try {
        const fullPath = path.join(pluginsDir, file);
        const fileUrl = url.pathToFileURL(fullPath).href;
        const mod = await import(fileUrl);
        const plugin: PluginModule = mod.default ?? mod;
        if (plugin.name) {
          loadedPlugins.push(plugin);
          structuredLog("info", crypto.randomUUID(), "plugin", 200, `loaded ${plugin.name}@${plugin.version} from ${file}`);
          await plugin.init?.();
        }
      } catch (e: any) {
        structuredLog("warn", crypto.randomUUID(), "plugin", 0, `failed to load ${file}: ${e?.message ?? e}`);
      }
    }
  } catch {
    // plugins dir does not exist — that's fine
  }
}

loadPlugins();

// ========== Phase 8: Cross-brain federation ==========
type RemoteBrain = {
  id: string;
  name: string;
  url: string;
  status: "online" | "offline" | "unknown";
  lastSeen?: number;
  roles?: string[];
};

const remoteBrains: RemoteBrain[] = [
  {
    id: "lifeos",
    name: "ForgeOS LifeOS",
    url: "http://localhost:7778",
    status: "unknown",
    lastSeen: undefined,
    roles: ["lifeos"],
  },
];

async function probeBrain(brain: RemoteBrain): Promise<RemoteBrain> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(`${brain.url}/api/health`, { signal: controller.signal });
    clearTimeout(t);
    return { ...brain, status: r.ok ? "online" : "offline", lastSeen: Date.now() };
  } catch {
    return { ...brain, status: "offline" };
  }
}

const ROLE_SLUGS = [
  "board/board", "exec/ceo", "cto/cto", "cpo/cpo",
  "coo/coo", "cmo/cmo", "cfo/cfo",
];

// ---------- (47) JWT / RBAC ----------
type JwtPayload = { sub: string; role: string; iat: number; exp: number };

function base64url(input: ArrayBuffer): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64url(sig);
}

async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const [headerB64, bodyB64, sigB64] = token.split(".");
    if (!headerB64 || !bodyB64 || !sigB64) return null;
    const data = `${headerB64}.${bodyB64}`;
    const expectedSig = await hmacSign(data, secret);
    if (sigB64 !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(bodyB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"));
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

// Simple user store. In production replace with DB lookup.
const USERS: Record<string, { password: string; role: string }> = {
  admin: { password: "admin", role: "board/board" },
  ceo:   { password: "ceo",   role: "exec/ceo" },
  cto:   { password: "cto",   role: "cto/cto" },
  coo:   { password: "coo",   role: "coo/coo" },
};

// ---------- (48) state persistence ----------
type PersistedState = {
  missions: typeof missionStore;
  agentState: Record<string, AgentState>;
};

async function loadState(): Promise<PersistedState | null> {
  try {
    const fs = await import("node:fs");
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

async function saveState(state: PersistedState): Promise<void> {
  try {
    const fs = await import("node:fs");
    const dir = `${GBRAIN_HOME}\\.gbrain`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    structuredLog("error", "", "state-persist", 500, `save state failed: ${String(e)}`);
  }
}

// Restore persisted state on startup (missions + agent state)
const persisted = await loadState();
if (persisted) {
  missionStore.length = 0;
  missionStore.push(...(persisted.missions ?? []));
  if (persisted.agentState) {
    for (const [k, v] of Object.entries(persisted.agentState)) {
      agentState.set(k, v);
    }
  }
}

// ---------- metrics (50) ----------
const metrics = {
  requests: 0 as number,
  errors: 0 as number,
  byRoute: new Map<string, { requests: number; errors: number }>(),
};

function incMetric(route: string, isError: boolean) {
  metrics.requests++;
  if (isError) metrics.errors++;
  const cur = metrics.byRoute.get(route) || { requests: 0, errors: 0 };
  cur.requests++;
  if (isError) cur.errors++;
  metrics.byRoute.set(route, cur);
}

// ---------- existing helpers ----------
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
  activeChildren.add(proc);
  proc.exited.then(() => activeChildren.delete(proc)).catch(() => activeChildren.delete(proc));
  if (opts.stdin) { proc.stdin.write(opts.stdin); } proc.stdin.end();
  const t = setTimeout(() => proc.kill(), opts.timeoutMs ?? 60000);
  const [out, err] = await Promise.all([proc.stdout.text(), proc.stderr.text()]);
  clearTimeout(t); await proc.exited;
  return { code: proc.exitCode ?? 0, out, err };
}

// ---------- CORS ----------
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};
function corsHeaders() { return { ...CORS_HEADERS }; }

function reqId(req: Request) {
  return req.headers.get('x-request-id') || crypto.randomUUID();
}
function structuredLog(level: string, reqId: string, route: string, status: number, msg: string) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, reqId, route, status, msg }));
}

// ---------- (42) rate limit + logging ----------
const hits: Record<string, Record<string, number[]>> = {};
function rateOk(ip: string, pathname: string): number {
  const route = RATE_LIMITS[pathname];
  const limit = route?.limit ?? RATE_DEFAULT;
  const windowMs = route?.windowMs ?? 60_000;
  const bucket = (hits[ip] ||= {})[pathname] ||= [];
  const now = Date.now();
  hits[ip][pathname] = bucket.filter(t => now - t < windowMs);
  const remaining = limit - hits[ip][pathname].length;
  if (remaining <= 0) return 0;
  hits[ip][pathname].push(now);
  return remaining;
}
function log(req: Request, ms: number, status: number) {
  const id = reqId(req);
  const ip = req.headers.get("x-forwarded-for") || "local";
  structuredLog("info", id, new URL(req.url).pathname, status, `${req.method} ${status} (${ms}ms) ${ip}`);
  incMetric(new URL(req.url).pathname, status >= 500);
  return id;
}

function rateHeaders(ip: string, pathname: string) {
  const route = RATE_LIMITS[pathname];
  const limit = route?.limit ?? RATE_DEFAULT;
  const windowMs = route?.windowMs ?? 60_000;
  const bucket = (hits[ip] || {})[pathname] || [];
  const remaining = Math.max(0, limit - bucket.filter(t => Date.now() - t < windowMs).length);
  return {
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": String(remaining),
  };
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(), ...extraHeaders } });
}

// ---------- (41/47) auth ----------
async function authenticate(req: Request): Promise<JwtPayload | null> {
  // Legacy static token (no RBAC)
  if (!JWT_SECRET && CONSOLE_TOKEN) {
    const h = req.headers.get("authorization") || "";
    if (h === `Bearer ${CONSOLE_TOKEN}` || h === CONSOLE_TOKEN) {
      return { sub: "legacy", role: "board/board", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY };
    }
    return null;
  }
  // JWT path
  if (JWT_SECRET) {
    const h = req.headers.get("authorization") || "";
    const token = h.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const payload = await verifyJwt(token, JWT_SECRET);
    if (!payload) return null;
    return payload;
  }
  // Open
  return { sub: "open", role: "board/board", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY };
}

function hasRole(payload: JwtPayload | null, allowed: string[]): boolean {
  if (!payload) return false;
  if (allowed.includes("*")) return true;
  return allowed.includes(payload.role);
}

// ---- static ----
async function serveStatic(pathname: string) {
  if (pathname === "/") return new Response(Bun.file(`${PUBLIC}/index.html`), { headers: { "x-content-type-options": "nosniff", "x-frame-options": "DENY" } });
  let file = pathname.startsWith("/src/") ? `${ROOT}${pathname}` : `${PUBLIC}${pathname}`;
  const f = Bun.file(file);
  if (await f.exists()) {
    const ext = pathname.split(".").pop() ?? "";
    const ct: Record<string, string> = { ts: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8", svg: "image/svg+xml" };
    return new Response(f, { headers: { "content-type": ct[ext] ?? "application/octet-stream", "cache-control": "no-cache", "x-content-type-options": "nosniff", "x-frame-options": "DENY" } });
  }
  return new Response(Bun.file(`${PUBLIC}/index.html`), { headers: { "x-content-type-options": "nosniff", "x-frame-options": "DENY" } });
}

async function ollamaOk() {
  try { const r = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch { return false; }
}

// ---------- (43) SSE health stream ----------
const healthClients = new Set<WritableStreamDefaultWriter>();
let healthInterval: ReturnType<typeof setInterval> | undefined;
healthInterval = setInterval(() => {
  if (!healthClients.size) return;
  const payload = `data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`;
  healthClients.forEach(w => { try { w.write(payload); } catch { healthClients.delete(w); } });
}, 5000);

// Track active child processes so they can be killed on SIGTERM/SIGINT.
const activeChildren = new Set<Bun.ChildProcess>();

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

// ---------- (agent state) in-memory agent execution tracker ----------
type AgentState = {
  status: "pending" | "running" | "done" | "failed";
  agent: string;
  session: string;
  startedAt: number;
  log: string[];
};
const agentState = new Map<string, AgentState>();

// ---------- (tmux log reader) helper ----------
// Spawns a `tail -f` on the tmux session's log file and streams lines into
// the in-memory log array. Returns the reader proc so the caller can observe
// its exit and mark the agent as done/failed.
function startLogReader(logFile: string, missionId: string): Bun.ChildProcess {
  const reader = Bun.spawn(["tail", "-f", "--retry", logFile], {
    stdout: "pipe",
    stderr: "pipe",
  });
  reader.stdout.readable.pipeThrough(new TextDecoderStream()).pipeTo(new WritableStream({
    write(line) {
      const entry = agentState.get(missionId);
      if (!entry) return;
      entry.log.push(line.trimEnd());
      if (entry.log.length > 500) entry.log.splice(0, entry.log.length - 500);
    },
  })).catch(() => {});
  return reader;
}

const server = serve({
  port: CONSOLE_PORT,
  idleTimeout: 120,
  async fetch(req) {
    const t0 = Date.now();
    const url = new URL(req.url);
    const p = url.pathname;
    const ip = req.headers.get("x-forwarded-for") || "local";

    // CORS preflight — before auth/rate-limit so unauthenticated origins can probe
    if (p.startsWith("/api/") && req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // (47) auth on API + SSE (exempt public auth routes)
    let user: JwtPayload | null = null;
    const publicRoutes = ["/api/auth/login", "/api/roles", "/api/health", "/api/health/detailed", "/api/health/stream", "/api/metrics"];
    const needsAuth = p.startsWith("/api/") && !publicRoutes.includes(p);
    if (needsAuth || p === "/api/health/stream") {
      user = await authenticate(req);
      if (!user) {
        const ms = Date.now() - t0;
        incMetric(p, true);
        log(req, ms, 401);
        return json({ error: "unauthorized" }, 401);
      }
    }

    if (p.startsWith("/api/") && !rateOk(ip, p)) {
      const ms = Date.now() - t0;
      incMetric(p, false);
      log(req, ms, 429);
      return json({ error: "rate limited" }, 429, rateHeaders(ip, p));
    }

    // (43) SSE
    if (p === "/api/health/stream") {
      const stream = new ReadableStream({
        start(controller) {
          const w = controller as unknown as WritableStreamDefaultWriter;
          healthClients.add(w);
          controller.enqueue(`data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`);
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
      // ---------- Versioned API wrappers ----------
      const isVersioned = /^\/api\/v(1|2)\//.test(p);
      const innerHandler = (innerPath: string) => innerApiHandler(innerPath, req);
      if (isVersioned) {
        return handleVersionedRoute(p, req, innerHandler);
      }

      // ---------- Unversioned API ----------
      const res = innerApiHandler(p, req);
      const headers = new Headers(res.headers);
      headers.set("x-api-version", API_VERSION);
      return new Response(res.body, { status: res.status, headers });
      // (47) auth routes
      if (p === "/api/auth/login" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const username = String(body.username ?? "");
        const password = String(body.password ?? "");
        const userRecord = USERS[username];
        if (!userRecord || userRecord.password !== password) {
          return json({ error: "invalid credentials" }, 401);
        }
        const payload: JwtPayload = {
          sub: username,
          role: userRecord.role,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
        };
        const token = JWT_SECRET ? await signJwt(payload, JWT_SECRET) : Buffer.from(JSON.stringify(payload)).toString("base64");
        return json({ token, role: payload.role, sub: payload.sub, expiresIn: JWT_EXPIRY });
      }

      // (51) roles — returns role definitions for RBAC UI
      if (p === "/api/roles") {
        const list = await runGbrain(["list"]);
        const lines = list.out.split("\n");
        const roles = ROLE_SLUGS.map((slug) => {
          const hit = lines.find((l) => l.startsWith(slug + "\t"));
          const title = hit ? hit.split("\t").pop() ?? "" : "";
          const name = title.match(/^type: role/) ? "" : title;
          return { slug, role: name || slug.split("/").pop(), reports_to: slug === "exec/ceo" ? "board" : (slug === "board/board" ? "charter" : "ceo"), exists: !!hit };
        });
        return json({ roles, currentRole: user?.role ?? null });
      }

      // (52) detailed health
      if (p === "/api/health/detailed") {
        const [gbrainVer, ollamaStatus, diskStat] = await Promise.all([
          (async () => {
            try {
              const r = await runGbrain(["--version"], { timeoutMs: 5000 });
              return { ok: r.code === 0, out: r.out.trim() };
            } catch {
              return { ok: false, out: "" };
            }
          })(),
          ollamaOk(),
          (async () => {
            try {
              const fs = await import("node:fs");
              const stat = fs.statSync(GBRAIN_HOME);
              // Best-effort: use blocks if available, else fallback to "unknown"
              const avail = typeof (stat as any).avail === "number" ? Math.round((stat as any).avail / 1024 / 1024) : null;
              const total = typeof (stat as any).blocks === "number" ? Math.round((stat as any).blocks / 1024 / 1024) : null;
              return { ok: true, availMB: avail, totalMB: total, path: GBRAIN_HOME };
            } catch (e) {
              return { ok: false, error: String(e) };
            }
          })(),
        ]);
        return json({
          ok: gbrainVer.ok && ollamaStatus && diskStat.ok,
          ts: Date.now(),
          gbrain: gbrainVer,
          ollama: ollamaStatus,
          disk: diskStat,
          pglite: { engine: "pglite", owned_by: "console", home: GBRAIN_HOME },
          memory: { agentStateEntries: agentState.size, missions: missionStore.length },
          uptime: process.uptime(),
        });
      }

      // (50) metrics
      if (p === "/api/metrics") {
        const routeMetrics: Record<string, { requests: number; errors: number }> = {};
        for (const [k, v] of metrics.byRoute.entries()) routeMetrics[k] = v;
        return json({
          requests: metrics.requests,
          errors: metrics.errors,
          activeAgents: agentState.size,
          routes: routeMetrics,
        });
      }

      // (48) state persistence
      if (p === "/api/state" && req.method === "GET") {
        const state = { missions: missionStore, agentState: Object.fromEntries(agentState) };
        return json(state);
      }
      if (p === "/api/state" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body.missions && Array.isArray(body.missions)) {
          missionStore.length = 0;
          missionStore.push(...body.missions);
        }
        if (body.agentState && typeof body.agentState === "object") {
          agentState.clear();
          for (const [k, v] of Object.entries(body.agentState)) agentState.set(k, v as AgentState);
        }
        const persistedState: PersistedState = { missions: missionStore, agentState: Object.fromEntries(agentState) };
        await saveState(persistedState);
        return json({ ok: true, saved: true });
      }

      if (p === "/api/health") {
        return json({ ok: true, ts: Date.now() });
      }

      if (p === "/api/status") {
        const [schema, oll] = await Promise.all([runGbrain(["schema", "active"]), ollamaOk()]);
        return json({ console_port: CONSOLE_PORT, gbrain_health: { status: "ok", engine: "pglite", owned_by: "console" }, schema: schema.out, ollama: oll, embedding_model: "ollama:mxbai-embed-large (1024d, local)", isolation: `C:\\ForgeOS (separate from personal vaults & app brains)`, auth: !!JWT_SECRET || !!CONSOLE_TOKEN });
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
            "/api/health/detailed": { get: { summary: "Detailed dependency health" } },
            "/api/health/stream": { get: { summary: "SSE live health" } },
            "/api/metrics": { get: { summary: "Basic counters" } },
            "/api/roles": { get: { summary: "C-suite role rows" } },
            "/api/auth/login": { post: { summary: "Obtain JWT" } },
            "/api/state": { get: { summary: "Load persisted state" }, post: { summary: "Save persisted state" } },
            "/api/missions": { get: { summary: "Mission list with agent state" } },
            "/api/missions/{id}": { patch: { summary: "Advance mission status" } },
            "/api/agent/dispatch": { post: { summary: "Dispatch an agent to a mission" } },
            "/api/agent/{missionId}/status": { get: { summary: "Agent execution status for a mission" } },
            "/api/agent/{missionId}/log": { get: { summary: "Last 50 log lines for an agent mission" } },
            "/api/agent/workflows": { get: { summary: "List agent workflows" }, post: { summary: "Create an agent workflow" } },
            "/api/agent/marketplace": { get: { summary: "Browse agent marketplace" } },
            "/api/agent/message": { post: { summary: "Send agent-to-agent message" } },
            "/api/agent/messages": { get: { summary: "List messages for a mission" } },
            "/api/agent/metrics": { get: { summary: "Agent metrics dashboard" } },
            "/api/page/{slug}": { get: { summary: "Get a brain page" } },
            "/api/search?q=": { get: { summary: "Semantic search (Ollama)" } },
            "/api/capture": { post: { summary: "Capture a page" } },
            "/api/embed": { post: { summary: "Re-embed all (Ollama)" } },
            "/api/backup": { post: { summary: "Download brain gzip" } },
            "/api/restore": { post: { summary: "Restore brain from gzip" } },
            "/api/vault": { get: { summary: "Obsidian vault file list" } },
            "/api/federation": { get: { summary: "Brain federation topology" } },
            "/api/audit": { get: { summary: "Audit trail (gbrain list)" } },
            "/api/schema": { get: { summary: "Active schema pack" } },
            "/api/timeline": { get: { summary: "Project timeline" } },
            "/api/ledger": { get: { summary: "Decision ledger" } },
            "/api/org": { get: { summary: "Organization roles" } },
            "/api/governance": { get: { summary: "Governance source-of-truth index" } },
            "/api/diff": { get: { summary: "Diff two pages (not implemented)" } },
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
        return json({ roles, currentRole: user?.role ?? null });
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
        const gitDate = new Date().toISOString().slice(0, 10);
        return json({ base: "C:\\Projects\\ForgeOS\\governance", sacred: true, authority: "Constitution > Laws > Standards > RFCs > Missions > Code", tree, gitDate });
      }

      if (p === "/api/vault") {
        return json({ base: "C:\\ForgeOS\\vault", files: listVault("C:\\ForgeOS\\vault"), git: "branch master (untracked role pages)" });
      }

      // (44) backup brain — gzip of a JSON bundle
      if (p === "/api/backup" && req.method === "POST") {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const base = "C:\\ForgeOS\\.gbrain\\brain.pglite";
        const entries: { name: string; data: string }[] = [];
        const walk = (dir: string) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else entries.push({ name: path.relative(base, full), data: fs.readFileSync(full).toString("base64") });
          }
        };
        try { walk(base); } catch (e) { return json({ error: "backup failed: " + String((e as Error).message) }, 500); }
        const bundle = Buffer.from(JSON.stringify({ base, files: entries, ts: Date.now() }));
        const gz = Bun.gzipSync(bundle);
        return new Response(gz, { headers: { "content-type": "application/gzip", "content-disposition": 'attachment; filename="forgeos-brain.json.gz"' } });
      }

      // (49) restore brain — ungzip uploaded bundle and write back
      if (p === "/api/restore" && req.method === "POST") {
        try {
          const gz = Buffer.from(await req.arrayBuffer());
          const raw = Bun.inflateSync(gz);
          const bundle = JSON.parse(raw.toString("utf-8")) as { base: string; files: { name: string; data: string }[] };
          const fs = await import("node:fs");
          const path = await import("node:path");
          const base = bundle.base || "C:\\ForgeOS\\.gbrain\\brain.pglite";
          for (const f of bundle.files ?? []) {
            const target = path.join(base, f.name);
            const dir = path.dirname(target);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(target, Buffer.from(f.data, "base64"));
          }
          return json({ ok: true, restored: bundle.files?.length ?? 0 });
        } catch (e) {
          return json({ error: "restore failed: " + String((e as Error).message) }, 400);
        }
      }

      const ADVANCE: Record<string, string> = {
        proposed: "approved",
        approved: "executing",
        executing: "review",
        review: "done",
      };

      if (p === "/api/missions" && req.method === "GET") {
        // Include per-mission agent state when available
        const missionsWithState = missionStore.map((m) => {
          const ag = agentState.get(m.id);
          return { ...m, agentState: ag ? { status: ag.status, agent: ag.agent, session: ag.session, startedAt: ag.startedAt } : null };
        });
        return json({ missions: missionsWithState });
      }

      if (p.startsWith("/api/missions/") && req.method === "PATCH") {
        const id = decodeURIComponent(p.slice("/api/missions/".length));
        const m = missionStore.find((x) => x.id === id);
        if (!m) return json({ error: "mission not found" }, 404);
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

      // /api/agent/:missionId/status
      if (p.startsWith("/api/agent/") && p.endsWith("/status")) {
        const missionId = decodeURIComponent(p.slice("/api/agent/".length, -"/status".length));
        const st = agentState.get(missionId);
        if (!st) return json({ error: "no agent state for mission: " + missionId }, 404);
        return json({ missionId, status: st.status, agent: st.agent, session: st.session, startedAt: st.startedAt });
      }

      // /api/agent/:missionId/log — last 50 lines
      if (p.startsWith("/api/agent/") && p.endsWith("/log")) {
        const missionId = decodeURIComponent(p.slice("/api/agent/".length, -"/log".length));
        const st = agentState.get(missionId);
        if (!st) return json({ error: "no agent state for mission: " + missionId }, 404);
        const last50 = st.log.slice(-50);
        return json({ missionId, log: last50, total: st.log.length });
      }

      // /api/agent/workflows
      if (p === "/api/agent/workflows" && req.method === "GET") {
        const missionId = url.searchParams.get("missionId") || "";
        const list = missionId ? workflowStore.filter(w => w.missionId === missionId) : workflowStore;
        return json({ workflows: list });
      }
      if (p === "/api/agent/workflows" && req.method === "POST") {
        const body = await req.json();
        const missionId = String(body.missionId ?? "");
        const name = String(body.name ?? "untitled");
        const steps = Array.isArray(body.steps) ? body.steps : [];
        if (!missionId) return json({ error: "missionId required" }, 400);
        const wf: Workflow = {
          id: `wf-${Date.now()}`,
          missionId,
          name,
          steps: steps.map((s: any, i: number) => ({ id: `step-${i}`, agent: String(s.agent || ""), condition: s.condition || "", nextStepId: s.nextStepId })),
          createdAt: Date.now(),
        };
        workflowStore.push(wf);
        return json(wf, 201);
      }

      // /api/agent/marketplace
      if (p === "/api/agent/marketplace" && req.method === "GET") {
        return json({ agents: marketplaceAgents });
      }

      // /api/agent/message — send agent-to-agent message
      if (p === "/api/agent/message" && req.method === "POST") {
        const body = await req.json();
        const from = String(body.from ?? "");
        const to = String(body.to ?? "");
        const msgBody = String(body.body ?? "");
        const missionId = body.missionId ? String(body.missionId) : undefined;
        if (!from || !to || !msgBody) return json({ error: "from, to, body required" }, 400);
        const msg: AgentMessage = { id: `msg-${Date.now()}`, from, to, missionId, body: msgBody, ts: Date.now() };
        messageStore.push(msg);
        return json(msg, 201);
      }

      // /api/agent/messages — list messages (optionally filtered by missionId)
      if (p === "/api/agent/messages" && req.method === "GET") {
        const missionId = url.searchParams.get("missionId") || "";
        const list = missionId ? messageStore.filter(m => m.missionId === missionId) : messageStore;
        return json({ messages: list.slice(-100) });
      }

      // /api/agent/metrics — success rate, avg duration, cost tracking
      if (p === "/api/agent/metrics" && req.method === "GET") {
        const total = agentState.size;
        const done = [...agentState.values()].filter(s => s.status === "done").length;
        const failed = [...agentState.values()].filter(s => s.status === "failed").length;
        const running = [...agentState.values()].filter(s => s.status === "running").length;
        const successRate = total > 0 ? ((done / total) * 100).toFixed(1) : "0.0";
        const durations = [...agentState.values()].filter(s => s.finishedAt && s.startedAt).map(s => (s.finishedAt! - s.startedAt) / 1000);
        const avgDuration = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : "0.0";
        const totalCost = [...agentState.values()].reduce((acc, s) => {
          const agent = marketplaceAgents.find(a => a.id === s.agent);
          const dur = s.finishedAt ? (s.finishedAt - s.startedAt) / 1000 / 60 : 0;
          return acc + (agent ? agent.costPerMin * dur : 0);
        }, 0);
        const byAgent = marketplaceAgents.map(a => {
          const states = [...agentState.values()].filter(s => s.agent === a.id);
          const agentDone = states.filter(s => s.status === "done").length;
          const agentFailed = states.filter(s => s.status === "failed").length;
          const agentTotal = states.length;
          const agentDurations = states.filter(s => s.finishedAt && s.startedAt).map(s => (s.finishedAt! - s.startedAt) / 1000);
          const agentAvgDur = agentDurations.length ? (agentDurations.reduce((a, b) => a + b, 0) / agentDurations.length).toFixed(1) : "0.0";
          const agentCost = states.reduce((acc, s) => {
            const dur = s.finishedAt ? (s.finishedAt - s.startedAt) / 1000 / 60 : 0;
            return acc + a.costPerMin * dur;
          }, 0);
          return { ...a, total: agentTotal, done: agentDone, failed: agentFailed, successRate: agentTotal ? ((agentDone / agentTotal) * 100).toFixed(1) : "0.0", avgDuration: agentAvgDur, cost: agentCost.toFixed(2) };
        });
        return json({ total, done, failed, running, successRate, avgDuration, totalCost: totalCost.toFixed(2), byAgent });
      }

      if (p === "/api/agent/dispatch" && req.method === "POST") {
      const body = await req.json();
      const missionId = String(body.missionId ?? "");
      const agent = String(body.agent ?? "");
      if (!missionId || !agent) return json({ error: "missionId and agent required" }, 400);
      const m = missionStore.find((x) => x.id === missionId);
      if (!m) return json({ error: "mission not found" }, 404);

      // Initialize agent state as pending (will flip to running once tmux launches)
      const session = `agent-${missionId}-${Date.now()}`;
      const logFile = `${ROOT}/logs/agent-${missionId}.log`;
      agentState.set(missionId, {
        status: "pending",
        agent,
        session,
        startedAt: Date.now(),
        log: [`[${new Date().toISOString()}] dispatching agent=${agent} mission=${missionId} session=${session}`],
      });

      // Ensure log directory exists
      try { await Bun.write(logFile, ""); } catch {}

      // Build the agent command — runs the agent for this mission inside tmux
      // Consumers override AGENT_CMD via env to plug in their agent runner.
      const agentCmd = process.env.AGENT_CMD || `echo "agent=${agent} mission=${missionId} — set AGENT_CMD to your runner"`;
      const tmuxCmd = `tmux new-session -d -s ${session} '${agentCmd} >> ${logFile} 2>&1'`;

      // Spawn tmux detached; don't block the response
      const tmuxSpawn = Bun.spawn(["bash", "-c", tmuxCmd], {
        stdout: "pipe", stderr: "pipe", env: { ...process.env },
      });
      tmuxSpawn.exited.then(() => {
        const entry = agentState.get(missionId);
        if (!entry || entry.status === "failed") return;
        if (tmuxSpawn.exitCode !== 0) {
          agentState.set(missionId, { ...entry, status: "failed", log: [...entry.log, `[${new Date().toISOString()}] tmux session failed to start (exit=${tmuxSpawn.exitCode})`] });
          return;
        }
        // Mark as running; tmux session is now active
        agentState.set(missionId, { ...entry, status: "running", log: [...entry.log, `[${new Date().toISOString()}] tmux session started: ${session}`] });
      }).catch(() => {
        const entry = agentState.get(missionId);
        if (entry) agentState.set(missionId, { ...entry, status: "failed", log: [...entry.log, `[${new Date().toISOString()}] error launching tmux session`] });
      });

      // Start a tail -f reader on the log file to populate in-memory logs live
      startLogReader(logFile, missionId);

      // Dispatch the decision capture to the brain (fire-and-forget)
      const dispatchSlug = `decisions/agent-dispatch-${missionId}-${Date.now()}`;
      const dispatchNote = `[dispatch] agent="${agent}" mission=${missionId} status=${m.status} ts=${new Date().toISOString()}`;
      runGbrain(["capture", "--type", "decision", "--slug", dispatchSlug, "--stdin"], {
        stdin: dispatchNote,
        timeoutMs: 30000,
      }).catch(() => {});

      return json({ queued: true, missionId, agent, session, logFile, decisionSlug: dispatchSlug });
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
        if (slug.includes("/") || slug.includes("\\") || slug.includes("..")) return json({ error: "invalid slug: no path separators or .. allowed" }, 400);
        const r = await runGbrain(["capture", "--type", type, "--slug", slug, "--stdin"], { stdin: text, timeoutMs: 60000 });
        return json({ slug, out: r.out, err: r.err });
      }

      if (p === "/api/embed" && req.method === "POST") {
        try {
          const r = await runGbrain(["embed", "--all"], { timeoutMs: 110000 });
          return json({ out: r.out, err: r.err });
        } catch (e: any) {
          return json({ out: "partial", err: "embed incomplete: " + String(e?.message ?? e), note: "retry in smaller batches or after freeing memory" }, 200);
        }
      }

      const r = json({ error: "unknown api route: " + p }, 404);
      log(req, Date.now() - t0, 404); return r;
    } catch (e: any) {
      const reqIdVal = reqId(req);
      structuredLog("error", reqIdVal, new URL(req.url).pathname, 500, JSON.stringify({ message: e?.message ?? String(e), stack: e?.stack, route: p }));
      const ms = Date.now() - t0;
      incMetric(new URL(req.url).pathname, true);
      log(req, ms, 500);
      return json({ error: "internal server error", reqId: reqIdVal }, 500);
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

console.log(`[forgeos-console] on http://127.0.0.1:${CONSOLE_PORT}  (owns PGLite at C:\\ForgeOS)${JWT_SECRET ? " [auth JWT ON]" : (CONSOLE_TOKEN ? " [auth legacy ON]" : " [auth OPEN]")}`);

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
