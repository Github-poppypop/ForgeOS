// Server feature: publish the static OpenAPI document and a self-contained,
// CSP-safe human-readable API reference at /api/docs. No external CDN — the
// viewer is vanilla JS, so it works under the strict Content-Security-Policy.
// Conflict-free: loaded by features/loader.ts; no edits to runtime.ts/server.ts.
import type { Router } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/server/features -> apps/brain-console
const BC_ROOT = path.resolve(__dirname, '../../..');
const OPENAPI_PATH = path.join(BC_ROOT, 'openapi.json');

function readOpenApi(): { ok: boolean; body?: string; error?: string } {
  try {
    return { ok: true, body: fs.readFileSync(OPENAPI_PATH, 'utf8') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function docsHtml(): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>ForgeOS Brain Console — API Reference</title>',
    '<style>',
    '  :root { color-scheme: light dark; }',
    '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; background: #0f1115; color: #e6e6e6; }',
    '  header { padding: 16px 20px; border-bottom: 1px solid #23262d; }',
    '  header h1 { margin: 0 0 4px; font-size: 18px; }',
    '  .muted { color: #9aa0aa; }',
    '  .wrap { padding: 16px 20px; }',
    '  input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; border: 1px solid #2a2e37; background: #16191f; color: #e6e6e6; font-size: 14px; }',
    '  .meta { margin: 12px 0; color: #9aa0aa; }',
    '  .group { margin-top: 18px; }',
    '  .group h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #8b93a1; }',
    '  .ep { border: 1px solid #23262d; border-radius: 8px; margin: 8px 0; }',
    '  .ep .row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }',
    '  .method { font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 6px; }',
    '  .get { background: #143d2b; color: #7ee2b0; }',
    '  .post { background: #15324d; color: #8ec5ff; }',
    '  .patch { background: #3d3414; color: #ffd98e; }',
    '  .delete { background: #4d1717; color: #ff9b9b; }',
    '  .path { font-family: ui-monospace, monospace; font-size: 13px; }',
    '  .summary { color: #9aa0aa; margin-left: auto; font-size: 12px; }',
    '  .empty { color: #9aa0aa; padding: 12px; }',
    '  a { color: #8ec5ff; }',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    '  <h1>ForgeOS Brain Console — API Reference</h1>',
    '  <div class="muted">Live OpenAPI surface · source: <code>/api/openapi.json</code></div>',
    '</header>',
    '<div class="wrap">',
    '  <input id="q" placeholder="Filter endpoints (e.g. vault, POST, audit)…" autocomplete="off" />',
    '  <div class="meta" id="meta">Loading…</div>',
    '  <div id="out"></div>',
    '</div>',
    '<script>',
    '(function () {',
    '  var q = document.getElementById("q");',
    '  var out = document.getElementById("out");',
    '  var meta = document.getElementById("meta");',
    '  var spec = null;',
    '  function mc(m){ return (m || "").toLowerCase(); }',
    '  function groupKey(p){ var s = p.split("/").filter(Boolean); if (s[0] === "api" && s[1]) return "/" + s[1]; return s[0] ? "/" + s[0] : "/"; }',
    '  function esc(s){ return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }',
    '  function render(filter){',
    '    if (!spec || !spec.paths) return;',
    '    var f = (filter || "").trim().toLowerCase();',
    '    var groups = {};',
    '    Object.keys(spec.paths).sort().forEach(function (p) {',
    '      var item = spec.paths[p];',
    '      Object.keys(item).forEach(function (m) {',
    '        if (m === "parameters") return;',
    '        var summary = (item[m] && item[m].summary) || "";',
    '        if (f && p.toLowerCase().indexOf(f) < 0 && m.toLowerCase().indexOf(f) < 0 && summary.toLowerCase().indexOf(f) < 0) return;',
    '        (groups[groupKey(p)] = groups[groupKey(p)] || []).push({ m: m.toUpperCase(), p: p, s: summary });',
    '      });',
    '    });',
    '    var keys = Object.keys(groups).sort();',
    '    if (!keys.length) { out.innerHTML = "<div class=\\"empty\\">No endpoints match.</div>"; meta.textContent = "0 endpoints"; return; }',
    '    var total = 0;',
    '    out.innerHTML = keys.map(function (g) {',
    '      var rows = groups[g].sort(function (a, b) { return a.p.localeCompare(b.p); }).map(function (e) {',
    '        total++;',
    '        return "<div class=\\"ep\\"><div class=\\"row\\"><span class=\\"method " + mc(e.m) + "\\">" + e.m + "</span><span class=\\"path\\">" + esc(e.p) + "</span><span class=\\"summary\\">" + esc(e.s) + "</span></div></div>";',
    '      }).join("");',
    '      return "<div class=\\"group\\"><h2>" + esc(g) + "</h2>" + rows + "</div>";',
    '    }).join("");',
    '    meta.textContent = total + " endpoint" + (total === 1 ? "" : "s") + " across " + keys.length + " group" + (keys.length === 1 ? "" : "s");',
    '  }',
    '  fetch("/api/openapi.json").then(function (r) { return r.json(); }).then(function (d) { spec = d; render(q.value); }).catch(function (e) { out.innerHTML = "<div class=\\"empty\\">Failed to load spec: " + esc(String(e)) + "</div>"; });',
    '  q.addEventListener("input", function () { render(q.value); });',
    '})();',
    '</script>',
    '</body>',
    '</html>',
  ].join('\n');
}

export default function registerApiDocs(router: Router): void {
  router.get('/api/openapi.json', (_req, res) => {
    const r = readOpenApi();
    if (!r.ok || !r.body) {
      res.status(404).json({ error: 'openapi.json not found', detail: r.error ?? '' });
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(r.body);
  });

  router.get('/api/docs', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).send(docsHtml());
  });
}
