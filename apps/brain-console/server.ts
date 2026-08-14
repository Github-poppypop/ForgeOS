import express from "express";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { match } from "path-to-regexp";
import { createRuntime } from "./src/server/runtime.js";

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

  app.use(createRuntime());

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
    if (indexAsset.path) return indexAsset.path;
    return null;
  };

  app.get("/", async (_req, res) => {
    const html = await sendIndex();
    if (html) return typeof html === "string" ? res.send(html) : res.sendFile(html);
    return res.status(404).send("not found");
  });

  app.get(/^\/[^?#]*$/, async (_req, res) => {
    const html = await sendIndex();
    if (html) return typeof html === "string" ? res.send(html) : res.sendFile(html);
    return res.status(404).send("not found");
  });

  app.listen(port, "127.0.0.1", () => {
    console.log(`[react-express] on http://127.0.0.1:${port}`);
  });
}

main().catch((err) => {
  console.error(`[react-express] ${err?.message ?? err}`);
  process.exit(1);
});
