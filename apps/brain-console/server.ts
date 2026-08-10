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

  app.get('/api/page/:slug', (req, res) => {
    const slug = decodeURIComponent(req.params.slug);
    res.json({ slug, body: "sample body" });
  });

  app.delete('/api/page/:slug', (req, res) => {
    const slug = decodeURIComponent(req.params.slug);
    res.json({ slug, out: "deleted", err: "" });
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
