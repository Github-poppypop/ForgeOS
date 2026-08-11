import express from "express";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 7777);
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");
const GBRAIN_HOME = "C:\\Projects\\ForgeOS";

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
    res.json({ timeline: [] });
  });

  app.get('/api/compliance', (req, res) => {
    res.json({ policies: [] });
  });

  app.get('/api/missions', (req, res) => {
    res.json({ missions: [] });
  });

  app.get('/api/federation', (req, res) => {
    res.json({ root: "ForgeOS", model: "read-down", children: [] });
  });

  app.get('/api/webhooks', (req, res) => {
    res.json({ webhooks: [], deadLetter: [] });
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
    res.json({ tools: [], transports: [] });
  });

  app.get('/api/vault', (req, res) => {
    res.json({ items: [], encrypted: true });
  });

  app.get('/api/embed', (req, res) => {
    res.json({ queued: 0, model: "ollama:mxbai-embed-large" });
  });

  app.get('/api/audit', (req, res) => {
    res.json({ events: [] });
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
    res.json({ cpu: 0, memory: 0, uptime: 0 });
  });

  app.get('/api/workflows', (req, res) => {
    res.json({ workflows: [] });
  });

  app.get('/api/marketplace', (req, res) => {
    res.json({ packs: [] });
  });

  app.get('/api/plugins', (req, res) => {
    res.json({ plugins: [] });
  });

  app.get('/api/projects', (req, res) => {
    res.json({ projects: [] });
  });

  app.get('/api/settings', (req, res) => {
    res.json({ auth: false, telemetry: false });
  });

  app.get('/api/poolleague', (req, res) => {
    res.json({ tables: [], players: [], matches: [] });
  });

  const appsStore = [
    { id: 'brain-console', name: 'Brain Console', version: '1.0.0', owner: 'CTO', status: 'running', runtime: 'node', health: 94, port: 7777, capabilities: ['display', 'forgeos-console-link'], updated: '2026-08-11' },
    { id: 'lifeos', name: 'LifeOS', version: '1.0.0', owner: 'CPO', status: 'design', runtime: 'node', health: 72, port: 3001, capabilities: ['brain-dna', 'memory-engine', 'mission-engine'], updated: '2026-08-10' },
    { id: 'first-app', name: 'First App', version: '0.1.0', owner: 'CTO', status: 'development', runtime: 'static', health: 88, port: 4173, capabilities: ['display'], updated: '2026-08-09' },
    { id: 'poolleague', name: 'PoolLeague', version: '1.0.0', owner: 'COO', status: 'running', runtime: 'node', health: 91, port: 3002, capabilities: ['display'], updated: '2026-08-11' },
    { id: 'sdk', name: 'ForgeOS SDK', version: '1.0.0', owner: 'CTO', status: 'stable', runtime: 'node', health: 97, port: 0, capabilities: ['sdk'], updated: '2026-08-10' },
  ];

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
    res.status(201).json({ app: entry });
  });

  app.patch('/api/apps/:id/health', express.json(), (req, res) => {
    const target = appsStore.find((a) => a.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'app not found' });
    const incoming = (req.body?.health ?? req.body?.score ?? req.body?.value) as number | undefined;
    if (Number.isFinite(incoming)) target.health = Math.min(100, Math.max(0, incoming));
    target.updated = new Date().toISOString().split('T')[0];
    res.json({ id: target.id, health: target.health, updated: target.updated });
  });

  const selfImproveState = {
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
  };

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
    res.status(201).json({ ok: true, received: entry });
  });

  app.patch('/api/self-improve/suggestions/:id/status', express.json(), (req, res) => {
    const id = Number(req.params.id);
    const item = selfImproveState.suggestions.find((s) => s.id === id);
    if (!item) return res.status(404).json({ error: 'not found' });
    const status = String(req.body?.status || '').trim();
    if (!status) return res.status(400).json({ error: 'status required' });
    item.status = status;
    res.json({ id: item.id, status: item.status });
  });

  app.post('/api/telemetry', express.json(), (req, res) => {
    const body = req.body ?? {};
    const event = String(body.event || 'unknown');
    if (event === 'page_view') selfImproveState.telemetry.page_views += 1;
    if (event === 'error') selfImproveState.telemetry.errors_last_24h += 1;
    if (body.load_ms) selfImproveState.telemetry.avg_load_ms = Math.round((selfImproveState.telemetry.avg_load_ms * 0.9) + (Number(body.load_ms) * 0.1));
    if (body.latency_ms) selfImproveState.telemetry.api_latency_p95_ms = Math.round((selfImproveState.telemetry.api_latency_p95_ms * 0.9) + (Number(body.latency_ms) * 0.1));
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

  app.listen(port, '127.0.0.1', () => {
    console.log(`[react-express] on http://127.0.0.1:${port}`);
  });
}

main().catch((err) => {
  console.error(`[react-express] ${err?.message ?? err}`);
  process.exit(1);
});
