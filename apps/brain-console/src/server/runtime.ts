// src/server/runtime.ts
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { rateLimit, getRateLimitSnapshot } from "./ratelimit";
import { loadServerFeatures } from "./features/loader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const REGISTRY_FILE = path.join(DATA_DIR, "registry.json");

type Dict = Record<string, unknown>;
type MaybePromise<T> = T | Promise<T>;

function sanitizeString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function ensureArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    const merged = { ...fallback, ...(typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : {}) };
    return merged as T;
  } catch {
    return fallback;
  }
}

function saveJson(filePath: string, data: unknown) {
  try {
    ensureDataDir();
    const tmp = `${filePath}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.warn(`[store] persist failed for ${filePath}:`, err instanceof Error ? err.message : err);
  }
}

function jsonResponse(res: express.Response, data: Dict) {
  res.type("application/json; charset=utf-8").json(data);
}

function notFound(res: express.Response, message = "not found") {
  return res.status(404).json({ error: message });
}

function badRequest(res: express.Response, message = "bad request") {
  return res.status(400).json({ error: message });
}

function internalError(res: express.Response, message = "internal error") {
  return res.status(500).json({ error: message });
}

const defaultStore = {
  roles: [
    { id: 1, slug: "exec/ceo", role: "ceo", reports_to: "board", exists: false, permissions: ["read", "write", "approve"], created_at: "2026-08-01", updated_at: "2026-08-01" },
    { id: 2, slug: "board/board", role: "board", reports_to: "charter", exists: true, permissions: ["read", "approve"], created_at: "2026-08-01", updated_at: "2026-08-01" },
    { id: 3, slug: "cto/cto", role: "cto", reports_to: "ceo", exists: true, permissions: ["read", "write", "deploy"], created_at: "2026-08-01", updated_at: "2026-08-02" },
    { id: 4, slug: "coo/coo", role: "coo", reports_to: "ceo", exists: true, permissions: ["read", "write", "approve"], created_at: "2026-08-01", updated_at: "2026-08-02" },
    { id: 5, slug: "cfo/cfo", role: "cfo", reports_to: "ceo", exists: true, permissions: ["read", "approve", "finance"], created_at: "2026-08-01", updated_at: "2026-08-02" },
    { id: 6, slug: "cmo/cmo", role: "cmo", reports_to: "ceo", exists: true, permissions: ["read", "write", "publish"], created_at: "2026-08-01", updated_at: "2026-08-02" },
    { id: 7, slug: "clo/clo", role: "clo", reports_to: "ceo", exists: false, permissions: ["read", "compliance"], created_at: "2026-08-01", updated_at: "2026-08-01" },
  ],
  pages: [
    { slug: "types/roles", type: "roles", title: "C-Suite Roles", body: "Core executive roles and reporting lines.", status: "published" },
    { slug: "types/policy", type: "policy", title: "Governance Policy", body: "Decision-making and approval policy.", status: "published" },
    { slug: "types/runbook", type: "runbook", title: "Operations Runbook", body: "Daily ops and incident response.", status: "draft" },
  ],
  timeline: [
    { id: 1, date: "2026-08-01", title: "Console launched", status: "done", owner: "CTO" },
    { id: 2, date: "2026-08-05", title: "Self-improve added", status: "done", owner: "CPO" },
    { id: 3, date: "2026-08-09", title: "App registry shipped", status: "done", owner: "CTO" },
    { id: 4, date: "2026-08-11", title: "Dashboard polish", status: "in-progress", owner: "CPO" },
    { id: 5, date: "2026-08-14", title: "Developer onboarding", status: "proposed", owner: "CTO" },
  ],
  ledger: [
    { id: "1", date: "2026-08-10", title: "Use Node/Express for brain-console runtime", type: "approval", mission: "platform-stability", role: "cto", outcome: "approved" },
    { id: "2", date: "2026-08-09", title: "Port React UI from app.js", type: "proposal", mission: "forgeos-v2", role: "cfo", outcome: "pending" },
    { id: "3", date: "2026-08-08", title: "Memory leak in federation route", type: "incident", mission: "platform-stability", role: "cto", outcome: "approved" },
  ],
  vault: [
    { id: 1, kind: "api-key", name: "openai-key", updated: "2026-08-10", metadata: { service: "openai", scope: "completions" } },
    { id: 2, kind: "secret", name: "webhook-signing", updated: "2026-08-09", metadata: { service: "forgeos", scope: "webhooks" } },
  ],
  embeddings: { queued: 3, model: "ollama:mxbai-embed-large", dimensions: 1024, last_job: "2026-08-12T04:00:00.000Z" },
  missions: [
    { id: 1, title: "Ship self-improvement loop", status: "active", phase: "platform", owner: "CPO", progress: 82, risk: "medium", budget: 12000, teamSize: 4, created_at: "2026-08-01" },
    { id: 2, title: "Developer onboarding", status: "proposed", phase: "growth", owner: "CTO", progress: 35, risk: "low", budget: 5000, teamSize: 2, created_at: "2026-08-03" },
    { id: 3, title: "Sales demo refresh", status: "in-progress", phase: "outreach", owner: "COO", progress: 60, risk: "medium", budget: 3000, teamSize: 1, created_at: "2026-08-04" },
  ],
  federation: {
    root: "ForgeOS",
    model: "read-down",
    children: [
      { id: 1, name: "Brain Console", status: "synced", last_sync: "2026-08-12T06:00:00.000Z", node_count: 128 },
      { id: 2, name: "LifeOS", status: "pending", last_sync: "2026-08-11T10:00:00.000Z", node_count: 64 },
      { id: 3, name: "First App", status: "synced", last_sync: "2026-08-12T08:00:00.000Z", node_count: 42 },
    ],
  },
  audit: [
    { id: 1, action: "app.register", actor: "CTO", target: "first-app", ts: "2026-08-11T10:00:00.000Z" },
    { id: 2, action: "feedback.submit", actor: "system", target: "self-improve", ts: "2026-08-11T09:00:00.000Z" },
    { id: 3, action: "telemetry.page_view", actor: "system", target: "/dashboard", ts: "2026-08-11T08:00:00.000Z" },
  ],
  schemas: [
    { id: "forgeos", name: "ForgeOS Core", active: true, version: "1.0.0", updated: "2026-08-12", fields: ["slug", "type", "title", "body", "status"] },
  ],
  governance: {
    root: "C:\\Projects\\ForgeOS",
    rules: [
      { id: 1, title: "App review gate", status: "active", owner: "CTO", created_at: "2026-08-01" },
      { id: 2, title: "Telemetry consent required", status: "active", owner: "CPO", created_at: "2026-08-02" },
      { id: 3, title: "Plugin sandboxing", status: "inactive", owner: "CTO", created_at: "2026-08-03" },
    ],
  },
  compliance: {
    policies: [
      { id: 1, name: "Vault encryption", status: "active", category: "security", lastCheck: "2026-08-10", owner: "CTO" },
      { id: 2, name: "Telemetry consent", status: "active", category: "privacy", lastCheck: "2026-08-09", owner: "CPO" },
      { id: 3, name: "Plugin sandboxing", status: "inactive", category: "runtime", lastCheck: "2026-08-08", owner: "CTO" },
    ],
  },
  webhooks: {
    webhooks: [
      { id: 1, event: "app.registered", url: "http://127.0.0.1:7777/hooks/app", retries: 0, last: "2026-08-11T10:00:00.000Z", active: true },
      { id: 2, event: "feedback.submitted", url: "http://127.0.0.1:7777/hooks/feedback", retries: 1, last: "2026-08-11T09:00:00.000Z", active: true },
    ],
    deadLetter: [
      { id: 1, event: "telemetry.batch", url: "http://127.0.0.1:7777/hooks/telemetry", reason: "timeout", attempts: 3, last_attempt: "2026-08-11T08:00:00.000Z" },
    ],
  },
  mcp: {
    tools: [
      { id: 1, name: "brain.query", description: "Search brains and pages", endpoint: "local", status: "open", latency_ms: 120 },
      { id: 2, name: "app.register", description: "Register new app manifest", endpoint: "local", status: "open", latency_ms: 85 },
      { id: 3, name: "vector.upsert", description: "Upsert embeddings", endpoint: "local", status: "open", latency_ms: 210 },
    ],
    transports: [
      { id: 1, name: "stdio", endpoint: "local", status: "open", connections: 1 },
      { id: 2, name: "websocket", endpoint: "ws://127.0.0.1:7777/ws", status: "open", connections: 0 },
    ],
  },
  plugins: [
    { id: 1, name: "forgeos-ui", enabled: true, version: "1.0.0", error: null, updated: "2026-08-11" },
    { id: 2, name: "embed-proxy", enabled: false, version: "0.4.0", error: null, updated: "2026-08-09" },
    { id: 3, name: "marketplace-sync", enabled: true, version: "0.2.1", error: null, updated: "2026-08-10" },
  ],
  marketplace: {
    packages: [
      { id: 1, name: "forgeos-core", category: "tool", installed: true, updateAvailable: false, downloads: 128, rating: 4.8, version: "1.2.0", description: "Core ForgeOS runtime", size: "12MB" },
      { id: 2, name: "theme-obsidian", category: "theme", installed: true, updateAvailable: true, downloads: 84, rating: 4.4, version: "0.9.1", description: "Obsidian dark theme", size: "2MB" },
      { id: 3, name: "embed-worker", category: "plugin", installed: false, updateAvailable: false, downloads: 41, rating: 4.1, version: "0.3.0", description: "Embedding worker plugin", size: "5MB" },
      { id: 4, name: "api-gateway", category: "tool", installed: false, updateAvailable: false, downloads: 27, rating: 3.9, version: "0.1.0", description: "API gateway plugin", size: "4MB" },
    ],
    approvals: [
      { id: 1, package: "api-gateway", requested_by: "CTO", requested_at: "2026-08-12T09:00:00.000Z", status: "pending", reason: "New API surface" },
    ],
    analytics: { installs: 240, uninstalls: 12, active_users: 18 },
  },
  workflows: [
    { id: 1, name: "Deploy console", status: "running", trigger: "push", runs: 18, progress: 60, last_run: "2026-08-12T07:00:00.000Z" },
    { id: 2, name: "Embed pipeline", status: "failed", trigger: "schedule", runs: 5, progress: 0, last_run: "2026-08-12T04:00:00.000Z", error: "Ollama timeout" },
    { id: 3, name: "Telemetry cleanup", status: "success", trigger: "schedule", runs: 42, progress: 100, last_run: "2026-08-12T06:30:00.000Z" },
  ],
  monitoring: {
    cpu: 24,
    memory: 182,
    disk: 72,
    uptime: process.uptime(),
    processes: [
      { pid: process.pid, name: "brain-console", cpu: 12, memory: 64, status: "running" },
    ],
    events: [
      { id: 1, type: "info", message: "Health check passed", ts: "2026-08-12T08:00:00.000Z" },
      { id: 2, type: "warn", message: "Ollama latency above threshold", ts: "2026-08-12T08:05:00.000Z" },
      { id: 3, type: "error", message: "Embed pipeline timeout", ts: "2026-08-12T04:00:00.000Z" },
    ],
  },
  projects: [
    { id: 1, name: "ForgeOS", owner: "CTO", progress: 92, tasks: 14, active: true, archived: false, updated: "2026-08-11", description: "Core platform", priority: "high" },
    { id: 2, name: "Brain Console", owner: "CPO", progress: 76, tasks: 9, active: true, archived: false, updated: "2026-08-10", description: "Console UI and runtime", priority: "high" },
    { id: 3, name: "LifeOS", owner: "CTO", progress: 40, tasks: 6, active: true, archived: false, updated: "2026-08-09", description: "Personal brain companion", priority: "medium" },
  ],
  poolleague: {
    tables: [
      { id: 1, name: "Table 1", status: "open", location: "Main room" },
      { id: 2, name: "Table 2", status: "occupied", location: "Main room" },
      { id: 3, name: "Table 3", status: "open", location: "Quiet room" },
    ],
    players: [
      { id: 1, name: "Atlas", club: "Forge", rank: "A", wins: 18, losses: 4, win_rate: 0.818 },
      { id: 2, name: "Nova", club: "Vault", rank: "B", wins: 14, losses: 9, win_rate: 0.609 },
      { id: 3, name: "Rune", club: "Core", rank: "A", wins: 12, losses: 6, win_rate: 0.667 },
      { id: 4, name: "Pixel", club: "Forge", rank: "C", wins: 5, losses: 11, win_rate: 0.312 },
    ],
    matches: [
      { id: 1, table: "Table 1", players: ["Atlas", "Nova"], score: [7, 5], status: "completed", played_at: "2026-08-11T19:00:00.000Z" },
      { id: 2, table: "Table 2", players: ["Rune", "Atlas"], score: [3, 7], status: "completed", played_at: "2026-08-11T20:00:00.000Z" },
      { id: 3, table: "Table 1", players: ["Rune", "Nova"], score: [6, 6], status: "in-progress", played_at: null },
    ],
  },
  config: {
    ollama: "http://localhost:11434/v1",
    dimensions: 1024,
    isolation: "C:\\Projects\\ForgeOS",
    auth: false,
    telemetry: true,
    theme: "dark",
    locale: "en",
    retention_days: 30,
    max_payload_bytes: 5242880,
  },
  settings: { auth: false, telemetry: false, theme: "dark", locale: "en", retention_days: 30 },
  developers: [
    { id: 1, name: "CTO", onboarded: true, templates_used: ["display", "api"], apps_registered: 2, last_active: "2026-08-12" },
    { id: 2, name: "CPO", onboarded: true, templates_used: ["plugin"], apps_registered: 1, last_active: "2026-08-11" },
  ],
  apps: [
    { id: "brain-console", name: "Brain Console", version: "1.0.0", owner: "CTO", status: "running", runtime: "node", health: 94, port: 7777, capabilities: ["display", "forgeos-console-link"], updated: "2026-08-11", description: "Primary brain console", repository: "https://github.com/Github-poppypop/ForgeOS", dependencies: ["express", "vite", "pglite"] },
    { id: "lifeos", name: "LifeOS", version: "1.0.0", owner: "CPO", status: "design", runtime: "node", health: 72, port: 3001, capabilities: ["brain-dna", "memory-engine", "mission-engine"], updated: "2026-08-10", description: "Personal operating system", repository: "", dependencies: [] },
    { id: "first-app", name: "First App", version: "0.1.0", owner: "CTO", status: "development", runtime: "static", health: 88, port: 4173, capabilities: ["display"], updated: "2026-08-09", description: "First ForgeOS app", repository: "", dependencies: [] },
    { id: "poolleague", name: "PoolLeague", version: "1.0.0", owner: "COO", status: "running", runtime: "node", health: 91, port: 3002, capabilities: ["display"], updated: "2026-08-11", description: "Pool league tracker", repository: "", dependencies: [] },
    { id: "sdk", name: "ForgeOS SDK", version: "1.0.0", owner: "CTO", status: "stable", runtime: "node", health: 97, port: 0, capabilities: ["sdk"], updated: "2026-08-10", description: "SDK for ForgeOS apps", repository: "", dependencies: [] },
  ],
  selfImprove: {
    learning_rate: 0.87,
    confidence: 0.91,
    iterations: 142,
    last_improvement: "2026-08-11T00:00:00.000Z",
    suggestions: [
      { id: 1, title: "Add caching layer", impact: "high", effort: "medium", status: "proposed", detail: "Reduce repeated fetches on dashboard", confidence: 0.88, created_at: "2026-08-10" },
      { id: 2, title: "Improve error messages", impact: "medium", effort: "low", status: "in-progress", detail: "Add actionable error text on API failures", confidence: 0.92, created_at: "2026-08-09" },
      { id: 3, title: "Add health checks", impact: "high", effort: "low", status: "done", detail: "Add /api/health/detailed endpoint", confidence: 0.95, created_at: "2026-08-08" },
      { id: 4, title: "Optimize bundle size", impact: "medium", effort: "high", status: "proposed", detail: "Reduce JS bundle by code-splitting routes", confidence: 0.74, created_at: "2026-08-07" },
      { id: 5, title: "Add dark mode toggle", impact: "low", effort: "low", status: "done", detail: "Theme switcher already shipped", confidence: 0.99, created_at: "2026-08-06" },
    ],
    telemetry: {
      page_views: 1240,
      errors_last_24h: 3,
      avg_load_ms: 210,
      api_latency_p95_ms: 145,
      route_events: { "/dashboard": 420, "/roles": 180, "/search": 210, "/apps": 90 },
    },
    feedback: [
      { id: 1, source: "user", rating: 4, comment: "Great dashboard", date: "2026-08-10" },
      { id: 2, source: "user", rating: 5, comment: "Love the new theme system", date: "2026-08-11" },
      { id: 3, source: "system", rating: 3, comment: "Slow on mobile", date: "2026-08-09" },
    ],
  },
};

type Store = typeof defaultStore;

function loadStore(): Store {
  return loadJson<Store>(DATA_FILE, defaultStore);
}

function persistStore(store: Store) {
  saveJson(DATA_FILE, store);
}

// ── Plugin marketplace registry ─────────────────────────────────────────────
// Published plugins live in their own `data/registry.json` file so the
// marketplace catalog is portable and can be synced/shipped independently of
// the console store. Discovery reads this registry; publish appends to it and
// install flips the `installed` flag plus install metadata.
type RegistryPlugin = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  source: string;
  homepage: string;
  installed: boolean;
  downloads: number;
  rating: number;
  published_at: string;
  installed_at: string | null;
};

type Registry = { plugins: RegistryPlugin[] };

function registrySlug(name: string, version: string): string {
  const base = `${name}-${version}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `plugin-${Date.now()}`;
}

const defaultRegistry: Registry = {
  plugins: [
    {
      id: "embed-worker-0.3.0",
      name: "embed-worker",
      version: "0.3.0",
      description: "Background embedding worker backed by local Ollama.",
      author: "ForgeOS Core",
      category: "plugin",
      tags: ["embed", "worker", "ollama"],
      source: "registry://forgeos/embed-worker",
      homepage: "",
      installed: false,
      downloads: 41,
      rating: 4.1,
      published_at: "2026-08-05T10:00:00.000Z",
      installed_at: null,
    },
    {
      id: "theme-obsidian-0.9.1",
      name: "theme-obsidian",
      version: "0.9.1",
      description: "Obsidian-inspired dark theme for the brain console.",
      author: "ForgeOS Design",
      category: "theme",
      tags: ["theme", "dark", "ui"],
      source: "registry://forgeos/theme-obsidian",
      homepage: "",
      installed: true,
      downloads: 84,
      rating: 4.4,
      published_at: "2026-08-06T12:00:00.000Z",
      installed_at: "2026-08-07T09:30:00.000Z",
    },
    {
      id: "api-gateway-0.1.0",
      name: "api-gateway",
      version: "0.1.0",
      description: "Reverse-proxy gateway exposing app routes under one origin.",
      author: "ForgeOS Platform",
      category: "tool",
      tags: ["gateway", "proxy", "api"],
      source: "registry://forgeos/api-gateway",
      homepage: "",
      installed: false,
      downloads: 27,
      rating: 3.9,
      published_at: "2026-08-08T08:15:00.000Z",
      installed_at: null,
    },
    {
      id: "mission-scheduler-1.1.0",
      name: "mission-scheduler",
      version: "1.1.0",
      description: "Cron-style scheduler that advances missions automatically.",
      author: "ForgeOS Core",
      category: "plugin",
      tags: ["missions", "scheduler", "automation"],
      source: "registry://forgeos/mission-scheduler",
      homepage: "",
      installed: false,
      downloads: 63,
      rating: 4.6,
      published_at: "2026-08-10T16:45:00.000Z",
      installed_at: null,
    },
  ],
};

function loadRegistry(): Registry {
  return loadJson<Registry>(REGISTRY_FILE, defaultRegistry);
}

function saveRegistry(registry: Registry) {
  saveJson(REGISTRY_FILE, registry);
}

function normalizeRegistryPlugin(value: unknown): RegistryPlugin | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Dict;
  const name = sanitizeString(entry.name);
  const version = sanitizeString(entry.version, "0.0.0");
  if (!name) return null;
  return {
    id: sanitizeString(entry.id, registrySlug(name, version)),
    name,
    version,
    description: sanitizeString(entry.description, `${name} plugin`),
    author: sanitizeString(entry.author, "unknown"),
    category: sanitizeString(entry.category, "plugin"),
    tags: ensureArray<unknown>(entry.tags).map((t) => sanitizeString(t)).filter(Boolean),
    source: sanitizeString(entry.source, "registry://local"),
    homepage: sanitizeString(entry.homepage, ""),
    installed: sanitizeBoolean(entry.installed, false),
    downloads: Math.max(0, sanitizeNumber(entry.downloads, 0)),
    rating: clamp(sanitizeNumber(entry.rating, 0), 0, 5),
    published_at: sanitizeString(entry.published_at, new Date().toISOString()),
    installed_at: typeof entry.installed_at === "string" ? sanitizeString(entry.installed_at) || null : null,
  };
}

