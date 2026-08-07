#!/usr/bin/env bun
/**
 * generate-openapi.ts
 *
 * Reads apps/brain-console/server.ts and emits a structured openapi.json
 * describing every route the fetch handler knows about.
 *
 * Usage:
 *   cd apps/brain-console && bun run scripts/generate-openapi.ts
 *
 * Output:
 *   apps/brain-console/openapi.json
 */

import { $ } from "bun";
import { writeFileSync, mkdirSync } from "fs";

const ROOT = import.meta.dir;
const SERVER = `${ROOT}/../server.ts`;
const OUT = `${ROOT}/../openapi.json`;

const SKIP = new Set([
  "/api/openapi",
  "/api/health/stream",
  "/api/state",
  "/api/request-log",
  "/api/request-log-clear",
]);

function esc(s: string) {
  return s.replace(/\{/g, "%{");
}

async function main() {
  const src = await Bun.file(SERVER).text();
  const paths: Record<string, Record<string, any>> = {};

  // Main fetch-handler routes
  const re = /if\s*\(\s*p\s*===\s*"([^"]+)"\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const route = m[1];
    if (SKIP.has(route)) continue;
    // Very rough: any path we see is treated as GET unless we can prove POST.
    const method = /method\s*===\s*"POST"/.test(src.slice(m.index, m.index + 600))
      ? ["get", "post"]
      : ["get"];
    paths[esc(route)] = Object.fromEntries(
      method.map((m) => [
        m,
        {
          summary: guessSummary(route),
          responses: { "200": { description: "OK" } },
        },
      ])
    );
  }

  // Param routes
  const paramRe = /\/api\/export\/:slug/g;
  if (paramRe.test(src)) {
    paths["/api/export/{slug}"] = {
      get: { summary: "Export brain page by slug", responses: { "200": { description: "OK" } } },
    };
  }

  // Additional routes (capture/batch, import, metrics, etc.)
  const addRe = /"(\/api\/[^"]+)":\s*\{\s*methods:\s*\[([^\]]+)\]/g;
  while ((m = addRe.exec(src))) {
    const route = m[1].replace(/:slug/, "/{slug}");
    const methods = m[2].match(/"(\w+)"/g)?.map((x) => x.slice(1, -1).toLowerCase()) || ["get"];
    paths[esc(route)] = Object.fromEntries(
      methods.map((m) => [
        m,
        { summary: guessSummary(route), responses: { "200": { description: "OK" } } },
      ])
    );
  }

  const doc = {
    openapi: "3.0.0",
    info: { title: "ForgeOS Brain Console API", version: "1.0.0" },
    paths,
  };

  mkdirSync(ROOT, { recursive: true });
  writeFileSync(OUT, JSON.stringify(doc, null, 2));
  console.log(`[generate-openapi] wrote ${Object.keys(paths).length} paths → ${OUT}`);
}

function guessSummary(route: string): string {
  const map: Record<string, string> = {
    "/api/health": "Brain + console health",
    "/api/status": "Brain + console status",
    "/api/brains": "Multi-brain metadata",
    "/api/openapi": "OpenAPI spec",
    "/api/roles": "C-suite role rows",
    "/api/page/:slug": "Get a brain page",
    "/api/search": "Semantic search (Ollama)",
    "/api/capture": "Capture a page",
    "/api/embed": "Re-embed all (Ollama)",
    "/api/vault": "Obsidian vault file list",
    "/api/federation": "Brain federation topology",
    "/api/audit": "Audit trail (gbrain list)",
    "/api/schema": "Active schema pack",
    "/api/backup": "Download brain zip",
    "/api/restore": "Restore brain zip",
    "/api/metrics": "Metrics",
    "/api/metrics/prometheus": "Prometheus text metrics",
    "/api/agent/workflows": "Agent workflows",
    "/api/agent/messages": "Agent messages",
    "/api/agent/metrics": "Agent metrics",
    "/api/federation/remote": "Remote brain metadata",
    "/api/webhooks": "Webhooks",
    "/api/plugins": "Plugins",
    "/api/hotreload": "Plugin hot reload",
    "/api/state": "Console state",
    "/api/auth/login": "Login",
    "/api/capture/batch": "Batch capture",
    "/api/import": "Import items",
    "/api/export/:slug": "Export brain page",
    "/api/health/stream": "SSE live health",
    "/api/amendments": "Constitutional amendments",
    "/api/compliance": "Compliance policies",
    "/api/request-log": "Request log",
    "/api/request-log-clear": "Clear request log",
    "/api/config": "Server config",
    "/api/settings": "UI settings",
    "/api/workflows": "Agent workflows",
    "/api/mcp": "MCP status",
    "/api/ledger": "Decision ledger",
    "/api/org": "Organization tree",
    "/api/agents": "Agent list",
    "/api/poolleague/status": "PoolLeague backend health",
    "/api/poolleague/tournaments": "PoolLeague tournaments",
    "/api/poolleague/matches": "PoolLeague matches",
    "/api/governance": "Governance file tree",
    "/api/timeline": "Timeline items",
    "/api/diff": "Diff (not implemented)",
  };
  return map[route] || route;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
