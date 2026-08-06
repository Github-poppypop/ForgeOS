import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import zlib from 'node:zlib';

const app = express();
const PORT = Number(process.env.PORT ?? 7777);
const GBRAIN_BIN = process.env.GBRAIN_BIN ?? 'bunx';
const GBRAIN_CWD = process.env.GBRAIN_CWD ?? 'C:\\Users\\pop\\forge-gbrain';
const GBRAIN_HOME = 'C:\\ForgeOS';
const CONSOLE_TOKEN = process.env.CONSOLE_TOKEN || '';
const RATE = Number(process.env.RATE_PER_MIN ?? 120);

const ROOT = path.resolve(process.cwd(), '../..');
const PUBLIC = path.resolve(process.cwd(), 'public');

// metrics
const metrics = { requests: 0, errors: 0, byRoute: new Map() };
function trackReq(p, status) {
  metrics.requests++;
  if (status >= 400) metrics.errors++;
  const entry = metrics.byRoute.get(p) || { requests: 0, errors: 0 };
  entry.requests++;
  if (status >= 400) entry.errors++;
  metrics.byRoute.set(p, entry);
}

const GBRAIN_ENV = { ...process.env, GBRAIN_HOME, OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1', OLLAMA_MODELS: process.env.OLLAMA_MODELS || 'D:\\ollama', GBRAIN_EMBEDDING_DIMENSIONS: process.env.GBRAIN_EMBEDDING_DIMENSIONS || '1024' };
delete GBRAIN_ENV.DATABASE_URL;

const ROLE_SLUGS = ['board/board', 'exec/ceo', 'cto/cto', 'cpo/cpo', 'coo/coo', 'cmo/cmo', 'cfo/cfo'];

const hits = {};
function rateOk(ip) {
  const now = Date.now();
  hits[ip] = (hits[ip] || []).filter(t => now - t < 60000);
  if (hits[ip].length >= RATE) return 0;
  hits[ip].push(now);
  return RATE - hits[ip].length;
}

const requestLog = [];
const maxRequestLog = 200;
function recordRequestLog(entry) {
  requestLog.push(entry);
  if (requestLog.length > maxRequestLog) requestLog.splice(0, requestLog.length - maxRequestLog);
}

function json(data, status = 200, extraHeaders = {}) {
  return express.response.status(status).json({ ...extraHeaders, ...(typeof data === 'object' ? data : { data }) });
}

function authed(req) {
  if (!CONSOLE_TOKEN) return true;
  const h = req.headers.authorization || '';
  return h === `Bearer ${CONSOLE_TOKEN}` || h === CONSOLE_TOKEN;
}

function runGbrain(args, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(GBRAIN_BIN, ['gbrain', ...args], { cwd: GBRAIN_CWD, env: GBRAIN_ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timeout = setTimeout(() => proc.kill(), opts.timeoutMs ?? 60000);
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.on('close', code => {
      clearTimeout(timeout);
      resolve({ code: code ?? 0, out, err });
    });
    if (opts.stdin) { proc.stdin.write(opts.stdin); proc.stdin.end(); }
  });
}

async function ollamaOk() {
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t0;
    trackReq(req.path, res.statusCode);
    const ip = req.headers['x-forwarded-for'] || 'local';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${res.statusCode} (${ms}ms) ${ip}`);
    const id = req.headers['x-request-id'] || randomUUID();
    recordRequestLog({ id, method: req.method, path: req.path, status: res.statusCode, ms, ip, ts: new Date().toISOString() });
    if (res.statusCode >= 400) console.log(JSON.stringify({ level: 'error', id, path: req.path, status: res.statusCode, payload: JSON.stringify({ method: req.method, path: req.path, status: res.statusCode, ms }), ts: new Date().toISOString() }));
    res.setHeader('x-request-id', id);
  });
  next();
});

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || 'local';
  const remaining = rateOk(ip);
  if (remaining <= 0) {
    res.setHeader('x-ratelimit-limit', String(RATE));
    res.setHeader('x-ratelimit-remaining', '0');
    return res.status(429).json({ error: 'rate limited' });
  }
  res.setHeader('x-ratelimit-limit', String(RATE));
  res.setHeader('x-ratelimit-remaining', String(remaining));
  next();
}

app.use('/api', rateLimit, (req, res, next) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  next();
});

const ct = { ts: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8', svg: 'image/svg+xml', ico: 'image/x-icon', html: 'text/html; charset=utf-8' };

function safeStat(file) {
  try { return statSync(file); } catch { return null; }
}

app.use('/src', express.static(ROOT, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).slice(1);
    if (ct[ext]) res.setHeader('content-type', ct[ext]);
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'geolocation=(), microphone=(), camera=()');
  }
}));

app.use(express.static(PUBLIC, {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).slice(1);
    if (ct[ext]) res.setHeader('content-type', ct[ext]);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'geolocation=(), microphone=(), camera=()');
  }
}));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/status', async (req, res) => {
  let schema = { out: 'unavailable', err: '' };
  try { schema = await runGbrain(['schema', 'active']); } catch {}
  const oll = await ollamaOk();
  res.json({ console_port: PORT, gbrain_health: { status: schema.out ? 'ok' : 'degraded', engine: 'pglite', owned_by: 'console' }, schema: schema.out, ollama: oll, embedding_model: 'ollama:mxbai-embed-large (1024d, local)', isolation: 'C:\\ForgeOS (separate from personal vaults & app brains)', auth: !!CONSOLE_TOKEN });
});

app.get('/api/brains', (req, res) => res.json({
  current: 'forgeos',
  brains: [
    { id: 'forgeos', home: 'C:\\ForgeOS', role: 'root', isolated: true },
    { id: 'lifeos', home: 'C:\\Projects\\ForgeOS\\apps\\lifeos\\.gbrain', role: 'app-child', isolated: true },
  ],
  note: 'Switch GBRAIN_HOME + restart console to mount a different isolated brain.',
}));

app.get('/api/openapi', (req, res) => res.json({
  openapi: '3.0.0',
  info: { title: 'ForgeOS Brain Console API', version: '1.0.0' },
  paths: {
    '/api/status': { get: { summary: 'Brain + console status' } },
    '/api/roles': { get: { summary: 'C-suite role rows' } },
    '/api/page/{slug}': { get: { summary: 'Get a brain page' } },
    '/api/search?q=': { get: { summary: 'Semantic search (Ollama)' } },
    '/api/capture': { post: { summary: 'Capture a page' } },
    '/api/embed': { post: { summary: 'Re-embed all (Ollama)' } },
    '/api/vault': { get: { summary: 'Obsidian vault file list' } },
    '/api/federation': { get: { summary: 'Brain federation topology' } },
    '/api/audit': { get: { summary: 'Audit trail (gbrain list)' } },
    '/api/schema': { get: { summary: 'Active schema pack' } },
    '/api/backup': { post: { summary: 'Download brain zip' } },
    '/api/brains': { get: { summary: 'Multi-brain metadata' } },
    '/api/restore': { post: { summary: 'Restore brain zip' } },
    '/api/metrics': { get: { summary: 'Metrics' } },
    '/api/metrics/prometheus': { get: { summary: 'Prometheus text metrics' } },
    '/api/agent/workflows': { get: { summary: 'Agent workflows' } },
    '/api/agent/messages': { get: { summary: 'Agent messages' } },
    '/api/agent/metrics': { get: { summary: 'Agent metrics' } },
    '/api/federation/remote': { get: { summary: 'Remote brain metadata' } },
    '/api/webhooks': { get: { summary: 'Webhooks' } },
    '/api/plugins': { get: { summary: 'Plugins' } },
    '/api/hotreload': { post: { summary: 'Plugin hot reload' } },
    '/api/state': { get: { summary: 'Console state' }, post: { summary: 'Save console state' } },
    '/api/auth/login': { post: { summary: 'Login' } },
    '/api/capture/batch': { post: { summary: 'Batch capture' } },
    '/api/import': { post: { summary: 'Import items' } },
    '/api/export/{slug}': { get: { summary: 'Export brain page' } },
    '/api/health/stream': { get: { summary: 'SSE live health' } },
  },
}));

app.get('/api/roles', async (req, res) => {
  const list = await runGbrain(['list']);
  const lines = list.out.split('\n');
  const roles = ROLE_SLUGS.map(slug => {
    const hit = lines.find(l => l.startsWith(slug + '\t'));
    const title = hit ? hit.split('\t').pop() ?? '' : '';
    const name = title.match(/^type: role/) ? '' : title;
    return { slug, role: name || slug.split('/').pop(), reports_to: slug === 'exec/ceo' ? 'board' : (slug === 'board/board' ? 'charter' : 'ceo'), exists: !!hit };
  });
  res.json({ roles });
});

app.get('/api/page/:slug', async (req, res) => {
  const r = await runGbrain(['get', req.params.slug]);
  if (r.out.includes('not found')) return res.status(404).json({ error: 'not found' });
  res.json({ slug: req.params.slug, body: r.out });
});

app.delete('/api/page/:slug', async (req, res) => {
  const r = await runGbrain(['delete', req.params.slug], { timeoutMs: 30000 });
  if (r.code !== 0 || r.out.includes('not found')) return res.status(404).json({ error: r.err || 'not found' });
  res.json({ ok: true, slug: req.params.slug });
});

app.get('/api/search', async (req, res) => {
  const q = req.query.q ?? '';
  const r = await runGbrain(['search', q]);
  res.json({ query: q, raw: r.out });
});

app.get('/api/schema', async (req, res) => {
  const active = await runGbrain(['schema', 'active']);
  const types = await runGbrain(['schema', 'types']).catch(() => ({ out: `see ${path.join(ROOT, '.gbrain', 'schema-packs', 'forgeos', 'pack.yaml')}` }));
  res.json({ active: active.out, types: types.out });
});

app.get('/api/audit', async (req, res) => {
  const r = await runGbrain(['list', '--json']).catch(() => ({ out: '' }));
  res.json({ raw: r.out });
});

app.get('/api/federation', (req, res) => res.json({ root: 'ForgeOS (C:\\ForgeOS\\.gbrain)', model: 'federated: read-down only, write-up governance only, no lateral mingle', children: ['apps/lifeos (isolated child brain)'], see: 'knowledge-universe/BRAIN-FEDERATION.md' }));

app.get('/api/governance', (req, res) => {
  const tree = {};
  for (const sub of ['constitution', 'standards', 'rfcs', 'laws', 'roadmap']) {
    const dir = path.join(ROOT, 'governance', sub);
    try { tree[sub] = readdirSync(dir).filter(f => f.endsWith('.md')).sort(); }
    catch { tree[sub] = []; }
  }
  res.json({ base: 'C:\\Projects\\ForgeOS\\governance', sacred: true, authority: 'Constitution > Laws > Standards > RFCs > Missions > Code', tree });
});

app.get('/api/vault', (req, res) => {
  const base = 'C:\\ForgeOS\\vault';
  const files = [];
  try {
    for (const f of readdirSync(base)) files.push(f);
  } catch {}
  res.json({ base, files, git: 'branch master (untracked role pages)' });
});

app.get('/api/webhooks', (req, res) => res.json({ webhooks: [], deadLetter: [], ts: Date.now() }));

app.get('/api/request-log', (req, res) => res.json({ log: requestLog.slice(-100), total: requestLog.length }));

app.get('/api/health/detailed', (req, res) => {
  const now = Date.now();
  const lastMinute = requestLog.filter(e => now - new Date(e.ts).getTime() < 60000);
  const errors = requestLog.filter(e => e.status >= 400).slice(-10);
  res.json({
    ok: true,
    ts: now,
    uptime: process.uptime ? process.uptime() : 0,
    requests: { lastMinute: lastMinute.length, total: requestLog.length },
    errors: { lastMinute: lastMinute.filter(e => e.status >= 400).length, recent: errors },
    rateLimit: { limit: RATE, activeIps: Object.keys(hits).length },
    auth: !!CONSOLE_TOKEN,
  });
});

app.post('/api/backup', async (req, res) => {
  const base = 'C:\\ForgeOS\\.gbrain\\brain.pglite';
  const entries = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else entries.push({ name: path.relative(base, full), data: readFileSync(full).toString('base64') });
    }
  };
  try { walk(base); } catch (e) { return res.status(500).json({ error: 'backup failed: ' + String(e.message) }); }
  const bundle = Buffer.from(JSON.stringify({ base, files: entries, ts: Date.now() }));
  const gz = zlib.gzipSync(bundle);
  res.setHeader('content-type', 'application/gzip');
  res.setHeader('content-disposition', 'attachment; filename="forgeos-brain.json.gz"');
  res.send(gz);
});

const ADVANCE = { proposed: 'approved', approved: 'executing', executing: 'review', review: 'done' };
const missionStore = [
  { id: 'RFC-0000', title: 'RFC-0000 governance build', status: 'done', phase: 'foundation', progress: 100, eta: '2025-01-01T00:00:00Z', dependencies: [], owner: 'cto/cto' },
  { id: 'POOL-E1', title: 'PoolLeague E1 backend reconcile', status: 'proposed', phase: 'backend', progress: 0, eta: '2025-06-01T00:00:00Z', dependencies: ['RFC-0000'], owner: 'cto/cto' },
  { id: 'POOL-SUB', title: 'PoolLeague submodule conversion', status: 'approved', phase: 'toolchain', progress: 10, eta: '2025-07-01T00:00:00Z', dependencies: ['RFC-0000'], owner: 'coo/coo' },
];

app.get('/api/missions', (req, res) => res.json({ missions: missionStore }));

app.patch('/api/missions/:id', async (req, res) => {
  const id = decodeURIComponent(req.params.id);
  const m = missionStore.find(x => x.id === id);
  if (!m) return res.status(404).json({ error: 'mission not found' });
  const patchData = req.body || {};
  if (patchData.status) {
    const next = ADVANCE[m.status] || patchData.status;
    if (!ADVANCE[m.status] && next === m.status) return res.status(400).json({ error: `cannot advance from "${m.status}" (terminal or bad status)` });
    m.status = next;
  }
  if (typeof patchData.progress === 'number') m.progress = Math.min(100, Math.max(0, patchData.progress));
  if (patchData.phase) m.phase = String(patchData.phase);
  res.json(m);
});

app.post('/api/agent/dispatch', async (req, res) => {
  const body = req.body || {};
  const missionId = String(body.missionId ?? '');
  const agent = String(body.agent ?? '');
  if (!missionId || !agent) return res.status(400).json({ error: 'missionId and agent required' });
  const m = missionStore.find(x => x.id === missionId);
  if (!m) return res.status(404).json({ error: 'mission not found' });
  const dispatchSlug = `decisions/agent-dispatch-${missionId}-${Date.now()}`;
  const dispatchNote = `[dispatch] agent="${agent}" mission=${missionId} status=${m.status} ts=${new Date().toISOString()}`;
  runGbrain(['capture', '--type', 'decision', '--slug', dispatchSlug, '--stdin'], { stdin: dispatchNote, timeoutMs: 30000 }).catch(() => {});
  res.json({ queued: true, missionId, agent, decisionSlug: dispatchSlug });
});

app.get('/api/timeline', (req, res) => res.json({
  timeline: [
    { id: 't1', title: 'RFC-0000 ratified', date: '2026-07-22', status: 'done', owner: 'cto/cto' },
    { id: 't2', title: 'Constitution + FES-001..012 committed', date: '2026-07-22', status: 'done', owner: 'cto/cto' },
    { id: 't3', title: 'Mission Center shipped', date: '2026-07-31', status: 'done', owner: 'cto/cto' },
    { id: 't4', title: 'PoolLeague E1 reconcile', date: '2026-07-31', status: 'in-progress', owner: 'cto/cto' },
    { id: 't5', title: 'VPS agent farm expansion', date: '2026-07-31', status: 'planned', owner: 'coo/coo' },
  ],
}));

app.get('/api/ledger', (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');
  let entries = [
    { id: 'l1', title: 'RFC-0000 approval', type: 'approval', date: '2026-07-22', mission: 'RFC-0000', outcome: 'approved', role: 'cto/cto' },
    { id: 'l2', title: 'E1 proposed', type: 'proposal', date: '2026-07-31', mission: 'POOL-E1', outcome: 'pending', role: 'coo/coo' },
    { id: 'l3', title: 'Submodule conversion approved', type: 'approval', date: '2026-07-31', mission: 'POOL-SUB', outcome: 'approved', role: 'cto/cto' },
  ];
  if (from) entries = entries.filter(e => e.date >= from);
  if (to) entries = entries.filter(e => e.date <= to);
  if (role) entries = entries.filter(e => e.role === role);
  if (status) entries = entries.filter(e => e.outcome === status);
  res.json({ ledger: entries });
});

app.get('/api/org', (req, res) => res.json({
  name: 'ForgeOS Engineering Organization',
  roles: [
    { id: 'cto/cto', title: 'CTO', reportsTo: 'exec/ceo', responsibilities: ['architecture', 'engineering', 'ai-governance'] },
    { id: 'coo/coo', title: 'COO', reportsTo: 'exec/ceo', responsibilities: ['missions', 'timeline', 'delivery'] },
    { id: 'cfo/cfo', title: 'CFO', reportsTo: 'exec/ceo', responsibilities: ['budget', 'compliance', 'risk'] },
    { id: 'exec/ceo', title: 'CEO', reportsTo: null, responsibilities: ['strategy', 'approvals', 'external'] },
  ],
}));

app.post('/api/capture', async (req, res) => {
  const body = req.body || {};
  const slug = String(body.slug ?? '');
  const type = String(body.type ?? 'note');
  const text = String(body.body ?? '');
  if (!slug) return res.status(400).json({ error: 'slug required' });
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) return res.status(400).json({ error: 'invalid slug: no path separators or .. allowed' });
  const r = await runGbrain(['capture', '--type', type, '--slug', slug, '--stdin'], { stdin: text, timeoutMs: 60000 });
  res.json({ slug, out: r.out, err: r.err });
});

app.post('/api/embed', async (req, res) => {
  try {
    const r = await runGbrain(['embed', '--all'], { timeoutMs: 110000 });
    res.json({ out: r.out, err: r.err });
  } catch (e) {
    res.status(200).json({ out: 'partial', err: 'embed incomplete: ' + String(e?.message ?? e), note: 'retry in smaller batches or after freeing memory' });
  }
});

app.get('/api/agents', (req, res) => res.json({
  agents: [
    { id: 1, role: 'CEO', status: 'idle', lastMission: 'CEO-20260803', lastActivity: 'Review findings recorded' },
    { id: 2, role: 'CTO', status: 'idle', lastMission: 'CTO-TEST-202608031150', lastActivity: 'test run completed' },
    { id: 3, role: 'CPO', status: 'idle', lastMission: null, lastActivity: null },
    { id: 4, role: 'COO', status: 'idle', lastMission: null, lastActivity: null },
  ],
}));

app.get('/api/metrics', (req, res) => {
  const byRoute = {};
  for (const [k, v] of metrics.byRoute.entries()) byRoute[k] = v;
  res.json({ requests: metrics.requests, errors: metrics.errors, byRoute });
});

app.get('/api/metrics/prometheus', (req, res) => {
  let out = '';
  out += `forgeos_requests_total ${metrics.requests}\n`;
  out += `forgeos_errors_total ${metrics.errors}\n`;
  for (const [k, v] of metrics.byRoute.entries()) {
    out += `forgeos_route_requests_total{path="${k}"} ${v.requests}\n`;
    out += `forgeos_route_errors_total{path="${k}"} ${v.errors}\n`;
  }
  res.setHeader('content-type', 'text/plain; version=0.0.4');
  res.send(out);
});

app.get('/api/agent/workflows', (req, res) => res.json({ workflows: [] }));
app.get('/api/agent/messages', (req, res) => res.json({ messages: [] }));
app.get('/api/agent/metrics', (req, res) => res.json({ metrics: {} }));

app.get('/api/federation/remote', (req, res) => res.json({ remote: [] }));
app.get('/api/webhooks', (req, res) => res.json({ webhooks: [], deadLetter: [], ts: Date.now() }));

app.post('/api/webhooks', (req, res) => res.status(501).json({ error: 'not implemented' }));
app.post('/api/plugins', (req, res) => res.json({ plugins: [] }));
app.post('/api/hotreload', (req, res) => res.json({ ok: true }));

app.get('/api/state', (req, res) => res.json({ state: {} }));
app.post('/api/state', (req, res) => res.json({ ok: true }));

app.post('/api/auth/login', (req, res) => res.status(501).json({ error: 'not implemented' }));

app.post('/api/capture/batch', (req, res) => res.status(501).json({ error: 'not implemented' }));
app.post('/api/import', (req, res) => res.status(501).json({ error: 'not implemented' }));
app.get('/api/export/:slug', (req, res) => res.status(501).json({ error: 'not implemented' }));

const healthClients = new Set();
setInterval(() => {
  if (!healthClients.size) return;
  const payload = `data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`;
  healthClients.forEach(w => { try { w.write(Buffer.from(payload)); } catch { healthClients.delete(w); } });
}, 5000);

app.get('/api/health/stream', (req, res) => {
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no');
  const stream = new ReadableStream({
    start(controller) {
      const w = controller.writable.getWriter();
      healthClients.add(w);
      w.write(Buffer.from(`data: ${JSON.stringify({ ts: Date.now(), ok: true })}\n\n`));
      setTimeout(() => { try { w.write(Buffer.from(': keepalive\n\n')); } catch {} }, 15000);
    },
    cancel() {},
  });
  return new Response(stream);
});

app.use((req, res) => {
  const filePath = path.join(PUBLIC, 'index.html');
  if (existsSync(filePath)) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.send(readFileSync(filePath));
  } else {
    res.status(404).send('Not found');
  }
});

const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`ForgeOS Brain Console running at http://localhost:${PORT}`);
});
