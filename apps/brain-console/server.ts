import express from "express";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { match } from "path-to-regexp";
import { createRuntime } from "./src/server/runtime.js";
import { createSSEHub } from "./src/server/sse.js";
import { installGracefulShutdown } from "./src/server/gracefulShutdown.js";
import { exportAudit } from "./src/server/auditExport.js";

const PORT = Number(process.env.PORT ?? 7777);
const ROOT = path.resolve(fileURLToPath(new URL("server.ts", import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");
const CLIENT = path.join(ROOT, "src", "client");

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

function cache_headers(p: string, headers: Record<string, string>) {
  if (p.endsWith('.html')) {
    headers['cache-control'] = 'no-store, no-cache, must-revalidate, max-age=0';
  } else if (p.endsWith('.js') || p.endsWith('.css')) {
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
    if (process.platform === "win32") {
      const cmd = `powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"`;
      execSync(cmd, { encoding: "utf8", timeout: 8000, stdio: ["pipe", "pipe", "pipe"] });
    } else {
      // Linux/macOS: free the port via fuser, falling back to parsing `ss`.
      // (The previous PowerShell-only path was a silent no-op off Windows and
      // caused pm2 restart crash-loops because the port could never be freed.)
      try {
        execSync(`fuser -k ${port}/tcp`, { encoding: "utf8", timeout: 8000, stdio: ["pipe", "pipe", "pipe"] });
      } catch {
        /* fuser may be absent or find nothing — fall through to ss-based kill */
      }
      try {
        const out = execSync(`ss -ltnp 2>/dev/null | grep ":${port} " || true`, {
          encoding: "utf8",
          timeout: 8000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        const m = /pid=(\d+)/.exec(out);
        if (m) execSync(`kill -9 ${m[1]}`, { encoding: "utf8", timeout: 8000, stdio: ["pipe", "pipe", "pipe"] });
      } catch {
        /* no listener found — nothing to kill */
      }
    }
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

function applySecurityHeaders(_req: express.Request, res: express.Response) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
}

const LOG_DIR = path.join(ROOT, 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { /* best effort */ }

const LOG_RETENTION_DAYS = 30;
let lastLogPrune = 0;

function pruneOldLogs(): void {
  try {
    const now = Date.now();
    for (const name of fs.readdirSync(LOG_DIR)) {
      if (!/^forgeos-\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue;
      const fp = path.join(LOG_DIR, name);
      const ageDays = (now - fs.statSync(fp).mtimeMs) / 86400000;
      if (ageDays > LOG_RETENTION_DAYS) fs.rmSync(fp, { force: true });
    }
  } catch { /* best effort */ }
}

function structuredLog(level: string, event: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...event }) + '\n';
  const now = Date.now();
  if (now - lastLogPrune > 3600000) {
    lastLogPrune = now;
    pruneOldLogs();
  }
  try {
    const file = path.join(LOG_DIR, `forgeos-${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(file, line);
  } catch { /* never block the request on a log failure */ }
  if (level === 'error') alertError(event);
}

// Guarded alerting hook: no-op unless ALERT_WEBHOOK_URL (Slack/Discord/email
// gateway) or SENTRY_DSN is configured. Never blocks the request path.
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL ?? '';
const SENTRY_DSN = process.env.SENTRY_DSN ?? '';

function alertError(event: Record<string, unknown>) {
  const message = JSON.stringify(event);
  if (ALERT_WEBHOOK_URL) {
    fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `ForgeOS error: ${message}` }),
    }).catch(() => {});
    return;
  }
  if (SENTRY_DSN) {
    const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(SENTRY_DSN);
    if (!m) return;
    const [, key, host, projectId] = m;
    fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}` },
      body: JSON.stringify({ message, level: 'error', platform: 'node' }),
    }).catch(() => {});
  }
}

async function main() {
  const port = await ensureFreePort(PORT);
  const app = express();
  const sseHub = createSSEHub();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  sseHub.register(app, "/api/stream");

  app.use((req, res, next) => {
    applySecurityHeaders(req, res);
    const started = Date.now();
    res.on('finish', () => {
      const status = res.statusCode;
      const event = { method: req.method, path: req.path, status, ms: Date.now() - started, ip: req.ip ?? '' };
      structuredLog(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', { event: 'request', ...event });
      sseHub.broadcast('request', event);
    });
    next();
  });

  app.use((req, res, next) => {
    console.log(`[react-express] ${req.method} ${req.path}`);
    next();
  });

  app.get("/sw.js", (_req, res) => {
    const asset = resolveAsset("/sw.js");
    if (asset.path) return res.sendFile(asset.path, { headers: { ...(asset.headers || {}), 'content-type': 'application/javascript; charset=utf-8' } });
    return res.status(404).send("not found");
  });

  const useVite = process.env.NODE_ENV !== "production" && fs.existsSync(CLIENT) && (process.env.FORCE_VITE === "1" || !fs.existsSync(path.join(DIST, "index.html")));
  let viteInstance: Awaited<ReturnType<import("vite").createServer>> | null = null;

  if (useVite) {
    try {
      const { createServer: createViteServer } = await import("vite");
      viteInstance = await createViteServer({
        root: CLIENT,
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(viteInstance.middlewares);
    } catch (err) {
      console.warn("[react-express] vite dev middleware unavailable:", err?.message ?? err);
    }
  }

  app.use(await createRuntime());

  // Audit log export (SQL / JSON)
  app.get("/api/audit/export", async (req, res) => {
    try {
      const fmt = req.query.format === "sql" ? "sql" : "json";
      const out = await exportAudit(fmt, LOG_DIR);
      res.setHeader("content-type", fmt === "sql" ? "application/sql; charset=utf-8" : "application/json; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="audit.${fmt}"`);
      res.send(out);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.use((req, res, next) => {
    if (viteInstance) return next();
    const asset = resolveAsset(req.path);
    if (asset.path) {
      return res.sendFile(asset.path, { headers: cache_headers(asset.path, asset.headers || {}) });
    }
    next();
  });

  const sendIndex = async () => {
    if (viteInstance) {
      const html = fs.readFileSync(path.join(CLIENT, "index.html"), "utf8");
      return await viteInstance.transformIndexHtml("/", html);
    }
    const indexAsset = resolveAsset("/index.html");
    if (indexAsset.path) return fs.readFileSync(indexAsset.path, "utf8");
    return null;
  };

  app.get("/", async (_req, res) => {
    const html = await sendIndex();
    if (html) return res.send(html);
    return res.status(404).send("not found");
  });

  app.get("/sw.js", (_req, res) => {
    const asset = resolveAsset("/sw.js");
    if (asset.path) return res.sendFile(asset.path, { headers: { ...(asset.headers || {}), 'content-type': 'application/javascript; charset=utf-8' } });
    return res.status(404).send("not found");
  });

  app.get("/src/styles/design.css", (_req, res) => {
    const asset = resolveAsset("/src/styles/design.css");
    if (asset.path) return res.sendFile(asset.path, { headers: { ...(asset.headers || {}), 'content-type': 'text/css; charset=utf-8' } });
    return res.status(404).send("not found");
  });

  app.use("/assets", express.static(path.join(DIST, "assets"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".css")) res.setHeader("content-type", "text/css; charset=utf-8");
      if (filePath.endsWith(".js")) res.setHeader("content-type", "application/javascript; charset=utf-8");
    }
  }));

  app.get(/^\/[^?#]*$/, async (req, res, next) => {
    if (req.path.includes('.') && !req.path.endsWith('/')) return next();
    const html = await sendIndex();
    if (html) return typeof html === "string" ? res.send(html) : res.send(html);
    return res.status(404).send("not found");
  });

  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`[react-express] on http://127.0.0.1:${port}`);
  });
  installGracefulShutdown({
    server,
    graceMs: Number(process.env.SHUTDOWN_GRACE_MS ?? 10000),
    onShutdown: (reason) => { try { sseHub.broadcast("shutdown", { reason, at: new Date().toISOString() }); } catch {} },
  });
}

main().catch((err) => {
  console.error(`[react-express] ${err?.message ?? err}`);
  process.exit(1);
});
