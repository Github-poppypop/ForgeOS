import { serve } from "bun";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";

const PORT = Number(process.env.PORT ?? 7777);
const ROOT = import.meta.dir;
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
        const asset = path.join(DIST, p);
        if (fs.existsSync(asset) && fs.statSync(asset).isFile()) {
          return new Response(fs.readFileSync(asset), {
            headers: { "content-type": contentType(p) || "application/octet-stream", "x-content-type-options": "nosniff" },
          });
        }

        const index = path.join(DIST, "index.html");
        if (fs.existsSync(index)) {
          return new Response(fs.readFileSync(index), { headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" } });
        }

        const publicIndex = path.join(PUBLIC, "index.html");
        if (fs.existsSync(publicIndex)) {
          return new Response(fs.readFileSync(publicIndex), { headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" } });
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

const port = await ensureFreePort(PORT);

try {
  const server = startServer(port);
  console.log(`[react-express] on http://127.0.0.1:${port}`);
} catch (e: any) {
  console.error(`[react-express] ${e?.message ?? e}`);
  process.exit(1);
}
