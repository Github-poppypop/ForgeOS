import express from "express";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { match } from "path-to-regexp";

const PORT = Number(process.env.PORT ?? 7777);
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");
const GBRAIN_HOME = "C:\\Projects\\ForgeOS";
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore<T>(fallback: T): T {
  try {
    ensureDataDir();
    if (!fs.existsSync(DATA_FILE)) return fallback;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    return { ...fallback, ...(typeof parsed === 'object' && parsed ? parsed : {}) } as T;
  } catch {
    return fallback;
  }
}

function saveStore(store: Record<string, unknown>) {
  ensureDataDir();
  const tmp = `${DATA_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function content_type(p: string): string | null {
  const ext = path.extname(p).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return map[ext] ?? null;
}

function cache_headers(path: string, headers: Record<string, string>) {
  if (path.endsWith('.html')) {
    headers['cache-control'] = 'no-store, no-cache, must-revalidate, max-age=0';
  } else if (path.endsWith('.js') || path.endsWith('.css')) {
    headers['cache-control'] = 'public, max-age=0, must-revalidate';
  }
  return headers;
}

function resolveAsset(p: string): { path?: string; headers?: Record<string, string> } {
  const safe = path.normalize(p).replace(/^(\.\.(\/)?)+/, '');
  for (const root of [DIST, PUBLIC]) {
    const full = path.join(root, safe);
    const rel = path.relative(root, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      const ct = content_type(full) ?? 'application/octet-stream';
      return { path: full, headers: { 'content-type': ct, 'x-content-type-options': 'nosniff' } };
    }
  }
  return {};
}

async function killPort(port: number): Promise<boolean> {
  try {
    const { execSync } = await import("node:child_process");
    const cmd = `powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"`;
    execSync(cmd, { encoding: "utf8", timeout: 8000, stdio: ["pipe", "pipe", "pipe"] });
    await new Promise((r) => setTimeout(r, 1500));
    return true;
  } catch {
    return false;
  }
}

async function ensureFreePort(port: number): Promise<number> {
  const tryConnect = () => new Promise<boolean>((resolve) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });

  if (await tryConnect()) {
    await killPort(port);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return port;
}

