import path from 'path';
import express from 'express';
import fs from 'node:fs';

const PORT = Number(process.env.PORT ?? 7777);
const CLIENT_DIST = path.resolve('dist');
const PUBLIC_DIR = path.resolve('public');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR, { index: false }));
app.use(express.static(CLIENT_DIST, { index: false }));

app.get('/', (_req, res) => {
  const candidate = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(candidate)) return res.sendFile(candidate);
  res.json({ ok: true, message: 'ForgeOS Brain Console API' });
});

// ---- API shim: preserve prior Bun/Express API surface ----
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/status', async (_req, res) => {
  try {
    const [schema, ollama] = await Promise.all([
      run(['schema', 'active']).catch(() => ({ out: '' })),
      checkOllama().catch(() => ({ status: 'down' })),
    ]);
    res.json({
      console_port: PORT,
      gbrain_health: { status: schema.out ? 'ok' : 'degraded', engine: 'pglite', owned_by: 'console' },
      schema: schema.out,
      ollama: ollama,
      embedding_model: 'ollama:mxbai-embed-large (1024d, local)',
      isolation: 'C:\\Projects\\ForgeOS (separate from personal vaults & app brains)',
      auth: !!process.env.CONSOLE_TOKEN,
    });
  } catch (e) {
    res.json({
      console_port: PORT,
      gbrain_health: { status: 'degraded', engine: 'pglite', owned_by: 'console' },
      schema: '',
      ollama: { status: 'down' },
      embedding_model: 'ollama:mxbai-embed-large (1024d, local)',
      isolation: 'C:\\Projects\\ForgeOS',
      auth: !!process.env.CONSOLE_TOKEN,
    });
  }
});

app.get('/api/roles', async (_req, res) => {
  const out = await run(['list']).catch(() => ({ out: '' }));
  const lines = String(out.out || '').split('\n');
  const ROLE_SLUGS = ['exec/ceo','board/board','cto/cto','coo/coo','cfo/cfo','cmo/cmo'];
  const roles = ROLE_SLUGS.map((slug) => {
    const hit = lines.find((l) => l.startsWith(slug + '\t'));
    const title = hit ? hit.split('\t').pop() ?? '' : '';
    const name = title.match(/^type: role/) ? '' : title;
    return { slug, role: name || slug.split('/').pop(), reports_to: slug === 'exec/ceo' ? 'board' : (slug === 'board/board' ? 'charter' : 'ceo'), exists: !!hit };
  });
  res.json({ roles });
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q ?? '');
  const r = await run(['search', q]);
  res.json({ query: q, raw: r.out });
});

app.post('/api/capture', async (req, res) => {
  const { slug, type, body } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug required' });
  const r = await run(['capture', '--type', String(type || 'note'), '--slug', String(slug), '--stdin'], { stdin: String(body ?? '') });
  res.json({ slug: String(slug), out: r.out, err: r.err });
});

app.get('/api/page/:slug', async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug));
  const r = await run(['get', slug]);
  if (r.out.includes('not found')) return res.status(404).json({ error: 'not found' });
  res.json({ slug, body: r.out });
});

app.delete('/api/page/:slug', async (req, res) => {
  const slug = decodeURIComponent(String(req.params.slug));
  const r = await run(['delete', slug], { timeoutMs: 30000 });
  if (r.code !== 0 || r.out.includes('not found')) return res.status(404).json({ error: r.err || 'not found' });
  res.json({ ok: true, slug });
});

app.get('/api/schema', async (_req, res) => {
  const [active, types] = await Promise.all([
    run(['schema', 'active']),
    run(['schema', 'types']).catch(() => ({ out: 'see C:\\Projects\\ForgeOS\\.gbrain\\schema-packs\\forgeos\\pack.yaml' })),
  ]);
  res.json({ active: active.out, types: types.out });
});

app.get('/api/audit', async (_req, res) => {
  const r = await run(['list', '--json']).catch(() => ({ out: '' }));
  res.json({ raw: r.out });
});

app.get('/api/missions', (_req, res) => {
  res.json({
    missions: [
      { id: 'RFC-0000', title: 'RFC-0000 governance build', status: 'done', phase: 'foundation', progress: 100, eta: '2025-01-01T00:00:00Z', dependencies: [], owner: 'cto/cto' },
      { id: 'POOL-E1', title: 'PoolLeague E1 backend reconcile', status: 'proposed', phase: 'backend', progress: 0, eta: '2025-06-01T00:00:00Z', dependencies: ['RFC-0000'], owner: 'cto/cto' },
    ],
  });
});