function registryPlugins(registry: Registry): RegistryPlugin[] {
  return ensureArray<unknown>(registry.plugins)
    .map((p) => normalizeRegistryPlugin(p))
    .filter((p): p is RegistryPlugin => p !== null);
}

function validateRequired(body: Dict, fields: string[]): string | null {
  const missing: string[] = fields.filter((f) => !(f in body) || body[f] === null || body[f] === undefined || sanitizeString(body[f]) === "");
  if (missing.length) return `missing required fields: ${missing.join(", ")}`;
  return null;
}

function sanitizeEntity<T extends Dict>(entity: T): T {
  const out: Dict = {};
  for (const [key, value] of Object.entries(entity)) {
    if (typeof value === "string") out[key] = sanitizeString(value);
    else if (typeof value === "number") out[key] = Number.isFinite(value) ? value : 0;
    else if (typeof value === "boolean") out[key] = value;
    else if (Array.isArray(value)) out[key] = value;
    else if (value && typeof value === "object") out[key] = sanitizeEntity(value as Dict);
    else out[key] = value;
  }
  return out as T;
}

export async function createRuntime() {
  const router = express.Router();
  await loadServerFeatures(router);

  // In-memory rate limiting for public, unauthenticated mutation endpoints.
  router.use("/api/feedback", rateLimit());
  router.use("/api/telemetry", rateLimit());
  router.use("/api/self-improve/learning-loop", rateLimit());
  const store = loadStore();
  const registry = loadRegistry();
  let nextId = Date.now();

  function get<T>(key: keyof Store): T {
    return store[key] as T;
  }

  function set(key: keyof Store, value: unknown) {
    store[key] = value as Store[keyof Store];
  }

  function persist() {
    persistStore(store);
  }

  function pushAudit(action: string, target: string, actor = "system") {
    const audit = store.audit as Array<Dict>;
    audit.unshift({
      id: Date.now(),
      action,
      actor,
      target,
      ts: new Date().toISOString(),
    });
    if (audit.length > 500) audit.length = 500;
    persist();
  }

  const requestLog: Array<{ ts: string; method: string; path: string; status: number; durationMs: number }> = [];

  router.use((_req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      requestLog.unshift({
        ts: new Date().toISOString(),
        method: _req.method,
        path: _req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
      if (requestLog.length > 500) requestLog.length = 500;
    });
    next();
  });

  router.get("/api/health", (_req, res) => {
    jsonResponse(res, { ok: true, ts: Date.now() });
  });

  router.get("/api/health/detailed", (_req, res) => {
    jsonResponse(res, {
      ok: true,
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
      pid: process.pid,
      node: process.version,
      platform: process.platform,
    });
  });

  router.get("/api/health/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const send = () => {
      try {
        res.write(`data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`);
      } catch (_err) {
        res.end();
      }
    };
    send();
    const timer = setInterval(send, 3000);
    _req.on("close", () => clearInterval(timer));
  });

  router.get("/api/status", (_req, res) => {
    jsonResponse(res, {
      console_port: Number(process.env.PORT ?? 7777),
      gbrain_health: { status: "ok", engine: "node", owned_by: "console" },
      schema: "forgeos",
      ollama: { status: "configured" },
      embedding_model: "ollama:mxbai-embed-large (1024d, local)",
      isolation: "C:\\Projects\\ForgeOS (separate from personal vaults & app brains)",
      auth: store.config.auth,
    });
  });

  router.get("/api/roles", (_req, res) => {
    const q = sanitizeString((_req.query.q as string) ?? "", "").toLowerCase();
    const status = sanitizeString((_req.query.status as string) ?? "", "");
    const page = Math.max(1, sanitizeNumber((_req.query.page as string) ?? "1", 1));
    const perPage = clamp(sanitizeNumber((_req.query.perPage as string) ?? "20", 20), 1, 100);

    let roles = ensureArray(store.roles) as Store["roles"];
    if (q) roles = roles.filter((r) => [r.role, r.slug, String(r.reports_to)].some((v) => String(v).toLowerCase().includes(q)));
    if (status === "seeded") roles = roles.filter((r) => r.exists);
    else if (status === "missing") roles = roles.filter((r) => !r.exists);

    const total = roles.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pageSafe = Math.min(page, totalPages);
    const start = (pageSafe - 1) * perPage;
    const items = roles.slice(start, start + perPage);

    jsonResponse(res, { roles: items, page: pageSafe, totalPages, total, perPage });
  });

  router.post("/api/roles", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["role", "slug"]);
    if (missing) return badRequest(res, missing);
    const role = sanitizeString((req.body as Dict).role as string);
    const slug = sanitizeString((req.body as Dict).slug as string);
    const reports_to = sanitizeString((req.body as Dict).reports_to as string, "—");
    const permissions = ensureArray<string>((req.body as Dict).permissions, ["read"]);
    const exists = sanitizeBoolean((req.body as Dict).exists, false);

    const entry = {
      id: nextId++,
      role,
      slug,
      reports_to,
      exists,
      permissions,
      created_at: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString().split("T")[0],
    };
    (store.roles as Dict[]).push(entry);
    persist();
    pushAudit("role.create", slug, "system");
    return res.status(201).json({ role: entry });
  });

  router.patch("/api/roles/:id", express.json(), (req, res) => {
    const id = Number(req.params.id);
    const roles = ensureArray(store.roles) as Dict[];
    const target = roles.find((r) => Number(r.id) === id);
    if (!target) return notFound(res, "role not found");

    const updates = req.body ?? {};
    if ("role" in updates && typeof updates.role === "string") target.role = sanitizeString(updates.role);
    if ("slug" in updates && typeof updates.slug === "string") target.slug = sanitizeString(updates.slug);
    if ("reports_to" in updates) target.reports_to = sanitizeString(updates.reports_to as string, target.reports_to as string);
    if ("exists" in updates) target.exists = sanitizeBoolean(updates.exists);
    if ("permissions" in updates) target.permissions = ensureArray<string>(updates.permissions, target.permissions as string[]);
    target.updated_at = new Date().toISOString().split("T")[0];

    persist();
    pushAudit("role.update", String(target.slug), "system");
    jsonResponse(res, { role: target });
  });

  router.get("/api/search", (_req, res) => {
    const q = sanitizeString((_req.query.q as string) ?? "", "");
    const type = sanitizeString((_req.query.type as string) ?? "", "");
    const page = Math.max(1, sanitizeNumber((_req.query.page as string) ?? "1", 1));
    const perPage = clamp(sanitizeNumber((_req.query.perPage as string) ?? "20", 20), 1, 100);

    const pages = ensureArray(store.pages) as Dict[];
    const results = pages
      .filter((p) => {
        const matchesQ = !q || [p.slug, p.title, p.body, p.type].some((v) => String(v).toLowerCase().includes(q.toLowerCase()));
        const matchesType = !type || p.type === type;
        return matchesQ && matchesType;
      })
      .map((p) => ({ slug: p.slug, title: p.title, type: p.type, status: p.status }));

    const total = results.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pageSafe = Math.min(page, totalPages);
    const start = (pageSafe - 1) * perPage;
    jsonResponse(res, { query: q, type, results: results.slice(start, start + perPage), page: pageSafe, totalPages, total, perPage });
  });

  router.post("/api/capture", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["slug", "type"]);
    if (missing) return badRequest(res, missing);
    const slug = sanitizeString((req.body as Dict).slug as string);
    const type = sanitizeString((req.body as Dict).type as string, "note");
    const title = sanitizeString((req.body as Dict).title as string, slug);
    const body = sanitizeString((req.body as Dict).body as string, "");
    const status = sanitizeString((req.body as Dict).status as string, "draft");

    const pages = ensureArray(store.pages) as Dict[];
    const existing = pages.find((p) => p.slug === slug);
    if (existing) {
      existing.title = title || existing.title;
      existing.body = body || existing.body;
      existing.type = type || existing.type;
      existing.status = status;
      existing.updated_at = new Date().toISOString().split("T")[0];
      persist();
      pushAudit("page.update", slug, "system");
      return jsonResponse(res, { page: existing, updated: true });
    }

    const entry = { slug, type, title, body, status, created_at: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString().split("T")[0] };
    pages.push(entry);
    store.pages = pages;
    persist();
    pushAudit("page.create", slug, "system");
    return res.status(201).json({ page: entry, updated: false });
  });

  router.get("/api/page/{*slug}", (req, res) => {
    const raw = sanitizeString(Array.isArray((req.params as any).slug) ? ((req.params as any).slug as string[]).join("/") : (req.params as any).slug as string, "");
    const slug = decodeURIComponent(raw.replace(/^\//, "")) || raw;
    const page = (ensureArray(store.pages) as Dict[]).find((p) => p.slug === slug);
    if (!page) return notFound(res, "page not found");
    jsonResponse(res, { page: sanitizeEntity(page) });
  });

  router.patch("/api/page/{*slug}", express.json(), (req, res) => {
    const raw = sanitizeString(Array.isArray((req.params as any).slug) ? ((req.params as any).slug as string[]).join("/") : (req.params as any).slug as string, "");
    const slug = decodeURIComponent(raw.replace(/^\//, "")) || raw;
    const pages = ensureArray(store.pages) as Dict[];
    const target = pages.find((p) => p.slug === slug);
    if (!target) return notFound(res, "page not found");
    const updates = req.body ?? {};
    if ("title" in updates && typeof updates.title === "string") target.title = sanitizeString(updates.title);
    if ("body" in updates && typeof updates.body === "string") target.body = sanitizeString(updates.body);
    if ("status" in updates && typeof updates.status === "string") target.status = sanitizeString(updates.status);
    if ("type" in updates && typeof updates.type === "string") target.type = sanitizeString(updates.type);
    target.updated_at = new Date().toISOString().split("T")[0];
    persist();
    pushAudit("page.update", slug, "system");
    jsonResponse(res, { page: sanitizeEntity(target) });
  });

  router.delete("/api/page/{*slug}", (req, res) => {
    const raw = sanitizeString(Array.isArray((req.params as any).slug) ? ((req.params as any).slug as string[]).join("/") : (req.params as any).slug as string, "");
    const slug = decodeURIComponent(raw.replace(/^\//, "")) || raw;
    const pages = ensureArray(store.pages) as Dict[];
    const idx = pages.findIndex((p) => p.slug === slug);
    if (idx < 0) return notFound(res, "page not found");
    pages.splice(idx, 1);
    store.pages = pages;
    persist();
    pushAudit("page.delete", slug, "system");
    jsonResponse(res, { ok: true, slug });
  });

  router.get("/api/schema", (_req, res) => {
    jsonResponse(res, { active: "forgeos", types: store.schemas });
  });

  router.get("/api/timeline", (_req, res) => {
    jsonResponse(res, { timeline: store.timeline });
  });

  router.post("/api/timeline", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["title", "owner"]);
    if (missing) return badRequest(res, missing);
    const timeline = ensureArray(store.timeline) as Dict[];
    const entry = {
      id: nextId++,
      title: sanitizeString((req.body as Dict).title as string),
      status: sanitizeString((req.body as Dict).status as string, "proposed"),
      owner: sanitizeString((req.body as Dict).owner as string),
      date: sanitizeString((req.body as Dict).date as string, new Date().toISOString().split("T")[0]),
    };
    timeline.push(entry);
    store.timeline = timeline;
    persist();
    pushAudit("timeline.create", String(entry.id), "system");
    return res.status(201).json({ item: entry });
  });

  router.get("/api/ledger", (_req, res) => {
    jsonResponse(res, { ledger: store.ledger });
  });

  router.post("/api/ledger", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["title", "type", "role"]);
    if (missing) return badRequest(res, missing);
    const ledger = ensureArray(store.ledger) as Dict[];
    const entry = {
      id: String(nextId++),
      title: sanitizeString((req.body as Dict).title as string),
      type: sanitizeString((req.body as Dict).type as string),
      mission: sanitizeString((req.body as Dict).mission as string, "general"),
      role: sanitizeString((req.body as Dict).role as string),
      outcome: sanitizeString((req.body as Dict).outcome as string, "pending"),
      date: sanitizeString((req.body as Dict).date as string, new Date().toISOString().split("T")[0]),
    };
    ledger.unshift(entry);
    store.ledger = ledger;
    persist();
    pushAudit("ledger.create", entry.id, "system");
    return res.status(201).json({ item: entry });
  });

  router.get("/api/vault", (_req, res) => {
    jsonResponse(res, { items: store.vault, encrypted: true });
  });

  router.post("/api/vault", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["kind", "name"]);
    if (missing) return badRequest(res, missing);
    const vault = ensureArray(store.vault) as Dict[];
    const entry = {
      id: nextId++,
      kind: sanitizeString((req.body as Dict).kind as string),
      name: sanitizeString((req.body as Dict).name as string),
      updated: new Date().toISOString().split("T")[0],
      metadata: (req.body as Dict).metadata && typeof (req.body as Dict).metadata === "object" ? (req.body as Dict).metadata : {},
    };
    vault.push(entry);
    store.vault = vault;
    persist();
    pushAudit("vault.create", entry.name, "system");
    return res.status(201).json({ item: entry });
  });

  router.patch("/api/vault/:id", express.json(), (req, res) => {
    const id = Number(req.params.id);
    const vault = ensureArray(store.vault) as Dict[];
    const target = vault.find((v) => Number(v.id) === id);
    if (!target) return notFound(res, "vault item not found");
    const updates = req.body ?? {};
    if ("name" in updates && typeof updates.name === "string") target.name = sanitizeString(updates.name);
    if ("kind" in updates && typeof updates.kind === "string") target.kind = sanitizeString(updates.kind);
    if ("metadata" in updates && updates.metadata && typeof updates.metadata === "object") target.metadata = { ...target.metadata, ...updates.metadata };
    target.updated = new Date().toISOString().split("T")[0];
    persist();

  router.post("/api/vault/bulk", express.json(), (req, res) => {
    const body = (req.body ?? {}) as Dict;
    const action = typeof body.action === "string" ? body.action : "";
    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];
    if (!ids.length) return badRequest(res, "ids must be a non-empty array of vault item ids");
    const vault = ensureArray(store.vault) as Dict[];
    if (action === "delete") {
      const before = vault.length;
      const kept = vault.filter((v) => !ids.includes(Number(v.id)));
      const removed = before - kept.length;
      store.vault = kept;
      persist();
      pushAudit("vault.bulk-delete", String(removed), "system");
      return jsonResponse(res, { ok: true, deleted: removed });
    }
    if (action === "export") {
      const selected = vault.filter((v) => ids.includes(Number(v.id)));
      return jsonResponse(res, { ok: true, exported: selected.length, items: selected });
    }
    return badRequest(res, "action must be 'delete' or 'export'");
  });
    pushAudit("vault.update", String(target.name), "system");
    return jsonResponse(res, { item: target });
  });

  router.get("/api/__marker__", (_req, res) => { res.json({ ok: true, marker: "v2" }); });
  router.get("/api/embed", (_req, res) => {
    jsonResponse(res, store.embeddings);
  });

  router.post("/api/embed", express.json(), (req, res) => {
    const incoming = req.body ?? {};
    const model = sanitizeString((incoming as Dict).model as string, store.embeddings.model);
    const pages = ensureArray(store.pages) as Dict[];
    const queued = pages.filter((p) => p.status !== "archived").length;
    const entry = { queued, model, dimensions: 1024, last_job: new Date().toISOString() };
    store.embeddings = entry;
    persist();
    pushAudit("embed.start", model, "system");
    return res.status(202).json(entry);
  });

  router.get("/api/missions", (_req, res) => {
    jsonResponse(res, { missions: store.missions });
  });

  router.post("/api/missions", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["title", "owner"]);
    if (missing) return badRequest(res, missing);
    const missions = ensureArray(store.missions) as Dict[];
    const entry = {
      id: nextId++,
      title: sanitizeString((req.body as Dict).title as string),
      status: sanitizeString((req.body as Dict).status as string, "proposed"),
      phase: sanitizeString((req.body as Dict).phase as string, "platform"),
      owner: sanitizeString((req.body as Dict).owner as string),
      progress: clamp(sanitizeNumber((req.body as Dict).progress, 0), 0, 100),
      risk: sanitizeString((req.body as Dict).risk as string, "medium"),
      budget: sanitizeNumber((req.body as Dict).budget, 0),
      teamSize: clamp(sanitizeNumber((req.body as Dict).teamSize, 1), 1, 50),
      created_at: new Date().toISOString().split("T")[0],
    };
    missions.push(entry);
    store.missions = missions;
    persist();
    pushAudit("mission.create", String(entry.id), "system");
    return res.status(201).json({ mission: entry });
  });

  router.patch("/api/missions/:id", express.json(), (req, res) => {
    const id = Number(req.params.id);
    const missions = ensureArray(store.missions) as Dict[];
    const target = missions.find((m) => Number(m.id) === id);
    if (!target) return notFound(res, "mission not found");
    const updates = req.body ?? {};
    if ("status" in updates && typeof updates.status === "string") target.status = sanitizeString(updates.status);
    if ("progress" in updates) target.progress = clamp(sanitizeNumber(updates.progress, target.progress), 0, 100);
    if ("owner" in updates && typeof updates.owner === "string") target.owner = sanitizeString(updates.owner);
    persist();
    pushAudit("mission.update", String(target.id), "system");
    return jsonResponse(res, { mission: target });
  });

  router.get("/api/federation", (_req, res) => {
    jsonResponse(res, store.federation);
  });

  router.get("/api/audit", (_req, res) => {
    const limit = clamp(sanitizeNumber((_req.query.limit as string) ?? "50", 50), 1, 500);
    jsonResponse(res, { events: ensureArray(store.audit).slice(0, limit) });
  });

  router.post("/api/audit", express.json(), (req, res) => {
    const body = req.body ?? {};
    const entry = {
      id: nextId++,
      action: sanitizeString((body as Dict).action as string, "unknown"),
      actor: sanitizeString((body as Dict).actor as string, "system"),
      target: sanitizeString((body as Dict).target as string, ""),
      ts: sanitizeString((body as Dict).ts as string, new Date().toISOString()),
      meta: (body as Dict).meta && typeof (body as Dict).meta === "object" ? (body as Dict).meta : {},
    };
    (store.audit as Dict[]).unshift(entry);
    persist();
    return res.status(201).json({ event: entry });
  });

  router.get("/api/schema", (_req, res) => {
    jsonResponse(res, { active: "forgeos", types: store.schemas });
  });

  router.get("/api/governance", (_req, res) => {
    jsonResponse(res, store.governance);
  });

  router.patch("/api/governance/rules/:id", express.json(), (req, res) => {
    const id = Number(req.params.id);
    const rules = ensureArray(store.governance.rules) as Dict[];
    const target = rules.find((r) => Number(r.id) === id);
    if (!target) return notFound(res, "rule not found");
    const updates = req.body ?? {};
    if ("status" in updates && typeof updates.status === "string") target.status = sanitizeString(updates.status);
    if ("owner" in updates && typeof updates.owner === "string") target.owner = sanitizeString(updates.owner);
    persist();
    return jsonResponse(res, { rule: target });
  });

  router.get("/api/compliance", (_req, res) => {
    jsonResponse(res, store.compliance);
  });

  router.post("/api/compliance/checks", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["name", "category"]);
    if (missing) return badRequest(res, missing);
    const policies = ensureArray(store.compliance.policies) as Dict[];
    const entry = {
      id: nextId++,
      name: sanitizeString((req.body as Dict).name as string),
      category: sanitizeString((req.body as Dict).category as string),
      status: sanitizeString((req.body as Dict).status as string, "active"),
      lastCheck: new Date().toISOString().split("T")[0],
      owner: sanitizeString((req.body as Dict).owner as string, "system"),
    };
    policies.push(entry);
    store.compliance.policies = policies;
    persist();
    pushAudit("compliance.create", entry.name, "system");
    return res.status(201).json({ policy: entry });
  });

  router.get("/api/webhooks", (_req, res) => {
    jsonResponse(res, store.webhooks);
  });

  router.post("/api/webhooks", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["event", "url"]);
    if (missing) return badRequest(res, missing);
    const webhooks = ensureArray(store.webhooks.webhooks) as Dict[];
    const entry = {
      id: nextId++,
      event: sanitizeString((req.body as Dict).event as string),
      url: sanitizeString((req.body as Dict).url as string),
      retries: 0,
      last: new Date().toISOString(),
      active: true,
    };
    webhooks.push(entry);
    store.webhooks.webhooks = webhooks;
    persist();
    pushAudit("webhook.create", entry.event, "system");
    return res.status(201).json({ webhook: entry });
  });

  router.patch("/api/webhooks/:id", express.json(), (req, res) => {
    const id = Number(req.params.id);
    const webhooks = ensureArray(store.webhooks.webhooks) as Dict[];
    const target = webhooks.find((w) => Number(w.id) === id);
    if (!target) return notFound(res, "webhook not found");
    const updates = req.body ?? {};
    if ("active" in updates) target.active = sanitizeBoolean(updates.active, target.active as boolean);
    if ("url" in updates && typeof updates.url === "string") target.url = sanitizeString(updates.url);
    target.last = new Date().toISOString();
    persist();
    return jsonResponse(res, { webhook: target });
  });

  router.get("/api/mcp", (_req, res) => {
    jsonResponse(res, store.mcp);
  });

  router.post("/api/mcp/tools", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["name", "endpoint"]);
    if (missing) return badRequest(res, missing);
    const tools = ensureArray(store.mcp.tools) as Dict[];
    const entry = {
      id: nextId++,
      name: sanitizeString((req.body as Dict).name as string),
      description: sanitizeString((req.body as Dict).description as string, ""),
      endpoint: sanitizeString((req.body as Dict).endpoint as string, "local"),
      status: "open",
      latency_ms: sanitizeNumber((req.body as Dict).latency_ms, 0),
    };
    tools.push(entry);
    store.mcp.tools = tools;
    persist();
    pushAudit("mcp.tool.create", entry.name, "system");
    return res.status(201).json({ tool: entry });
  });

  router.get("/api/plugins", (_req, res) => {
    jsonResponse(res, { plugins: store.plugins });
  });

  router.patch("/api/plugins/:name", express.json(), (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const plugins = ensureArray(store.plugins) as Dict[];
    const target = plugins.find((p) => p.name === name);
    if (!target) return notFound(res, "plugin not found");
    const updates = req.body ?? {};
    if ("enabled" in updates) target.enabled = sanitizeBoolean(updates.enabled, target.enabled as boolean);
    if ("error" in updates && typeof updates.error === "string") target.error = sanitizeString(updates.error);
    target.updated = new Date().toISOString().split("T")[0];
    persist();
    pushAudit("plugin.update", name, "system");
    return jsonResponse(res, { plugin: target });
  });

  // Marketplace discovery: lists published plugins from data/registry.json.
  // Supports ?q= (name/description/author/tag match), ?category= and
  // ?installed=true|false. Legacy store-backed fields (packages, approvals,
  // analytics) are preserved so existing consumers keep working.
  router.get("/api/marketplace", (req, res) => {
    const q = sanitizeString(req.query.q, "").toLowerCase();
    const category = sanitizeString(req.query.category, "").toLowerCase();
    const installedFilter = sanitizeString(req.query.installed, "").toLowerCase();
    const all = registryPlugins(registry);
    let plugins = all;
    if (q) {
      plugins = plugins.filter((p) =>
        [p.name, p.description, p.author, p.category, ...p.tags].some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    if (category) plugins = plugins.filter((p) => p.category.toLowerCase() === category);
    if (installedFilter === "true") plugins = plugins.filter((p) => p.installed);
    if (installedFilter === "false") plugins = plugins.filter((p) => !p.installed);
    jsonResponse(res, {
      ...store.marketplace,
      plugins,
      total: plugins.length,
      published: all.length,
      installedCount: all.filter((p) => p.installed).length,
      categories: Array.from(new Set(all.map((p) => p.category))).sort(),
    });
  });

  // Publish a plugin into the registry.
  router.post("/api/marketplace", express.json(), (req, res) => {
    const body = (req.body ?? {}) as Dict;
    const missing = validateRequired(body, ["name", "version"]);
    if (missing) return badRequest(res, missing);
    const name = sanitizeString(body.name);
    const version = sanitizeString(body.version);
    if (!/^\d+\.\d+\.\d+$/.test(version)) return badRequest(res, "version must be semver (x.y.z)");
    const plugins = registryPlugins(registry);
    if (plugins.some((p) => p.name === name && p.version === version)) {
      return res.status(409).json({ published: false, error: `${name}@${version} already published` });
    }
    const entry = normalizeRegistryPlugin({
      ...body,
      id: registrySlug(name, version),
      name,
      version,
      installed: false,
      downloads: 0,
      published_at: new Date().toISOString(),
      installed_at: null,
    });
    if (!entry) return badRequest(res, "invalid plugin payload");
    plugins.push(entry);
    registry.plugins = plugins;
    saveRegistry(registry);
    pushAudit("marketplace.publish", `${entry.name}@${entry.version}`, "system");
    return res.status(201).json({ published: true, plugin: entry });
  });

  // Install a registry plugin by id (name also accepted) — marks it installed.
  router.post("/api/marketplace/:id/install", express.json(), (req, res) => {
    const id = sanitizeString(decodeURIComponent(String(req.params.id ?? "")));
    if (!id) return badRequest(res, "plugin id required");
    const plugins = registryPlugins(registry);
    const target = plugins.find((p) => p.id === id) ?? plugins.find((p) => p.name === id);
    if (!target) return notFound(res, "plugin not found in registry");
    const already = target.installed;
    if (!already) {
      target.installed = true;
      target.installed_at = new Date().toISOString();
      target.downloads += 1;
    }
    registry.plugins = plugins;
    saveRegistry(registry);
    pushAudit("marketplace.install", `${target.name}@${target.version}`, "system");
    return jsonResponse(res, { installed: true, already, plugin: target });
  });

  router.post("/api/marketplace/install", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["name"]);
    if (missing) return badRequest(res, missing);
    const name = sanitizeString((req.body as Dict).name as string);
    const packages = ensureArray(store.marketplace.packages) as Dict[];
    const target = packages.find((p) => p.name === name);
    if (target) {
      target.installed = true;
      target.updated = new Date().toISOString().split("T")[0];
    } else {
      packages.push({ id: nextId++, name, category: "plugin", installed: true, updateAvailable: false, downloads: 0, rating: 0, version: "0.0.1", description: "", size: "0MB" });
    }
    store.marketplace.packages = packages;
    persist();
    pushAudit("marketplace.install", name, "system");
    return jsonResponse(res, { installed: name });
  });

  router.post("/api/marketplace/compat", express.json(), (req, res) => {
    const name = sanitizeString((req.body as Dict).name as string, "");
    const version = sanitizeString((req.body as Dict).version as string, "");
    const compatible = name.length > 0 && /^\d+\.\d+\.\d+$/.test(version);
    return jsonResponse(res, { name, version, compatible, message: compatible ? "Compatible" : "Incompatible or missing fields" });
  });

  router.post("/api/marketplace/publish", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["name", "version", "source"]);
    if (missing) return badRequest(res, missing);
    const packages = ensureArray(store.marketplace.packages) as Dict[];
    const existing = packages.find((p) => p.name === (req.body as Dict).name && p.version === (req.body as Dict).version);
    if (existing) return jsonResponse(res, { published: false, reason: "already published" });
    packages.push({
      id: nextId++,
      name: sanitizeString((req.body as Dict).name as string),
      category: "plugin",
      installed: false,
      updateAvailable: false,
      downloads: 0,
      rating: 0,
      version: sanitizeString((req.body as Dict).version as string),
      description: `Published from ${sanitizeString((req.body as Dict).source as string)}`,
      size: "0MB",
    });
    store.marketplace.packages = packages;
    persist();
    pushAudit("marketplace.publish", sanitizeString((req.body as Dict).name as string), "system");
    return res.status(201).json({ published: true });
  });

  router.get("/api/marketplace/approvals", (_req, res) => {
    jsonResponse(res, { submissions: store.marketplace.approvals });
  });

  router.get("/api/marketplace/analytics", (_req, res) => {
    jsonResponse(res, { stats: store.marketplace.analytics });
  });

  router.get("/api/workflows", (_req, res) => {
    jsonResponse(res, { workflows: store.workflows });
  });

  router.patch("/api/workflows/:id", express.json(), (req, res) => {
    const id = Number(req.params.id);
    const workflows = ensureArray(store.workflows) as Dict[];
    const target = workflows.find((w) => Number(w.id) === id);
    if (!target) return notFound(res, "workflow not found");
    const updates = req.body ?? {};
    if ("status" in updates && typeof updates.status === "string") target.status = sanitizeString(updates.status);
    if ("progress" in updates) target.progress = clamp(sanitizeNumber(updates.progress, target.progress), 0, 100);
    target.last_run = new Date().toISOString();
    persist();
    return jsonResponse(res, { workflow: target });
  });

  router.get("/api/monitoring", (_req, res) => {
    const monitoring = { ...store.monitoring, uptime: process.uptime() };
    jsonResponse(res, monitoring);
  });

  router.get("/api/projects", (_req, res) => {
    const q = sanitizeString((_req.query.q as string) ?? "", "").toLowerCase();
    const projects = ensureArray(store.projects) as Dict[];
    const results = q ? projects.filter((p) => [p.name, p.description, p.owner].some((v) => String(v).toLowerCase().includes(q))) : projects;
    jsonResponse(res, { projects: results });
  });

  router.post("/api/projects", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["name", "owner"]);
    if (missing) return badRequest(res, missing);
    const projects = ensureArray(store.projects) as Dict[];
    const entry = {
      id: nextId++,
      name: sanitizeString((req.body as Dict).name as string),
      owner: sanitizeString((req.body as Dict).owner as string),
      progress: clamp(sanitizeNumber((req.body as Dict).progress, 0), 0, 100),
      tasks: clamp(sanitizeNumber((req.body as Dict).tasks, 0), 0, 1000),
      active: sanitizeBoolean((req.body as Dict).active, true),
      archived: sanitizeBoolean((req.body as Dict).archived, false),
      description: sanitizeString((req.body as Dict).description as string, ""),
      priority: sanitizeString((req.body as Dict).priority as string, "medium"),
      updated: new Date().toISOString().split("T")[0],
    };
    projects.push(entry);
    store.projects = projects;
    persist();
    pushAudit("project.create", entry.name, "system");
    return res.status(201).json({ project: entry });
  });

  router.get("/api/poolleague", (_req, res) => {
    jsonResponse(res, store.poolleague);
  });

  router.post("/api/poolleague/matches", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["table", "players"]);
    if (missing) return badRequest(res, missing);
    const players = ensureArray<string>((req.body as Dict).players, []);
    if (players.length < 2) return badRequest(res, "at least two players required");
    const score = ensureArray<number>((req.body as Dict).score, [0, 0]);
    const matches = ensureArray(store.poolleague.matches) as Dict[];
    const entry = {
      id: nextId++,
      table: sanitizeString((req.body as Dict).table as string),
      players,
      score: [sanitizeNumber(score[0]), sanitizeNumber(score[1], 0)],
      status: sanitizeString((req.body as Dict).status as string, "completed"),
      played_at: (req.body as Dict).played_at ? sanitizeString((req.body as Dict).played_at as string) : new Date().toISOString(),
    };
    matches.unshift(entry);
    store.poolleague.matches = matches;
    persist();
    pushAudit("poolleague.match", entry.table, "system");
    return res.status(201).json({ match: entry });
  });

  router.get("/api/config", (_req, res) => {
    jsonResponse(res, store.config);
  });

  router.patch("/api/config", express.json(), (req, res) => {
    const updates = req.body ?? {};
    const allowed = ["theme", "locale", "retention_days", "telemetry", "auth", "dimensions"];
    for (const key of allowed) {
      if (key in updates) {
        const value = (updates as Dict)[key];
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          (store.config as Dict)[key] = value;
        }
      }
    }
    persist();
    pushAudit("config.update", "config", "system");
    return jsonResponse(res, { config: store.config });
  });

  router.get("/api/command", (_req, res) => {
    const cmd = sanitizeString((_req.query.cmd as string) ?? "", "");
    if (!cmd) return jsonResponse(res, { cmd: "", out: "", err: "cmd required" });
    const allowed = ["echo hello", "date", "pwd"];
    const safeCmd = allowed.find((c) => cmd.toLowerCase().startsWith(c));
    if (!safeCmd) return jsonResponse(res, { cmd, out: "", err: "command not allowed" });
    const { execSync } = require("node:child_process");
    try {
      const out = execSync(safeCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return jsonResponse(res, { cmd: safeCmd, out: out.trim(), err: "" });
    } catch (error: any) {
      return jsonResponse(res, { cmd: safeCmd, out: "", err: error?.message ?? "command failed" });
    }
  });

  router.get("/api/settings", (_req, res) => {
    jsonResponse(res, store.settings);
  });

  router.patch("/api/settings", express.json(), (req, res) => {
    const updates = req.body ?? {};
    if ("theme" in updates && typeof updates.theme === "string") store.settings.theme = sanitizeString(updates.theme);
    if ("locale" in updates && typeof updates.locale === "string") store.settings.locale = sanitizeString(updates.locale);
    if ("retention_days" in updates) store.settings.retention_days = clamp(sanitizeNumber(updates.retention_days, store.settings.retention_days), 1, 365);
    if ("telemetry" in updates) store.settings.telemetry = sanitizeBoolean(updates.telemetry);
    if ("auth" in updates) store.settings.auth = sanitizeBoolean(updates.auth);
    persist();
    pushAudit("settings.update", "settings", "system");
    return jsonResponse(res, { settings: store.settings });
  });

  router.get("/api/developers", (_req, res) => {
    jsonResponse(res, { developers: store.developers, templates: ["display", "api", "plugin", "embedding-worker"] });
  });

  router.post("/api/developers/register", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["name"]);
    if (missing) return badRequest(res, missing);
    const developers = ensureArray(store.developers) as Dict[];
    const entry = {
      id: nextId++,
      name: sanitizeString((req.body as Dict).name as string),
      onboarded: true,
      templates_used: ensureArray<string>((req.body as Dict).templates_used, []),
      apps_registered: 0,
      last_active: new Date().toISOString().split("T")[0],
    };
    developers.push(entry);
    store.developers = developers;
    persist();
    pushAudit("developer.register", entry.name, "system");
    return res.status(201).json({ developer: entry });
  });

  router.get("/api/apps", (_req, res) => {
    jsonResponse(res, { apps: store.apps });
  });

  router.post("/api/apps", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["id", "name"]);
    if (missing) return badRequest(res, missing);
    const apps = ensureArray(store.apps) as Dict[];
    const existing = apps.find((a) => a.id === sanitizeString((req.body as Dict).id as string));
    if (existing) {
      Object.assign(existing, {
        name: sanitizeString((req.body as Dict).name as string, existing.name as string),
        version: sanitizeString((req.body as Dict).version as string, existing.version as string),
        owner: sanitizeString((req.body as Dict).owner as string, existing.owner as string),
        description: sanitizeString((req.body as Dict).description as string, existing.description as string),
        runtime: sanitizeString((req.body as Dict).runtime as string, existing.runtime as string),
        port: sanitizeNumber((req.body as Dict).port, existing.port as number),
        capabilities: ensureArray<string>((req.body as Dict).capabilities, existing.capabilities as string[]),
        dependencies: ensureArray<string>((req.body as Dict).dependencies, existing.dependencies as string[]),
        updated: new Date().toISOString().split("T")[0],
      });
      persist();
      pushAudit("app.update", existing.id, "system");
      return jsonResponse(res, { app: existing, updated: true });
    }

    const entry = {
      id: sanitizeString((req.body as Dict).id as string),
      name: sanitizeString((req.body as Dict).name as string),
      version: sanitizeString((req.body as Dict).version as string, "0.1.0"),
      owner: sanitizeString((req.body as Dict).owner as string, "CTO"),
      status: sanitizeString((req.body as Dict).status as string, "development"),
      runtime: sanitizeString((req.body as Dict).runtime as string, "static"),
      health: clamp(sanitizeNumber((req.body as Dict).health, 0), 0, 100),
      port: sanitizeNumber((req.body as Dict).port, 0),
      capabilities: ensureArray<string>((req.body as Dict).capabilities, []),
      updated: new Date().toISOString().split("T")[0],
      description: sanitizeString((req.body as Dict).description as string, ""),
      repository: sanitizeString((req.body as Dict).repository as string, ""),
      dependencies: ensureArray<string>((req.body as Dict).dependencies, []),
    };
    apps.push(entry);
    store.apps = apps;
    persist();
    pushAudit("app.register", entry.id, "system");
    return res.status(201).json({ app: entry });
  });

  router.patch("/api/apps/:id/health", express.json(), (req, res) => {
    const id = sanitizeString(req.params.id);
    const apps = ensureArray(store.apps) as Dict[];
    const target = apps.find((a) => a.id === id);
    if (!target) return notFound(res, "app not found");
    const incoming = (req.body?.health ?? req.body?.score ?? req.body?.value) as number | undefined;
    if (typeof incoming === "number" && Number.isFinite(incoming)) target.health = clamp(incoming, 0, 100);
    target.updated = new Date().toISOString().split("T")[0];
    persist();
    return jsonResponse(res, { id: target.id, health: target.health, updated: target.updated });
  });

  router.get("/api/self-improve", (_req, res) => {
    jsonResponse(res, { ...store.selfImprove, feedback: [...store.selfImprove.feedback] });
  });

  router.get("/api/rate-limit/status", (_req, res) => {
    jsonResponse(res, getRateLimitSnapshot());
  });

  router.post("/api/feedback", express.json(), (req, res) => {
    const missing = validateRequired(req.body ?? {}, ["comment"]);
    if (missing) return badRequest(res, missing);
    const feedback = ensureArray(store.selfImprove.feedback) as Dict[];
    const entry = {
      id: nextId++,
      source: sanitizeString((req.body as Dict).source as string, "user"),
      rating: clamp(sanitizeNumber((req.body as Dict).rating, 0), 0, 5),
      comment: sanitizeString((req.body as Dict).comment as string),
      date: sanitizeString((req.body as Dict).date as string, new Date().toISOString().split("T")[0]),
    };
    feedback.push(entry);
    store.selfImprove.feedback = feedback;
    store.selfImprove.iterations += 1;
    store.selfImprove.last_improvement = entry.date;
    persist();
    pushAudit("feedback.submit", "self-improve", entry.source);
    return res.status(201).json({ ok: true, received: entry });
  });

  router.patch("/api/self-improve/suggestions/:id/status", express.json(), (req, res) => {
    const id = Number(req.params.id);
    const suggestions = ensureArray(store.selfImprove.suggestions) as Dict[];
    const item = suggestions.find((s) => Number(s.id) === id);
    if (!item) return notFound(res, "suggestion not found");
    const status = sanitizeString((req.body as Dict).status as string, "");
    if (!status) return badRequest(res, "status required");
    item.status = status;
    if (status === "done") {
      store.selfImprove.last_improvement = new Date().toISOString();
      store.selfImprove.iterations += 1;
      store.selfImprove.confidence = Number((store.selfImprove.confidence + 0.005).toFixed(3));
    }
    persist();
    return jsonResponse(res, { id: item.id, status: item.status });
  });

  router.post("/api/telemetry", express.json(), (req, res) => {
    const body = req.body ?? {};
    const event = sanitizeString((body as Dict).event as string, "unknown");
    const telemetry = store.selfImprove.telemetry;
    if (event === "page_view") telemetry.page_views += 1;
    if (event === "error") telemetry.errors_last_24h += 1;
    if ((body as Dict).load_ms) telemetry.avg_load_ms = Math.round(telemetry.avg_load_ms * 0.9 + sanitizeNumber((body as Dict).load_ms) * 0.1);
    if ((body as Dict).latency_ms) telemetry.api_latency_p95_ms = Math.round(telemetry.api_latency_p95_ms * 0.9 + sanitizeNumber((body as Dict).latency_ms) * 0.1);
    const route = sanitizeString((body as Dict).route as string, "");
    telemetry.route_events = telemetry.route_events || {};
    telemetry.route_events[route] = (telemetry.route_events[route] || 0) + 1;
    persist();

    const avgRating = store.selfImprove.feedback.length ? store.selfImprove.feedback.reduce((s, f) => s + sanitizeNumber((f as Dict).rating, 0), 0) / store.selfImprove.feedback.length : 0;
    const suggestions = ensureArray(store.selfImprove.suggestions) as Dict[];
    const hasTitle = (title: string) => suggestions.some((s) => String(s.title).toLowerCase().includes(title) && sanitizeString(s.status as string, "") !== "done");

    if (event === "error" && !hasTitle("error")) {
      suggestions.push({ id: nextId++, title: "Reduce error rate with better validation", impact: "high", effort: "low", status: "proposed", detail: `Current errors_last_24h=${telemetry.errors_last_24h}`, confidence: 0.87, created_at: new Date().toISOString().split("T")[0] });
    }
    if ((body as Dict).load_ms && telemetry.avg_load_ms > 100 && !hasTitle("perf")) {
      suggestions.push({ id: nextId++, title: "Performance optimization pass", impact: "medium", effort: "high", status: "proposed", detail: `Current avg_load_ms=${telemetry.avg_load_ms}`, confidence: 0.78, created_at: new Date().toISOString().split("T")[0] });
    }
    if (avgRating < 4 && !hasTitle("ux")) {
      suggestions.push({ id: nextId++, title: "Improve UX and onboarding", impact: "high", effort: "medium", status: "proposed", detail: `Current avg rating=${avgRating.toFixed(2)}`, confidence: 0.82, created_at: new Date().toISOString().split("T")[0] });
    }
    if ((body as Dict).docs && !hasTitle("doc")) {
      suggestions.push({ id: nextId++, title: "Improve documentation and clarity", impact: "medium", effort: "low", status: "proposed", detail: "Documentation signal detected", confidence: 0.75, created_at: new Date().toISOString().split("T")[0] });
    }
    store.selfImprove.suggestions = suggestions;
    persist();
    return jsonResponse(res, { ok: true, telemetry });
  });

  router.post("/api/self-improve/learning-loop", express.json(), (_req, res) => {
    const feedback = ensureArray(store.selfImprove.feedback) as Dict[];
    const suggestions = ensureArray(store.selfImprove.suggestions) as Dict[];
    const avgRating = feedback.length ? feedback.reduce((s, f) => s + sanitizeNumber((f as Dict).rating, 0), 0) / feedback.length : 0;
    const uniqueErrors = new Set(feedback.filter((f) => /error|bug|fail/i.test(String((f as Dict).comment))).map((f) => String((f as Dict).comment)));
    const uniquePerf = new Set(feedback.filter((f) => /slow|performance|latency/i.test(String((f as Dict).comment))).map((f) => String((f as Dict).comment)));
    const uniqueUX = new Set(feedback.filter((f) => /confusing|hard|ui|onboard/i.test(String((f as Dict).comment))).map((f) => String((f as Dict).comment)));
    const uniqueDocs = new Set(feedback.filter((f) => /docs|documentation|unclear/i.test(String((f as Dict).comment))).map((f) => String((f as Dict).comment)));

    if (uniqueErrors.size && !suggestions.some((s) => /error/.test(String(s.title)) && sanitizeString(s.status as string, "") !== "done")) {
      suggestions.push({ id: nextId++, title: "Add error boundary and better validation", impact: "high", effort: "low", status: "proposed", detail: `Signals: ${uniqueErrors.size} unique error mentions`, confidence: 0.88, created_at: new Date().toISOString().split("T")[0] });
    }
    if (uniquePerf.size && !suggestions.some((s) => /perf/.test(String(s.title)) && sanitizeString(s.status as string, "") !== "done")) {
      suggestions.push({ id: nextId++, title: "Performance optimization pass", impact: "medium", effort: "high", status: "proposed", detail: `Signals: ${uniquePerf.size} unique performance mentions`, confidence: 0.74, created_at: new Date().toISOString().split("T")[0] });
    }
    if (avgRating < 4 && !suggestions.some((s) => /ux|onboard/.test(String(s.title)) && sanitizeString(s.status as string, "") !== "done")) {
      suggestions.push({ id: nextId++, title: "Improve UX and onboarding", impact: "high", effort: "medium", status: "proposed", detail: `Signal: avg rating ${avgRating.toFixed(2)}`, confidence: 0.81, created_at: new Date().toISOString().split("T")[0] });
    }
    if (uniqueDocs.size && !suggestions.some((s) => /doc/.test(String(s.title)) && sanitizeString(s.status as string, "") !== "done")) {
      suggestions.push({ id: nextId++, title: "Improve documentation and clarity", impact: "medium", effort: "low", status: "proposed", detail: `Signals: ${uniqueDocs.size} unique documentation mentions`, confidence: 0.76, created_at: new Date().toISOString().split("T")[0] });
    }

    store.selfImprove.iterations += 1;
    store.selfImprove.last_improvement = new Date().toISOString();
    store.selfImprove.learning_rate = Number((store.selfImprove.learning_rate + 0.01).toFixed(2));
    store.selfImprove.confidence = Number((store.selfImprove.confidence + 0.005).toFixed(3));
    store.selfImprove.suggestions = suggestions;
    persist();
    return jsonResponse(res, {
      ok: true,
      learning_rate: store.selfImprove.learning_rate,
      confidence: store.selfImprove.confidence,
      iterations: store.selfImprove.iterations,
      last_improvement: store.selfImprove.last_improvement,
      suggestions,
    });
  });

  router.post("/api/agent/self-improve/run", express.json(), async (req, res) => {
    const { prompt = "", scope = [] } = req.body ?? {};
    const allowedScopes = ["apps/brain-console", "agents", "packages/shared"];
    const safeScope = Array.isArray(scope) ? scope.filter((s) => allowedScopes.includes(s)) : [];
    const env = { ...process.env };
    const cwd = path.resolve(DATA_DIR, "..", "..", "..");
    const child = spawn("tsx", ["agents/self-improve-loop.ts"], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const timeoutMs = 300_000;
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    const exit = await new Promise<number | null>((resolve) => {
      child.on("exit", (code) => { clearTimeout(timer); resolve(code ?? null); });
      child.on("error", () => { clearTimeout(timer); resolve(-1); });
    });
    pushAudit("agent.self-improve.run", `exit=${exit}`, "system");
    return jsonResponse(res, { ok: exit === 0, exitCode: exit, stdout, stderr });
  });

  router.get("/api/agent/self-improve/status", (_req, res) => {
    const repoRoot = path.resolve(DATA_DIR, "..", "..", "..");
    const logDir = path.join(repoRoot, ".forgeos", "logs");
    let latest: string[] | null = null;
    let loopStatus = "idle";
    try {
      const files = fs.readdirSync(logDir);
      const cycleLogs = files.filter((f) => f.startsWith("self-improve-")).sort().reverse();
      if (cycleLogs.length) {
        const latestLog = path.join(logDir, cycleLogs[0]);
        const lines = fs.readFileSync(latestLog, "utf8").split("\n").filter(Boolean);
        latest = lines.slice(-20);
        const text = lines.join("\n");
        if (/Cycle \d+ complete/.test(text)) loopStatus = "ok";
        else if (/failed|exit \d+|error/i.test(text)) loopStatus = "error";
        else loopStatus = "running";
      }
    } catch {
      // ignore
    }
    return jsonResponse(res, { latestLog: latest || [], status: loopStatus });
  });

  router.get("/api/agent/self-improve/logs", (_req, res) => {
    const repoRoot = path.resolve(DATA_DIR, "..", "..", "..");
    const logDir = path.join(repoRoot, ".forgeos", "logs");
    try {
      const files = fs.readdirSync(logDir).filter((f) => f.startsWith("self-improve-")).sort().reverse();
      const entries = files.map((f) => {
        const raw = fs.readFileSync(path.join(logDir, f), "utf8").split("\n").filter(Boolean);
        return { file: f, lines: raw.slice(-50) };
      });
      return jsonResponse(res, { logs: entries });
    } catch {
      return jsonResponse(res, { logs: [] });
    }
  });

  router.post("/api/backup", (_req, res) => {
    const backupPath = path.join(DATA_DIR, `backup-${Date.now()}.json`);
    saveJson(backupPath, store);
    pushAudit("backup.create", backupPath, "system");
    return jsonResponse(res, { ok: true, backup: backupPath });
  });

  router.get("/api/openapi", (_req, res) => {
    const paths: Dict = {};
    router.stack
      .filter((l) => l.route)
      .forEach((layer: any) => {
        const methods = Object.keys(layer.route.methods).filter((m) => m !== "head").map((m) => m.toUpperCase());
        const path = layer.route.path;
        methods.forEach((method) => {
          (paths[path] ||= {})[method.toLowerCase()] = { summary: `${method} ${path}`, responses: { "200": { description: "OK" } } };
        });
      });
    const schema = {
      openapi: "3.0.0",
      info: { title: "ForgeOS Brain Console API", version: "1.0.0" },
      paths,
    };
    jsonResponse(res, schema);
  });

  router.post("/api/hotreload", express.json(), (req, res) => {
    const secret = sanitizeString((req.headers["x-reload-secret"] as string) ?? "", "");
    if (!secret) return badRequest(res, "reload secret required");
    pushAudit("hotreload.request", "server", "system");
    return jsonResponse(res, { ok: true, reloaded: false, reason: "handled by dev workflow" });
  });

  router.get("/api/logs", (_req, res) => {
    const limit = clamp(sanitizeNumber((_req.query.limit as string) ?? "20", 20), 1, 200);
    jsonResponse(res, { logs: requestLog.slice(0, limit), count: Math.min(limit, requestLog.length) });
  });

  router.get("/api/metrics", (_req, res) => {
    const logs = requestLog;
    const byRoute: Dict = {};
    for (const entry of logs) {
      const key = `${entry.method} ${entry.path}`;
      const current = byRoute[key] || { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
      current.count += 1;
      current.totalMs += entry.durationMs;
      current.maxMs = Math.max(current.maxMs, entry.durationMs);
      if (entry.status >= 500) current.errors += 1;
      else if (entry.status >= 400) current.errors += 1;
      byRoute[key] = current;
    }
    const items = Object.entries(byRoute).map(([route, metric]: [string, any]) => ({
      route,
      count: metric.count,
      errors: metric.errors,
      avgMs: Math.round(metric.totalMs / metric.count),
      maxMs: metric.maxMs,
    }));
    const total = logs.length;
    const errors = logs.filter((l) => l.status >= 400).length;
    jsonResponse(res, { total, errors, avgMs: total ? Math.round(logs.reduce((s, l) => s + l.durationMs, 0) / total) : 0, byRoute: items });
  });

  router.get("/api/agent/:id/workflows", (_req, res) => {
    const id = sanitizeString(_req.params.id, "");
    jsonResponse(res, { agent: id, workflows: store.workflows });
  });

  router.get("/api/agent/:id/messages", (_req, res) => {
    const id = sanitizeString(_req.params.id, "");
    const limit = clamp(sanitizeNumber((_req.query.limit as string) ?? "20", 20), 1, 200);
    const messages = [
      { ts: new Date().toISOString(), direction: "inbound", subject: "heartbeat", body: `Agent ${id} checked in` },
      { ts: new Date(Date.now() - 1000 * 60).toISOString(), direction: "outbound", subject: "task", body: `Delegated task to agent ${id}` },
    ].slice(0, limit);
    jsonResponse(res, { agent: id, messages });
  });

  router.get("/api/agent/:id/metrics", (_req, res) => {
    const id = sanitizeString(_req.params.id, "");
    jsonResponse(res, { agent: id, tasks: 12, successRate: 0.94, avgLatencyMs: 140, lastSeen: new Date().toISOString() });
  });

  router.post("/api/auth/login", express.json(), (req, res) => {
    const body = req.body ?? {};
    const username = sanitizeString((body as Dict).username as string, "");
    const password = sanitizeString((body as Dict).password as string, "");
    if (!username || !password) return badRequest(res, "username and password required");
    const fakeToken = Buffer.from(`${username}:${Date.now()}`).toString("base64");
    pushAudit("auth.login", username, "system");
    return jsonResponse(res, { ok: true, token: fakeToken, user: { username, role: "operator" } });
  });

  router.get("/api/state", (_req, res) => {
    jsonResponse(res, { store, generatedAt: new Date().toISOString() });
  });

  router.post("/api/restore", express.json(), (_req, res) => {
    pushAudit("restore.request", "store", "system");
    return jsonResponse(res, { ok: true, restored: false, reason: "restore requires verified backup payload" });
  });

  router.post("/api/capture/batch", express.json(), (req, res) => {
    const items = Array.isArray((req.body as Dict).items) ? (req.body as Dict).items : [];
    const pages = ensureArray(store.pages) as Dict[];
    const created: Dict[] = [];
    for (const raw of items.slice(0, 50)) {
      const item = raw as Dict;
      const slug = sanitizeString(item.slug as string, "");
      const type = sanitizeString(item.type as string, "note");
      const title = sanitizeString(item.title as string, slug);
      const body = sanitizeString(item.body as string, "");
      const status = sanitizeString(item.status as string, "draft");
      if (!slug) continue;
      const existing = pages.find((p) => p.slug === slug);
      if (existing) {
        existing.title = title || existing.title;
        existing.body = body || existing.body;
        existing.type = type || existing.type;
        existing.status = status;
        existing.updated_at = new Date().toISOString().split("T")[0];
        created.push(existing);
      } else {
        const entry = { slug, type, title, body, status, created_at: new Date().toISOString().split("T")[0], updated_at: new Date().toISOString().split("T")[0] };
        pages.push(entry);
        created.push(entry);
      }
    }
    store.pages = pages;
    persist();
    pushAudit("capture.batch", `items=${created.length}`, "system");
    return res.status(201).json({ ok: true, created: created.length, pages: created });
  });

  router.post("/api/import", express.json(), (req, res) => {
    const body = req.body ?? {};
    const format = sanitizeString((body as Dict).format as string, "json");
    if (format !== "json") return badRequest(res, "unsupported import format");
    pushAudit("import.request", format, "system");
    return jsonResponse(res, { ok: true, imported: 0, format });
  });

  router.get("/api/export/{*slug}", (req, res) => {
    const raw = Array.isArray((req.params as any).slug) ? (req.params as any).slug.join("/") : sanitizeString((req.params as any).slug as string, "");
    const slug = decodeURIComponent(raw.replace(/^\//, "")) || raw;
    const page = (ensureArray(store.pages) as Dict[]).find((p) => p.slug === slug);
    if (!page) return notFound(res, "page not found");
    pushAudit("export.page", slug, "system");
    return jsonResponse(res, { export: "json", slug, page: sanitizeEntity(page) });
  });

  router.get("/api/federation/remote", (_req, res) => {
    const children = ensureArray(store.federation.children) as Dict[];
    const remote = children.map((node) => ({ ...node, remote: true, syncStatus: node.status === "synced" ? "ok" : "degraded" }));
    jsonResponse(res, { root: store.federation.root, nodes: remote });
  });

  router.get("/api/agent/:id/log", (req, res) => {
    const id = sanitizeString(req.params.id, "");
    const logs = [
      { ts: new Date().toISOString(), level: "info", message: `Agent ${id} heartbeat`, agent: id },
      { ts: new Date(Date.now() - 1000 * 60).toISOString(), level: "info", message: `Agent ${id} completed task`, agent: id },
    ];
    jsonResponse(res, { id, logs });
  });

  router.use((_req, res, next) => next());

  return router;
}