async function main() {
  const port = await ensureFreePort(PORT);
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`[react-express] ${req.method} ${req.path}`);
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.get('/api/status', (req, res) => {
    res.json({
      console_port: port,
      gbrain_health: { status: "degraded", engine: "pglite", owned_by: "console" },
      schema: "forgeos",
      ollama: { status: "offline" },
      embedding_model: "ollama:mxbai-embed-large (1024d, local)",
      isolation: `${GBRAIN_HOME} (separate from personal vaults & app brains)`,
      auth: false,
    });
  });

  app.get('/api/roles', (req, res) => {
    const roles = [
      { slug: "exec/ceo", role: "ceo", reports_to: "board", exists: false },
      { slug: "board/board", role: "board", reports_to: "charter", exists: true },
      { slug: "cto/cto", role: "cto", reports_to: "ceo", exists: true },
      { slug: "coo/coo", role: "coo", reports_to: "ceo", exists: true },
      { slug: "cfo/cfo", role: "cfo", reports_to: "ceo", exists: true },
      { slug: "cmo/cmo", role: "cmo", reports_to: "ceo", exists: true },
    ];
    res.json({ roles });
  });

  app.get('/api/search', (req, res) => {
    const q = (req.query.q as string) ?? "";
    res.json({ query: q, raw: "" });
  });

  app.post('/api/capture', (req, res) => {
    const body = req.body ?? {};
    res.json({ slug: body.slug, out: "", err: "" });
  });

  app.get('/api/capture', (req, res) => {
    res.json({ slug: "", out: "", err: "" });
  });

  app.get('/api/page/*slug', (req, res) => {
    const raw = String(req.params.slug || 'page/sample');
    const slug = decodeURIComponent(raw.replace(/\//g, '%2F').replace(/\+/g, '%2B'));
    res.json({ slug, body: 'sample body' });
  });

  app.delete('/api/page/*slug', (req, res) => {
    const raw = String(req.params.slug || 'page/sample');
    const slug = decodeURIComponent(raw.replace(/\//g, '%2F').replace(/\+/g, '%2B'));
    res.json({ slug, out: 'deleted', err: '' });
  });

  app.get('/api/schema', (req, res) => {
    res.json({ active: "forgeos", types: {} });
  });

  app.get('/api/timeline', (req, res) => {
    res.json({
      timeline: [
        { id: 1, date: '2026-08-01', title: 'Console launched', status: 'done', owner: 'CTO' },
        { id: 2, date: '2026-08-05', title: 'Self-improve added', status: 'done', owner: 'CPO' },
        { id: 3, date: '2026-08-09', title: 'App registry shipped', status: 'done', owner: 'CTO' },
        { id: 4, date: '2026-08-11', title: 'Dashboard polish', status: 'in-progress', owner: 'CPO' },
        { id: 5, date: '2026-08-14', title: 'Developer onboarding', status: 'proposed', owner: 'CTO' },
      ],
    });
  });

  app.get('/api/compliance', (req, res) => {
    res.json({
      policies: [
        { id: 1, name: 'Vault encryption', status: 'active', category: 'security', lastCheck: '2026-08-10' },
        { id: 2, name: 'Telemetry consent', status: 'active', category: 'privacy', lastCheck: '2026-08-09' },
        { id: 3, name: 'Plugin sandboxing', status: 'inactive', category: 'runtime', lastCheck: '2026-08-08' },
      ],
    });
  });

  app.get('/api/missions', (req, res) => {
    res.json({
      missions: [
        { id: 1, title: 'Ship self-improvement loop', status: 'active', phase: 'platform', owner: 'CPO', progress: 82, risk: 'medium', budget: 12000, teamSize: 4 },
        { id: 2, title: 'Developer onboarding', status: 'proposed', phase: 'growth', owner: 'CTO', progress: 35, risk: 'low', budget: 5000, teamSize: 2 },
        { id: 3, title: 'Sales demo refresh', status: 'in-progress', phase: 'outreach', owner: 'COO', progress: 60, risk: 'medium', budget: 3000, teamSize: 1 },
      ],
    });
  });

  app.get('/api/federation', (req, res) => {
    res.json({
      root: 'ForgeOS',
      model: 'read-down',
      children: [
        { id: 1, name: 'Brain Console', status: 'synced' },
        { id: 2, name: 'LifeOS', status: 'pending' },
        { id: 3, name: 'First App', status: 'synced' },
      ],
    });
  });

  app.get('/api/webhooks', (req, res) => {
    res.json({
      webhooks: [
        { id: 1, event: 'app.registered', url: 'http://127.0.0.1:7777/hooks', retries: 0, last: '2026-08-11T10:00:00.000Z' },
        { id: 2, event: 'feedback.submitted', url: 'http://127.0.0.1:7777/hooks', retries: 1, last: '2026-08-11T09:00:00.000Z' },
      ],
      deadLetter: [
        { id: 1, event: 'telemetry.batch', url: 'http://127.0.0.1:7777/hooks', reason: 'timeout' },
      ],
    });
  });

  app.get('/api/ledger', (req, res) => {
    const ledger = [
      { id: "1", date: "2026-08-10", title: "Use Bun for brain-console runtime", type: "approval", mission: "platform-stability", role: "cto", outcome: "approved" },
      { id: "2", date: "2026-08-09", title: "Port React UI from app.js", type: "proposal", mission: "forgeos-v2", role: "cfo", outcome: "pending" },
      { id: "3", date: "2026-08-08", title: "Memory leak in federation route", type: "incident", mission: "platform-stability", role: "cto", outcome: "approved" },
    ];
    res.json({ ledger });
  });

  app.get('/api/openapi', (req, res) => {
    res.json({
      openapi: "3.0.0",
      info: { title: "ForgeOS Brain Console API", version: "1.0.0" },
    });
  });

  app.get('/api/mcp', (req, res) => {
    res.json({
      tools: [
        { id: 1, name: 'brain.query', description: 'Search brains and pages', endpoint: 'local' },
        { id: 2, name: 'app.register', description: 'Register new app manifest', endpoint: 'local' },
      ],
      transports: [
        { id: 1, name: 'stdio', endpoint: 'local', status: 'open' },
        { id: 2, name: 'websocket', endpoint: 'ws://127.0.0.1:7777/ws', status: 'open' },
      ],
    });
  });

  app.get('/api/vault', (req, res) => {
    res.json({
      items: [
        { id: 1, kind: 'api-key', name: 'openai-key', updated: '2026-08-10' },
        { id: 2, kind: 'secret', name: 'webhook-signing', updated: '2026-08-09' },
      ],
      encrypted: true,
    });
  });

  app.get('/api/embed', (req, res) => {
    res.json({ queued: 3, model: 'ollama:mxbai-embed-large', dimensions: 1024 });
  });

  app.get('/api/audit', (req, res) => {
    res.json({
      events: [
        { id: 1, action: 'app.register', actor: 'CTO', target: 'first-app', ts: '2026-08-11T10:00:00.000Z' },
        { id: 2, action: 'feedback.submit', actor: 'system', target: 'self-improve', ts: '2026-08-11T09:00:00.000Z' },
        { id: 3, action: 'telemetry.page_view', actor: 'system', target: '/dashboard', ts: '2026-08-11T08:00:00.000Z' },
      ],
    });
  });

  app.get('/api/config', (req, res) => {
    res.json({ ollama: "http://localhost:11434/v1", dimensions: 1024, isolation: GBRAIN_HOME });
  });

  app.get('/api/command', (req, res) => {
    const cmd = (req.query.cmd as string) || "";
    res.json({ cmd, out: "", err: "" });
  });

  app.get('/api/governance', (req, res) => {
    res.json({ root: GBRAIN_HOME, rules: [] });
  });

  app.get('/api/monitoring', (req, res) => {
    const cpu = 24;
    const memory = 182;
    const uptime = process.uptime();
    res.json({ cpu, memory, uptime });
  });

  app.get('/api/workflows', (req, res) => {
    res.json({
      workflows: [
        { id: 1, name: 'Deploy console', status: 'running', trigger: 'push', runs: 18, progress: 60 },
        { id: 2, name: 'Embed pipeline', status: 'failed', trigger: 'schedule', runs: 5, progress: 0 },
      ],
    });
  });

  app.get('/api/marketplace', (req, res) => {
    res.json({
      packs: [
        { id: 1, name: 'forgeos-core', category: 'tool', installed: true, updateAvailable: false, downloads: 128, rating: 4.8, version: '1.2.0' },
        { id: 2, name: 'theme-obsidian', category: 'theme', installed: true, updateAvailable: true, downloads: 84, rating: 4.4, version: '0.9.1' },
        { id: 3, name: 'embed-worker', category: 'plugin', installed: false, updateAvailable: false, downloads: 41, rating: 4.1, version: '0.3.0' },
      ],
    });
  });

  app.get('/api/plugins', (req, res) => {
    res.json({
      plugins: [
        { id: 1, name: 'forgeos-ui', enabled: true, version: '1.0.0', error: null },
        { id: 2, name: 'embed-proxy', enabled: false, version: '0.4.0', error: 'missing dependency' },
      ],
    });
  });

  app.get('/api/projects', (req, res) => {
    res.json({
      projects: [
        { id: 1, name: 'ForgeOS', owner: 'CTO', progress: 92, tasks: 14, active: true, archived: false, updated: '2026-08-11' },
        { id: 2, name: 'Brain Console', owner: 'CPO', progress: 76, tasks: 9, active: true, archived: false, updated: '2026-08-10' },
        { id: 3, name: 'LifeOS', owner: 'CTO', progress: 40, tasks: 6, active: true, archived: false, updated: '2026-08-09' },
      ],
    });
  });

  app.get('/api/settings', (req, res) => {
    res.json({ auth: false, telemetry: false, theme: 'dark', locale: 'en', retention_days: 30 });
  });

  app.get('/api/poolleague', (req, res) => {
    res.json({
      tables: [
        { id: 1, name: 'Table 1', status: 'open' },
        { id: 2, name: 'Table 2', status: 'occupied' },
      ],
      players: [
        { id: 1, name: 'Atlas', club: 'Forge', rank: 'A', wins: 18, losses: 4 },
        { id: 2, name: 'Nova', club: 'Vault', rank: 'B', wins: 14, losses: 9 },
        { id: 3, name: 'Rune', club: 'Core', rank: 'A', wins: 12, losses: 6 },
      ],
      matches: [
        { id: 1, table: 'Table 1', players: ['Atlas', 'Nova'], score: [7, 5], status: 'completed' },
        { id: 2, table: 'Table 2', players: ['Rune', 'Atlas'], score: [3, 7], status: 'completed' },
      ],
    });
  });

  const defaultApps = [
    { id: 'brain-console', name: 'Brain Console', version: '1.0.0', owner: 'CTO', status: 'running', runtime: 'node', health: 94, port: 7777, capabilities: ['display', 'forgeos-console-link'], updated: '2026-08-11' },
    { id: 'lifeos', name: 'LifeOS', version: '1.0.0', owner: 'CPO', status: 'design', runtime: 'node', health: 72, port: 3001, capabilities: ['brain-dna', 'memory-engine', 'mission-engine'], updated: '2026-08-10' },
    { id: 'first-app', name: 'First App', version: '0.1.0', owner: 'CTO', status: 'development', runtime: 'static', health: 88, port: 4173, capabilities: ['display'], updated: '2026-08-09' },
    { id: 'poolleague', name: 'PoolLeague', version: '1.0.0', owner: 'COO', status: 'running', runtime: 'node', health: 91, port: 3002, capabilities: ['display'], updated: '2026-08-11' },
    { id: 'sdk', name: 'ForgeOS SDK', version: '1.0.0', owner: 'CTO', status: 'stable', runtime: 'node', health: 97, port: 0, capabilities: ['sdk'], updated: '2026-08-10' },
  ];
  const appsStore = loadStore<{ id: string; name: string; version: string; owner: string; status: string; runtime: string; health: number; port: number; capabilities: string[]; updated: string }[]>(defaultApps);

  app.get('/api/apps', (req, res) => {
    res.json({ apps: appsStore.map(({ id, name, version, owner, status, runtime, health, port, capabilities, updated }) => ({ id, name, version, owner, status, runtime, health, port, capabilities, updated })) });
  });

  app.post('/api/apps', express.json(), (req, res) => {
    const body = req.body ?? {};
    const id = String(body.id || `app-${Date.now()}`).trim();
    const name = String(body.name || 'Untitled App').trim();
    const version = String(body.version || '0.1.0').trim();
    const owner = String(body.owner || 'CTO').trim();
    const runtime = String(body.runtime || 'static').trim();
    const capabilities = Array.isArray(body.capabilities) ? body.capabilities : [];
    const entry = { id, name, version, owner, status: 'development', runtime, health: 0, port: body.port || 0, capabilities, updated: new Date().toISOString().split('T')[0] };
    appsStore.push(entry);
    persist();
    res.status(201).json({ app: entry });
  });

  app.patch('/api/apps/:id/health', express.json(), (req, res) => {
    const target = appsStore.find((a) => a.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'app not found' });
    const incoming = (req.body?.health ?? req.body?.score ?? req.body?.value) as number | undefined;
    if (Number.isFinite(incoming)) target.health = Math.min(100, Math.max(0, incoming));
    target.updated = new Date().toISOString().split('T')[0];
    persist();
    res.json({ id: target.id, health: target.health, updated: target.updated });
  });

  const defaultSelfImprove = {
    learning_rate: 0.87,
    confidence: 0.91,
    iterations: 142,
    last_improvement: '2026-08-11T00:00:00.000Z',
    suggestions: [
      { id: 1, title: 'Add caching layer', impact: 'high', effort: 'medium', status: 'proposed' },
      { id: 2, title: 'Improve error messages', impact: 'medium', effort: 'low', status: 'in-progress' },
      { id: 3, title: 'Add health checks', impact: 'high', effort: 'low', status: 'done' },
      { id: 4, title: 'Optimize bundle size', impact: 'medium', effort: 'high', status: 'proposed' },
      { id: 5, title: 'Add dark mode toggle', impact: 'low', effort: 'low', status: 'done' },
    ],
    telemetry: {
      page_views: 1240,
      errors_last_24h: 3,
      avg_load_ms: 210,
      api_latency_p95_ms: 145,
    },
    feedback: [
      { id: 1, source: 'user', rating: 4, comment: 'Great dashboard', date: '2026-08-10' },
      { id: 2, source: 'user', rating: 5, comment: 'Love the new theme system', date: '2026-08-11' },
      { id: 3, source: 'system', rating: 3, comment: 'Slow on mobile', date: '2026-08-09' },
    ] as any[],
  } as const;

  const selfImproveState = loadStore<typeof defaultSelfImprove>(defaultSelfImprove as any);
  const persist = () => saveStore({ appsStore, selfImproveState });
  const selfImprovePersist = () => saveStore({ selfImproveState } as any);

  app.get('/api/self-improve', (req, res) => {
    res.json({ ...selfImproveState, feedback: [...selfImproveState.feedback] });
  });

  app.post('/api/feedback', express.json(), (req, res) => {
    const body = req.body ?? {};
    const entry = {
      id: selfImproveState.feedback.length + 1,
      source: body.source || 'user',
      rating: Number(body.rating) || 0,
      comment: body.comment || '',
      date: body.date || new Date().toISOString().split('T')[0],
    };
    selfImproveState.feedback.push(entry);
    selfImproveState.iterations += 1;
    selfImproveState.last_improvement = entry.date;
    persist();
    res.status(201).json({ ok: true, received: entry });
  });

  app.patch('/api/self-improve/suggestions/:id/status', express.json(), (req, res) => {
    const id = Number(req.params.id);
    const item = selfImproveState.suggestions.find((s) => s.id === id);
    if (!item) return res.status(404).json({ error: 'not found' });
    const status = String(req.body?.status || '').trim();
    if (!status) return res.status(400).json({ error: 'status required' });
    item.status = status;
    persist();
    res.json({ id: item.id, status: item.status });
  });

  app.post('/api/telemetry', express.json(), (req, res) => {
    const body = req.body ?? {};
    const event = String(body.event || 'unknown');
    if (event === 'page_view') selfImproveState.telemetry.page_views += 1;
    if (event === 'error') selfImproveState.telemetry.errors_last_24h += 1;
    if (body.load_ms) selfImproveState.telemetry.avg_load_ms = Math.round((selfImproveState.telemetry.avg_load_ms * 0.9) + (Number(body.load_ms) * 0.1));
    if (body.latency_ms) selfImproveState.telemetry.api_latency_p95_ms = Math.round((selfImproveState.telemetry.api_latency_p95_ms * 0.9) + (Number(body.latency_ms) * 0.1));
    persist();
    res.json({ ok: true, telemetry: selfImproveState.telemetry });
  });

  app.post('/api/self-improve/learning-loop', express.json(), (req, res) => {
    const avgRating = selfImproveState.feedback.length ? (selfImproveState.feedback.reduce((s, f) => s + (f.rating || 0), 0) / selfImproveState.feedback.length) : 0;
    if (avgRating < 4.0 && !selfImproveState.suggestions.some((s) => s.title.toLowerCase().includes('ux') && s.status !== 'done')) {
      selfImproveState.suggestions.push({ id: Date.now(), title: 'Improve UX and onboarding', impact: 'high', effort: 'medium', status: 'proposed' });
    }
    if (selfImproveState.telemetry.errors_last_24h > 2 && !selfImproveState.suggestions.some((s) => s.title.toLowerCase().includes('error') && s.status !== 'done')) {
      selfImproveState.suggestions.push({ id: Date.now() + 1, title: 'Reduce error rate with better validation', impact: 'high', effort: 'low', status: 'proposed' });
    }
    if (selfImproveState.telemetry.avg_load_ms > 100 && !selfImproveState.suggestions.some((s) => s.title.toLowerCase().includes('perf') && s.status !== 'done')) {
      selfImproveState.suggestions.push({ id: Date.now() + 2, title: 'Performance optimization pass', impact: 'medium', effort: 'high', status: 'proposed' });
    }
    selfImproveState.iterations += 1;
    selfImproveState.last_improvement = new Date().toISOString();
    selfImproveState.learning_rate = Number((selfImproveState.learning_rate + 0.01).toFixed(2));
    selfImproveState.confidence = Number((selfImproveState.confidence + 0.005).toFixed(3));
    persist();
    res.json({ ok: true, learning_rate: selfImproveState.learning_rate, confidence: selfImproveState.confidence, iterations: selfImproveState.iterations, last_improvement: selfImproveState.last_improvement, suggestions: selfImproveState.suggestions });
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'not found' });
    }
    next();
  });

  app.use((req, res, next) => {
    const asset = resolveAsset(req.path);
    if (asset.path) {
      return res.sendFile(asset.path, { headers: asset.headers });
    }
    next();
  });

  app.get('/', (req, res) => {
    const indexAsset = resolveAsset('/index.html');
    if (indexAsset.path) {
      return res.sendFile(indexAsset.path, { headers: indexAsset.headers });
    }
    return res.status(404).send('not found');
  });

  app.get(/^\/[^?#]*$/, (req, res) => {
    const indexAsset = resolveAsset('/index.html');
    if (indexAsset.path) {
      return res.sendFile(indexAsset.path, { headers: indexAsset.headers });
    }
    return res.status(404).send('not found');
  });

  app.listen(port, '127.0.0.1', () => {
    console.log(`[react-express] on http://127.0.0.1:${port}`);
  });
}

main().catch((err) => {
  console.error(`[react-express] ${err?.message ?? err}`);
  process.exit(1);
});
