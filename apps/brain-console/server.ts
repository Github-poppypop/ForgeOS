import { serve } from "bun";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";

const PORT = Number(process.env.PORT ?? 7777);
import { fileURLToPath } from "node:url";
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

function startServer(port: number) {
  return serve({
    port,
    development: false,
    error(error) {
      console.error(`[server] ${error?.message ?? error}`);
    },
    async fetch(req) {
      const url = new URL(req.url);
      const p = url.pathname;

      if (!p.startsWith("/api/")) {
        const asset = resolveAsset(p);
        if (asset.path) {
          return new Response(fs.readFileSync(asset.path), { headers: asset.headers });
        }

        const indexAsset = resolveAsset('/index.html');
        if (indexAsset.path) {
          return new Response(fs.readFileSync(indexAsset.path), { headers: indexAsset.headers });
        }

        return new Response("not found", { status: 404 });
      }

      if (p === "/api/health") return Response.json({ ok: true, ts: Date.now() });
      if (p === "/api/status") {
        return Response.json({
          console_port: port,
          gbrain_health: { status: "degraded", engine: "pglite", owned_by: "console" },
          schema: "forgeos",
          ollama: { status: "offline" },
          embedding_model: "ollama:mxbai-embed-large (1024d, local)",
          isolation: `${GBRAIN_HOME} (separate from personal vaults & app brains)`,
          auth: false,
        });
      }

      if (p === "/api/roles") {
        const roles = [
          { slug: "exec/ceo", role: "ceo", reports_to: "board", exists: false },
          { slug: "board/board", role: "board", reports_to: "charter", exists: true },
          { slug: "cto/cto", role: "cto", reports_to: "ceo", exists: true },
          { slug: "coo/coo", role: "coo", reports_to: "ceo", exists: true },
          { slug: "cfo/cfo", role: "cfo", reports_to: "ceo", exists: true },
          { slug: "cmo/cmo", role: "cmo", reports_to: "ceo", exists: true },
        ];
        return Response.json({ roles });
      }

      if (p === "/api/search") {
        const q = url.searchParams.get("q") ?? "";
        return Response.json({ query: q, raw: "" });
      }

      if (p === "/api/capture" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        return Response.json({ slug: body.slug, out: "", err: "" });
      }

      if (p.startsWith("/api/page/") && req.method === "GET") {
        const slug = decodeURIComponent(p.slice("/api/page/".length));
        return Response.json({ slug, body: "sample body" });
      }

      if (p.startsWith("/api/page/") && req.method === "DELETE") {
        const slug = decodeURIComponent(p.slice("/api/page/".length));
        return Response.json({ slug, out: "deleted", err: "" });
      }

      if (p === "/api/schema") {
        return Response.json({ active: "forgeos", types: {} });
      }

      if (p === "/api/timeline") {
        return Response.json({ timeline: [] });
      }

      if (p === "/api/compliance") {
        return Response.json({ policies: [] });
      }

      if (p === "/api/missions") {
        return Response.json({ missions: [] });
      }

      if (p === "/api/federation") {
        return Response.json({ root: "ForgeOS", model: "read-down", children: [] });
      }

      if (p === "/api/webhooks") {
        return Response.json({ webhooks: [], deadLetter: [] });
      }

      if (p === "/api/ledger") {
        const ledger = [
          { id: "1", date: "2026-08-10", title: "Use Bun for brain-console runtime", type: "approval", mission: "platform-stability", role: "cto", outcome: "approved" },
          { id: "2", date: "2026-08-09", title: "Port React UI from app.js", type: "proposal", mission: "forgeos-v2", role: "cfo", outcome: "pending" },
          { id: "3", date: "2026-08-08", title: "Memory leak in federation route", type: "incident", mission: "platform-stability", role: "cto", outcome: "approved" },
        ];
        return Response.json({ ledger });
      }

      if (p === "/api/openapi") {
        return Response.json({
          openapi: "3.0.0",
          info: { title: "ForgeOS Brain Console API", version: "1.0.0" },
        });
      }

      return new Response("not found", { status: 404 });
    },
  });
}

const port = await ensureFreePort(PORT);

try {
  const server = startServer(port);
  console.log(`[react-express] on http://127.0.0.1:${port}`);
} catch (e: any) {
  console.error(`[react-express] ${e?.message ?? e}`);
  process.exit(1);
}
