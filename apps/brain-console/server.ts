import { serve } from "bun";
import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.PORT ?? 7777);
const ROOT = import.meta.dir;
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");
const GBRAIN_HOME = "C:\Projects\ForgeOS";

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const p = url.pathname;

    console.log(`[react-express] ${req.method} ${p}`);

    if (!p.startsWith("/api/")) {
      // Serve static assets from dist first
      const asset = path.join(DIST, p);
      if (fs.existsSync(asset) && fs.statSync(asset).isFile()) {
        return new Response(fs.readFileSync(asset), {
          headers: { "content-type": contentType(p) || "application/octet-stream", "x-content-type-options": "nosniff" },
        });
      }

      // React index.html
      const index = path.join(DIST, "index.html");
      if (fs.existsSync(index)) return new Response(fs.readFileSync(index), { headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" } });

      // Public fallback
      const publicIndex = path.join(PUBLIC, "index.html");
      if (fs.existsSync(publicIndex)) return new Response(fs.readFileSync(publicIndex), { headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" } });

      return new Response("not found", { status: 404 });
    }

    if (p === "/api/health") return Response.json({ ok: true, ts: Date.now() });
    if (p === "/api/status") {
      return Response.json({
        console_port: PORT,
        gbrain_health: { status: "degraded", engine: "pglite", owned_by: "console" },
        schema: "forgeos",
        ollama: { status: "offline" },
        embedding_model: "ollama:mxbai-embed-large (1024d, local)",
        isolation: `C:\\Projects\\ForgeOS (separate from personal vaults & app brains)`,
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
      return Response.json({ ok: true, slug });
    }

    if (p === "/api/schema") return Response.json({ active: "forgeos", types: {} });
    if (p === "/api/audit") return Response.json({ raw: "" });
    if (p === "/api/missions") return Response.json({ missions: [] });
    if (p === "/api/org") return Response.json({ name: "ForgeOS Engineering Organization", roles: [] });
    if (p === "/api/plugins") return Response.json({ plugins: [] });
    if (p === "/api/state") return Response.json({ state: {} });
    if (p === "/api/compliance") return Response.json({ policies: [] });
    if (p === "/api/timeline") return Response.json({ timeline: [] });
    if (p === "/api/federation") return Response.json({ root: "ForgeOS", model: "read-down", children: [] });
    if (p === "/api/vault") return Response.json({ files: [] });
    if (p === "/api/backup" && req.method === "POST") return Response.json({ ok: true });
    if (p === "/api/brains") return Response.json({ current: "forgeos", brains: [], note: "" });
    if (p === "/api/restore" && req.method === "POST") return Response.json({ ok: true });
    if (p === "/api/metrics") return Response.json({ requests: 0, errors: 0 });
    if (p === "/api/metrics/prometheus") return new Response("", { headers: { "content-type": "text/plain; version=0.0.4" } });
    if (p === "/api/webhooks") return Response.json({ webhooks: [], deadLetter: [] });
    if (p === "/api/openapi") return Response.json({ openapi: "3.0.0", info: { title: "ForgeOS Brain Console API", version: "1.0.0" } });

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

function contentType(pathname: string): string | undefined {
  const ext = pathname.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    ts: "application/javascript; charset=utf-8",
    tsx: "application/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    ico: "image/x-icon",
    txt: "text/plain; charset=utf-8",
  };
  return map[ext];
}

console.log(`[server] on http://127.0.0.1:${PORT}`);
