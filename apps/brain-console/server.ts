import express from "express";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { match } from "path-to-regexp";
import { createRuntime } from "./src/server/runtime.js";

const PORT = Number(process.env.PORT ?? 7777);
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");

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
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    console.log(`[react-express] ${req.method} ${req.path}`);
    next();
  });

  app.use(createRuntime());

  app.use((req, res, next) => {
    const asset = resolveAsset(req.path);
    if (asset.path) {
      return res.sendFile(asset.path, { headers: cache_headers(asset.path, asset.headers || {}) });
    }
    next();
  });

  app.get('/', (_req, res) => {
    const indexAsset = resolveAsset('/index.html');
    if (indexAsset.path) {
      return res.sendFile(indexAsset.path, { headers: cache_headers(indexAsset.path, indexAsset.headers || {}) });
    }
    return res.status(404).send('not found');
  });

  app.get(/^\/[^?#]*$/, (_req, res) => {
    const indexAsset = resolveAsset('/index.html');
    if (indexAsset.path) {
      return res.sendFile(indexAsset.path, { headers: cache_headers(indexAsset.path, indexAsset.headers || {}) });
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