app.get('/api/org', (_req, res) => {
  res.json({
    name: 'ForgeOS Engineering Organization',
    roles: [
      { id: 'cto/cto', title: 'CTO', reportsTo: 'exec/ceo', responsibilities: ['architecture', 'engineering', 'ai-governance'] },
      { id: 'coo/coo', title: 'COO', reportsTo: 'exec/ceo', responsibilities: ['missions', 'timeline', 'delivery'] },
      { id: 'cfo/cfo', title: 'CFO', reportsTo: 'exec/ceo', responsibilities: ['budget', 'compliance', 'risk'] },
      { id: 'exec/ceo', title: 'CEO', reportsTo: null, responsibilities: ['strategy', 'approvals', 'external'] },
    ],
  });
});

app.get('/api/brains', (_req, res) => {
  res.json({
    current: 'forgeos',
    brains: [
      { id: 'forgeos', home: 'C:\\Projects\\ForgeOS', role: 'root', isolated: true },
      { id: 'lifeos', home: 'C:\\Projects\\ForgeOS\\apps\\lifeos\\.gbrain', role: 'app-child', isolated: true },
    ],
    note: 'Switch GBRAIN_HOME + restart console to mount a different isolated brain.',
  });
});

app.get('/api/plugins', (_req, res) => {
  res.json({
    plugins: [
      { id: 'brain', name: 'Brain Console Core', version: '1.0.0', active: true },
      { id: 'sw', name: 'Service Worker Cache', version: '6.0.0', active: true },
    ],
    ts: Date.now(),
  });
});

app.get('/api/state', (_req, res) => {
  res.json({ lastPanel: 'dashboard' });
});

app.get('/api/compliance', (_req, res) => {
  res.json({
    policies: [
      { id: 'C-1', name: 'No secrets in repo', status: 'active', lastCheck: new Date().toISOString() },
      { id: 'C-2', name: 'Constitutional amendment required for /governance writes', status: 'active', lastCheck: new Date().toISOString() },
      { id: 'C-3', name: 'Rate limit /api/*', status: 'active', lastCheck: new Date().toISOString(), limit: 120 },
    ],
    violations: [],
  });
});

app.get('/api/timeline', (_req, res) => {
  res.json({
    timeline: [
      { id: 't1', title: 'RFC-0000 ratified', date: '2026-07-22', status: 'done', owner: 'cto/cto' },
      { id: 't2', title: 'Constitution + FES-001..012 committed', date: '2026-07-22', status: 'done', owner: 'cto/cto' },
      { id: 't3', title: 'Mission Center shipped', date: '2026-07-31', status: 'done', owner: 'cto/cto' },
    ],
  });
});

app.get('/api/federation', (_req, res) => {
  res.json({ root: 'ForgeOS (C:\\Projects\\ForgeOS\\.gbrain)', model: 'federated: read-down only, write-up governance only, no lateral mingle', children: ['apps/lifeos (isolated child brain)'] });
});

app.get('/api/vault', (_req, res) => {
  const base = 'C:\\Projects\\ForgeOS\\vault';
  const files: string[] = [];
  try {
    for (const f of fs.readdirSync(base, { withFileTypes: true })) {
      if (f.isFile() && f.name.endsWith('.md')) files.push(f.name);
    }
  } catch {}
  res.json({ base, files, git: 'branch master (untracked role pages)' });
});

// Fallback: serve React index.html for SPA routes
app.get('*', (_req, res) => {
  const candidate = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(candidate)) return res.sendFile(candidate);
  res.status(404).json({ error: 'not found' });
});

function run(args: string[], opts?: { stdin?: string; timeoutMs?: number }): { ok: boolean; out: string; err: string; code: number } {
  const { execSync } = require('node:child_process');
  const cmd = ['npx', 'gbrain', ...args];
  try {
    const out = execSync(cmd.join(' '), { encoding: 'utf8', cwd: path.resolve('..'), input: opts?.stdin, timeout: opts?.timeoutMs || 120000 });
    return { ok: true, out, err: '', code: 0 };
  } catch (e: any) {
    return { ok: false, out: String(e.stdout || ''), err: String(e.stderr || e.message || ''), code: e.status ?? 1 };
  }
}

async function checkOllama(): Promise<{ status: string }> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 1500);
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(id);
    return { status: r.ok ? 'ok' : 'down' };
  } catch {
    clearTimeout(id);
    return { status: 'down' };
  }
}

app.listen(PORT, () => {
  console.log(`[forgeos-console] on http://127.0.0.1:${PORT}`);
});
