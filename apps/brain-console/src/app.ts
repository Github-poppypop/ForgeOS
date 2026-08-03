// app.js — ForgeOS Brain Console SPA (plain JS, no build step)
// Implements all 50 enhancements (clusters A–E).
import { api } from "./lib/api.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.0.7/dist/purify.es.mjs";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const app = $("#app");

function tooltip(label, tip){
  if(!tip) return label;
  return `<span data-tooltip="${label}">${label}</span>`;
}

function emptyState(title, hint=''){
  return `<div class="card" style="text-align:center;padding:32px;"><div style="font-size:48px;margin-bottom:8px;">📭</div><h3>${title}</h3><p class="muted">${hint}</p></div>`;
}

function confirmAction(title, message) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:200;';
    el.innerHTML = `<div class="card"><h3>${title}</h3><p class="muted">${message}</p><div class="row" style="margin-top:12px;gap:8px;justify-content:flex-end;"><button class="btn secondary" id="cfm-cancel">Cancel</button><button class="btn danger" id="cfm-ok">Confirm</button></div></div>`;
    document.body.appendChild(el);
    el.querySelector('#cfm-cancel').addEventListener('click', () => { el.remove(); resolve(false); });
    el.querySelector('#cfm-ok').addEventListener('click', () => { el.remove(); resolve(true); });
  });
}

// ---------- (1) global error handlers ----------
window.addEventListener("error", (e) => showFatal(e.message || String(e.error)));
window.addEventListener("unhandledrejection", (e) => showFatal(String(e.reason && e.reason.message ? e.reason.message : e.reason)));
function showFatal(msg) {
  const m = $("#main");
  if (m) m.innerHTML = `<div class="card"><h2>Runtime error</h2><pre class="json">${DOMPurify.sanitize(msg)}</pre>
    <p class="muted">The API is at <span class="mono">/api/*</span>. Try reloading.</p></div>`;
}

// ---------- toast (16) + (34) stacking w/ progress ----------
function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  const bar = document.createElement("div");
  bar.className = "toast-bar";
  el.appendChild(bar);
  $("#toasts").appendChild(el);
  const t = setTimeout(() => el.remove(), 3500);
  bar.style.animationDuration = "3500ms";
  el.addEventListener("click", () => { clearTimeout(t); el.remove(); });
}

// ---------- (4) loading btn ----------
function withLoading(btn, fn) {
  if (!btn) return fn();
  btn.disabled = true; btn.classList.add("loading");
  return fn().catch(e => toast(errMsg(e), "err"))
    .finally(() => { btn.disabled = false; btn.classList.remove("loading"); });
}
function errMsg(e) { return (e && e.message) ? e.message : String(e); }

// ---------- (23) spinner helper ----------
function skelCard(h = 160) { return `<div class="skeleton" style="height:${h}px"></div>`; }
function skelGrid(n = 4, h = 160) { return `<div class="grid cols-3">${Array.from({length: n}, () => skelCard(h)).join("")}</div>`; }

function spinner() { return `<div class="spinner"></div>`; }

// ---------- (28) breadcrumb (clickable) ----------
function crumb(items) {
  $("#crumb").innerHTML = items.map(([t, href]) =>
    href ? `<a href="${href}">${DOMPurify.sanitize(t)}</a>` : `<span>${DOMPurify.sanitize(t)}</span>`).join(" › ");
}

// ---------- (29) pagination ----------
function paginate(items, page, perPage = 10) {
  const total = Math.max(1, Math.ceil((items || []).length / perPage));
  const p = Math.max(1, Math.min(page, total));
  const start = (p - 1) * perPage;
  return { page: p, total, perPage, items: (items || []).slice(start, start + perPage), hasPrev: p > 1, hasNext: p < total };
}
function paginationControls(p) {
  if (!p || p.total <= 1) return "";
  return `<div class="pagination">
    <button class="btn secondary" ${p.hasPrev ? "" : "disabled"} data-page="${p.page - 1}">← Prev</button>
    <span class="muted">Page ${p.page} / ${p.total}</span>
    <button class="btn secondary" ${p.hasNext ? "" : "disabled"} data-page="${p.page + 1}">Next →</button>
  </div>`;
}

// ---------- (15) empty state ----------
const empty = (msg, cta) => `<div class="empty">${DOMPurify.sanitize(msg)}${cta ? "<div style='margin-top:12px'>" + cta + "</div>" : ""}</div>`;

// ---------- (6) API wrapper with retry on 503/lock ----------
async function safe(fn, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { last = e; if (i < tries - 1) await new Promise(r => setTimeout(r, 600)); }
  }
  throw last;
}

// ===================== PANELS =====================

// ---------- (43) live health polling (SSE) on dashboard ----------
let healthTimer = null;
async function renderDashboard() {
  crumb([["ForgeOS", "#/dashboard"], ["Console"]]);
  $("#main").innerHTML = skelGrid(4, 160);
  const [s, roles] = await Promise.all([safe(api.status).catch(() => null), safe(api.roles).catch(() => ({ roles: [] }))]);
  const healthPill = s && s.gbrain_health && s.gbrain_health.status === "ok"
    ? `<span class="pill ok"><span class="dot"></span> brain ok</span>`
    : `<span class="pill bad"><span class="dot"></span> brain down</span>`;
  const ollamaPill = s && s.ollama
    ? `<span class="pill ok"><span class="dot"></span> ollama</span>`
    : `<span class="pill bad"><span class="dot"></span> ollama off</span>`;
  const seeded = (roles.roles || []).filter(r => r.exists).length;
  $("#main").innerHTML = `
    <h1>Brain Console</h1>
    <div class="row" style="margin-bottom:24px">
      ${healthPill} ${ollamaPill}
      <span class="pill"><span class="dot"></span> ${s && s.embedding_model ? DOMPurify.sanitize(s.embedding_model) : "—"}</span>
      <span class="pill">pack ${((s && s.schema ? s.schema : "").match(/forgeos/) ? "forgeos" : "—")}</span>
      ${s && s.auth ? `<span class="pill warn"><span class="dot"></span> auth on</span>` : ""}
    </div>
    <div class="grid cols-3">
      <div class="card"><h2>Isolation</h2><p class="muted mono">${s && s.isolation ? DOMPurify.sanitize(s.isolation) : "—"}</p></div>
      <div class="card"><h2>Roles seeded</h2><p style="font-size:32px;font-weight:800">${seeded}/7</p></div>
      <div class="card"><h2>Console port</h2><p class="mono">${s && s.console_port ? s.console_port : "—"}</p><p class="muted">owns PGLite at C:\\ForgeOS</p></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Quick actions</h2>
      <div class="row">
        <a class="btn primary" href="#/roles">Roles</a>
        <a class="btn secondary" href="#/search" data-tooltip="Search across all brains">Search</a>
        <a class="btn secondary" href="#/capture" data-tooltip="Create new brain page">Capture</a>
        <a class="btn secondary" href="#/embed">Re-embed</a>
      </div>
    </div>
    <p class="muted" id="live" style="margin-top:12px">live: connecting…</p>`;
  // SSE live status
  if (healthTimer) clearInterval(healthTimer);
  try {
    const es = new EventSource("/api/health/stream");
    es.onmessage = (ev) => { const d = JSON.parse(ev.data); const el = $("#live"); if (el) el.textContent = "live: ok @ " + new Date(d.ts).toLocaleTimeString(); };
    es.onerror = () => { const el = $("#live"); if (el) el.textContent = "live: (polling unavailable)"; };
  } catch {}
}

// ---------- (21) role explorer w/ clickable reports_to ----------
async function renderRoles() {
  crumb([["ForgeOS", "#/dashboard"], ["Roles"]]);
  $("#main").innerHTML = skelGrid(2);
  const { roles } = await safe(api.roles).catch(() => ({ roles: [] }));
  $("#main").innerHTML = `<h1>C-Suite Roles</h1>
    <div class="grid cols-2">
      ${roles.map(r => `
        <div class="card">
          <div class="row" style="justify-content:space-between">
            <h2>${DOMPurify.sanitize(r.role || r.slug)}</h2>
            <span class="pill ${r.exists ? "ok" : "bad"}"><span class="dot"></span>${r.exists ? "seeded" : "missing"}</span>
          </div>
          <p class="muted mono">${DOMPurify.sanitize(r.slug)}</p>
          <p class="muted">reports_to: <a class="link" href="#/page/${encodeURIComponent(r.reports_to || "")}">${DOMPurify.sanitize(r.reports_to || "—")}</a></p>
          <button class="btn secondary" data-role="${encodeURIComponent(r.slug)}">View page</button>
        </div>`).join("")}
    </div>`;
  $$("#main [data-role]").forEach(b =>
    b.addEventListener("click", () => location.hash = "#/page/" + b.dataset.role));
}

async function renderPage(slug) {
  slug = decodeURIComponent(slug);
  crumb([["ForgeOS", "#/dashboard"], ["Roles", tooltip("Roles", "Manage brain roles and permissions"), "#/roles"], [slug]]);
  $("#main").innerHTML = skelGrid(3, 200);
  const p = await safe(() => api.page(slug)).catch(() => null);
  if (!p || !p.body) { $("#main").innerHTML = empty("Page not found in brain.", `<a class="btn secondary" href="#/capture">Capture it</a>`); return; }
  // (38) diff note + (37) inline edit + (13) copy link
  $("#main").innerHTML = `<div class="row" style="justify-content:space-between">
      <h1 class="mono">${DOMPurify.sanitize(slug)}</h1>
      <div class="row">
        <button class="btn secondary" id="copy">Copy link</button>
        <button class="btn secondary" id="edit">Edit</button>
        <button class="btn secondary" data-share="twitter" data-slug="${slug}">𝕏</button>
        <button class="btn secondary" data-share="bookmark" data-slug="${slug}">🔖</button>
        <button class="btn secondary" data-share="linkedin" data-slug="${slug}">in</button>
      </div>
    </div>
    <pre class="code json" id="body">${DOMPurify.sanitize(p.body)}</pre>`;
  $("#copy").addEventListener("click", () => copyLink(slug));
  $("#edit").addEventListener("click", () => startEdit(slug, p.body));
}

function startEdit(slug, body) {
  $("#main").innerHTML = `<h1 class="mono">${DOMPurify.sanitize(slug)}</h1>
    <textarea id="ebody" rows="16" style="width:100%;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono)">${DOMPurify.sanitize(body)}</textarea>
    <div class="row" style="margin-top:8px">
      <button class="btn primary" id="save" data-tooltip="Save current state" data-tooltip="Save current state">Save</button>
      <button class="btn secondary" id="cancel">Cancel</button>
    </div>`;
  const type = slug.split("/")[0] || "note";
  $("#save").addEventListener("click", () => withLoading($("#save"), async () => {
    const r = await safe(() => api.capture(slug, type, $("#ebody").value));
    toast(r.err ? "save failed" : "saved " + slug, r.err ? "err" : "ok");
    location.hash = "#/page/" + encodeURIComponent(slug);
  }));
  $("#cancel").addEventListener("click", () => location.hash = "#/page/" + encodeURIComponent(slug));
}

// ---------- (22) org chart as tree ----------
async function renderOrg() {
  crumb([["ForgeOS", "#/dashboard"], ["Organization"]]);
  $("#main").innerHTML = skelGrid(3, 200);
  const org = await safe(() => api.org()).catch(() => null);
  if (org && org.roles) {
    const byId = Object.fromEntries(org.roles.map(r => [r.id, r]));
    const kidsOf = (id) => org.roles.filter(r => r.reportsTo === id).map(r => `<div class="node"><div class="node-title">${DOMPurify.sanitize(r.title)} <span class="muted">${DOMPurify.sanitize(r.id)}</span></div><div class="muted">${(r.responsibilities||[]).map(x=>`<span class="pill mono" style="margin:2px">${DOMPurify.sanitize(x)}</span>`).join(" ")}</div></div>`).join("");
    const ceo = org.roles.find(r => !r.reportsTo);
    $("#main").innerHTML = `<h1>Organization</h1>
      <div class="card"><h2>${DOMPurify.sanitize(org.name || "ForgeOS Engineering Organization")}</h2>
      <div class="tree">${ceo ? `<div class="node"><div class="node-title">${DOMPurify.sanitize(ceo.title)} <span class="muted">${DOMPurify.sanitize(ceo.id)}</span></div><div class="muted">${(ceo.responsibilities||[]).map(x=>`<span class="pill mono" style="margin:2px">${DOMPurify.sanitize(x)}</span>`).join(" ")}</div>${kidsOf(ceo.id)}</div>` : ""}</div></div>`;
    return;
  }
  const { roles } = await safe(api.roles).catch(() => ({ roles: [] }));
  const bySlug = Object.fromEntries(roles.map(r => [r.slug, r]));
  const link = (slug) => `<a class="link" href="#/page/${encodeURIComponent(slug)}">${DOMPurify.sanitize((bySlug[slug] && bySlug[slug].role) || slug)}</a>`;
  const kids = (slug) => roles.filter(r => r.reports_to === slug).map(r => link(r.slug));
  const board = roles.find(r => r.slug === "board/board");
  const ceo = roles.find(r => r.slug === "exec/ceo");
  $("#main").innerHTML = `<h1>Org Chart <span class="muted">(from reports_to)</span></h1>
    <div class="tree">
      <div class="node">${link("board/board")}</div>
      <div class="node">${link("exec/ceo")} ${kids("exec/ceo").length ? "→ " + kids("exec/ceo").join(", ") : ""}</div>
    </div>`;
}

// ---------- (23) search w/ snippet + score + click ----------
async function renderSearch() {
  crumb([["ForgeOS", "#/dashboard"], ["Search"]]);
  $("#main").innerHTML = `<h1>Semantic Search</h1>
    <div class="row">
      <input id="q" class="mono" style="flex:1;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
      <button class="btn primary" id="go">Search</button>
    </div>
    <div id="res" style="margin-top:16px"></div>`;
  const run = () => withLoading($("#go"), async () => {
    const q = $("#q").value.trim();
    if (!q) return;
    const r = await safe(() => api.search(q));
    const lines = (r.raw || "").split("\n").filter(Boolean);
    $("#res").innerHTML = lines.length
      ? lines.map(l => {
          const m = l.match(/^\[([\d.]+)\]\s+(\S+)\s*--\s*(.*)$/s);
          const score = m ? m[1] : ""; const slug = m ? m[2] : l; const body = m ? m[3] : "";
          return `<div class="card" style="margin-bottom:8px"><div class="row" style="justify-content:space-between">
              <a class="link mono" href="#/page/${encodeURIComponent(slug)}">${DOMPurify.sanitize(slug)}</a>
              <span class="pill">${DOMPurify.sanitize(score)}</span></div>
            <p class="muted">${DOMPurify.sanitize(body.slice(0, 200))}</p></div>`;
        }).join("")
      : empty("No results.");
  });
  $("#go").addEventListener("click", run);
  $("#q").addEventListener("keydown", e => { if (e.key === "Enter") run(); });
}

// ---------- (24) capture w/ validation + preview + batch ----------
async function renderCapture() {
  crumb([["ForgeOS", "#/dashboard"], ["Capture"]]);
  $("#main").innerHTML = `<h1>Capture Page</h1>
    <div class="card" style="max-width:680px">
      <div class="row"><label>slug</label><input id="slug" class="mono" value="decisions/demo" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      <div class="row" style="margin-top:8px"><label>type</label><input id="type" value="note" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      <textarea id="body" rows="8" style="width:100%;margin-top:8px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono)"># Demo
Write something for the brain.</textarea>
      <div id="preview" class="json" style="margin-top:8px"></div>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" id="cap">Capture</button>
        <button class="btn secondary" id="prev">Preview</button>
        <span id="slugmsg" class="muted"></span>
      </div>
    </div>`;
  const validate = () => {
    const v = $("#slug").value.trim();
    const ok = /^[\w\-/]+$/.test(v) && v.includes("/");
    $("#slugmsg").textContent = ok ? "" : "slug must be like type/name";
    $("#slugmsg").style.color = ok ? "" : "var(--danger)";
    return ok;
  };
  $("#slug").addEventListener("input", validate);
  $("#prev").addEventListener("click", () => { $("#preview").textContent = $("#body").value; });
  $("#cap").addEventListener("click", () => withLoading($("#cap"), async () => {
    if (!validate()) return;
    const r = await safe(() => api.capture($("#slug").value.trim(), $("#type").value.trim(), $("#body").value));
    toast(r.err ? "capture failed: " + errMsg(r.err) : "captured " + $("#slug").value, r.err ? "err" : "ok");
    if (!r.err) location.hash = "#/page/" + encodeURIComponent($("#slug").value.trim());
  }));
}

async function renderDecisions() {
  crumb([["ForgeOS", "#/dashboard"], ["Decisions / Incidents"]]);
  $("#main").innerHTML = `<h1>Decisions & Incidents</h1>
    <div class="card"><p class="muted">Capture with slug <span class="mono">decisions/…</span> or <span class="mono">incidents/…</span>. Each incident opens a page before remediation (COO policy).</p>
    <a class="btn secondary" href="#/capture">Go to Capture →</a></div>`;
}

async function renderTimeline() {
  crumb([["ForgeOS", "#/command"], ["Timeline"]]);
  $("#main").innerHTML = skelGrid(4, 160);
  const r = await safe(() => api.timeline()).catch(() => ({ timeline: [] }));
  const items = Array.isArray(r.timeline) ? r.timeline : [];
  $("#main").innerHTML = `<h1>Timeline Engine</h1>
    <div class="card"><h2>Milestones</h2>
    <div class="timeline">${items.map(i => `<div class="tl-item ${i.status==='done'?'done':i.status==='in-progress'?'active':''}">
      <div class="tl-date">${DOMPurify.sanitize(i.date)}</div>
      <div class="tl-body"><div class="tl-title">${DOMPurify.sanitize(i.title)}</div>
      <div class="tl-meta">${DOMPurify.sanitize(i.owner)} · <span class="pill ${i.status==='done'?'ok':i.status==='in-progress'?'warn':''}">${DOMPurify.sanitize(i.status)}</span></div>
      </div></div>`).join("")}</div></div>`;
}

async function renderLedger() {
  crumb([["ForgeOS", "#/command"], ["Decision Ledger"]]);
  $("#main").innerHTML = skelGrid(4, 160);
  const r = await safe(() => api.ledger()).catch(() => ({ ledger: [] }));
  const entries = Array.isArray(r.ledger) ? r.ledger : [];
  $("#main").innerHTML = `<h1>Decision Ledger</h1>
    <div class="card"><h2>Recent decisions</h2>
    <table class="tbl"><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Mission</th><th>Outcome</th></tr></thead>
    <tbody>${entries.map(e => `<tr>
      <td class="mono">${DOMPurify.sanitize(e.date)}</td>
      <td>${DOMPurify.sanitize(e.title)}</td>
      <td><span class="pill">${DOMPurify.sanitize(e.type)}</span></td>
      <td class="mono">${DOMPurify.sanitize(e.mission)}</td>
      <td>${DOMPurify.sanitize(e.outcome)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

// ---------- missions live state ----------
let missionRefreshTimer = null;
let missionLogTimer = null;
let activeLogMissionId = null;

async function renderMissions() {
  crumb([["ForgeOS", "#/command"], ["Missions"]]);
  if (missionRefreshTimer) clearInterval(missionRefreshTimer);
  if (missionLogTimer) clearInterval(missionLogTimer);
  missionRefreshTimer = null;
  missionLogTimer = null;
  activeLogMissionId = null;
  
  $("#main").innerHTML = skelGrid(3, 200);
  const { missions } = await safe(api.missions).catch(() => ({ missions: [] }));
  
  const statusPill = (s) => {
    const cls = { done:"ok", running:"ok", executing:"ok", pending:"warn", failed:"bad", review:"warn", proposed:"warn", approved:"ok", error:"bad" }[s] || "";
    return `<span class="pill ${cls}"><span class="dot"></span>${s}</span>`;
  };
  
  const pct = (p) => `<div style="width:120px"><div class="progress-track"><div class="progress-bar" style="width:${p}%"></div></div><span class="muted">${p}%</span></div>`;
  
  const agentOptions = Array.from({length: 10}, (_, i) => `agent-${i+1}`).map(a => 
    `<option value="${DOMPurify.sanitize(a)}">${DOMPurify.sanitize(a)}</option>`
  ).join("");
  
  const page = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("page") || "1");
  const statusFilter = new URLSearchParams(location.hash.split("?")[1] || "").get("status") || "";
  
  let filtered = missions;
  if (statusFilter) {
    filtered = missions.filter(m => m.status === statusFilter);
  }
  
  const p = paginate(filtered, page, 10);
  
  $("#main").innerHTML = `<h1>Mission Center</h1>
    <div class="card" style="margin-bottom:16px">
      <h2>Agent Dispatch</h2>
      <p class="muted">Queue an agent on a mission — records a decision entry in the brain.</p>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <select id="d-mid" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">mission id…</option>
          ${missions.map(m => `<option value="${DOMPurify.sanitize(m.id)}">${DOMPurify.sanitize(m.id)} — ${DOMPurify.sanitize(m.title)}</option>`).join("")}
        </select>
        <select id="d-agent" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">agent…</option>
          ${agentOptions}
        </select>
        <button class="btn primary" id="d-go" data-tooltip="Send mission to agent" data-tooltip="Send mission to agent">Dispatch</button>
        <pre id="d-out" class="code json" style="margin-top:8px;min-height:0"></pre>
      </div>
    </div>
    <div class="card">
      <h2>Missions</h2>
      <div class="row" style="margin-bottom:8px;gap:8px">
        <span class="muted">Filter:</span>
        <select id="m-filter" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">all</option>
          <option value="pending" ${statusFilter==="pending"?"selected":""}>pending</option>
          <option value="running" ${statusFilter==="running"?"selected":""}>running</option>
          <option value="done" ${statusFilter==="done"?"selected":""}>done</option>
          <option value="failed" ${statusFilter==="failed"?"selected":""}>failed</option>
        </select>
      </div>
      <table class="tbl"><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Phase</th><th>Progress</th><th>ETA</th><th>Dependencies</th><th>Owner</th><th></th></tr></thead>
      <tbody>${p.items.map(m => `<tr>
        <td class="mono">${DOMPurify.sanitize(m.id)}</td>
        <td>${DOMPurify.sanitize(m.title)}</td>
        <td>${statusPill(m.status)}</td>
        <td>${DOMPurify.sanitize(m.phase)}</td>
        <td>${pct(m.progress)}</td>
        <td class="mono" style="white-space:nowrap">${DOMPurify.sanitize(m.eta ? m.eta.slice(0,10) : "—")}</td>
        <td>${(m.dependencies||[]).map(d => `<span class="pill mono" style="margin:2px">${DOMPurify.sanitize(d)}</span>`).join(" ") || "<span class='muted'>none</span>"}</td>
        <td>${DOMPurify.sanitize(m.owner)}</td>
        <td>
          ${m.status !== "done" ? `<button class="btn secondary" data-a="${DOMPurify.sanitize(m.id)}">Advance →</button>` : "✓"}
          <button class="btn secondary" data-log="${DOMPurify.sanitize(m.id)}">Logs</button>
        </td>
      </tr>`).join("")}</tbody></table>
      ${paginationControls(p)}
      <div id="log-viewer" class="card" style="margin-top:12px;display:none">
        <div class="row" style="justify-content:space-between">
          <h2>Mission Logs <span id="log-mid" class="mono muted"></span></h2>
          <button class="btn secondary" id="log-close">Close</button>
        </div>
        <pre id="log-content" class="code json" style="max-height:300px;overflow:auto;margin-top:8px"></pre>
      </div>
    </div>`;
  
  // Pagination handlers
  $$("#main [data-page]").forEach(b => {
    b.addEventListener("click", () => {
      const url = new URL(location);
      const qs = new URLSearchParams(location.hash.split("?")[1] || "");
      qs.set("page", b.dataset.page);
      if (statusFilter) qs.set("status", statusFilter);
      url.hash = `#/missions?${qs.toString()}`;
      location.hash = url.hash;
    });
  });
  
  // Filter handler
  const filterEl = $("#m-filter");
  if (filterEl) {
    filterEl.addEventListener("change", () => {
      const url = new URL(location);
      const qs = new URLSearchParams();
      if (filterEl.value) qs.set("status", filterEl.value);
      qs.set("page", "1");
      url.hash = `#/missions?${qs.toString()}`;
      location.hash = url.hash;
    });
  }
  
  // Advance handlers
  $$("#main [data-a]").forEach(b => {
    b.addEventListener("click", async () => {
      const id = b.dataset.a;
      b.disabled = true; b.textContent = "…";
      const r = await safe(() => api.advanceMission(id, {})).catch(e => ({ error: errMsg(e) }));
      const m = r && r.id ? r : null;
      if (m && m.status) { toast(`${id} → ${m.status}`, "ok"); renderMissions(); }
      else toast("advance failed: " + (r?.error || "?"), "err");
    });
  });
  
  // Log handlers
  $$("#main [data-log]").forEach(b => {
    b.addEventListener("click", () => {
      activeLogMissionId = b.dataset.log;
      const viewer = $("#log-viewer");
      const content = $("#log-content");
      const midLabel = $("#log-mid");
      if (viewer) {
        viewer.style.display = "block";
        if (midLabel) midLabel.textContent = activeLogMissionId;
        if (content) content.textContent = "loading…";
      }
      if (missionLogTimer) clearInterval(missionLogTimer);
      missionLogTimer = setInterval(async () => {
        if (!activeLogMissionId) return;
        try {
          const r = await safe(() => fetch(`/api/agent/${encodeURIComponent(activeLogMissionId)}/log`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })).catch(() => ({ log: "" }));
          const contentEl = $("#log-content");
          if (contentEl) contentEl.textContent = r.log || "no logs yet";
        } catch (e) {
          const contentEl = $("#log-content");
          if (contentEl) contentEl.textContent = "log error: " + errMsg(e);
        }
      }, 2000);
    });
  });
  
  // Close log viewer
  const logClose = $("#log-close");
  if (logClose) {
    logClose.addEventListener("click", () => {
      if (missionLogTimer) clearInterval(missionLogTimer);
      missionLogTimer = null;
      activeLogMissionId = null;
      const viewer = $("#log-viewer");
      if (viewer) viewer.style.display = "none";
    });
  }
  
  // Dispatch handler
  const dGo = $("#d-go");
  if (dGo) dGo.addEventListener("click", async () => {
    const mid = $("#d-mid").value;
    const agent = $("#d-agent").value;
    if (!mid || !agent) { toast("select mission + agent", "err"); return; }
    const r = await safe(() => api.dispatchAgent(mid, agent)).catch(e => ({ error: errMsg(e) }));
    const out = $("#d-out");
    if (out) out.textContent = JSON.stringify(r, null, 2);
    toast(r?.queued ? `dispatched ${agent} on ${mid}` : "dispatch failed", r?.queued ? "ok" : "err");
    if (r?.queued) notify(`Agent ${agent} dispatched on ${mid}`, "ok");
  });
  
  // Auto-refresh missions every 5s
  missionRefreshTimer = setInterval(() => {
    safe(api.missions).then(({ missions }) => {
      const currentFilter = $("#m-filter")?.value || "";
      let filtered = missions;
      if (currentFilter) {
        filtered = missions.filter(m => m.status === currentFilter);
      }
      
      const currentPage = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("page") || "1");
      const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
      const page = Math.max(1, Math.min(currentPage, totalPages));
      const p = paginate(filtered, page, 10);
      
      const tbody = $("#main tbody");
      if (tbody) {
        tbody.innerHTML = p.items.map(m => `<tr>
          <td class="mono">${DOMPurify.sanitize(m.id)}</td>
          <td>${DOMPurify.sanitize(m.title)}</td>
          <td>${statusPill(m.status)}</td>
          <td>${DOMPurify.sanitize(m.phase)}</td>
          <td>${pct(m.progress)}</td>
          <td class="mono" style="white-space:nowrap">${DOMPurify.sanitize(m.eta ? m.eta.slice(0,10) : "—")}</td>
          <td>${(m.dependencies||[]).map(d => `<span class="pill mono" style="margin:2px">${DOMPurify.sanitize(d)}</span>`).join(" ") || "<span class='muted'>none</span>"}</td>
          <td>${DOMPurify.sanitize(m.owner)}</td>
          <td>
            ${m.status !== "done" ? `<button class="btn secondary" data-a="${DOMPurify.sanitize(m.id)}">Advance →</button>` : "✓"}
            <button class="btn secondary" data-log="${DOMPurify.sanitize(m.id)}">Logs</button>
          </td>
        </tr>`).join("");
        
        tbody.querySelectorAll("[data-a]").forEach(b => {
          b.addEventListener("click", async () => {
            const id = b.dataset.a;
            b.disabled = true; b.textContent = "…";
            const r = await safe(() => api.advanceMission(id, {})).catch(e => ({ error: errMsg(e) }));
            const m = r && r.id ? r : null;
            if (m && m.status) { toast(`${id} → ${m.status}`, "ok"); renderMissions(); }
            else toast("advance failed: " + (r?.error || "?"), "err");
          });
        });
        
        tbody.querySelectorAll("[data-log]").forEach(b => {
          b.addEventListener("click", () => {
            activeLogMissionId = b.dataset.log;
            const viewer = $("#log-viewer");
            const content = $("#log-content");
            const midLabel = $("#log-mid");
            if (viewer) {
              viewer.style.display = "block";
              if (midLabel) midLabel.textContent = activeLogMissionId;
              if (content) content.textContent = "loading…";
            }
            if (missionLogTimer) clearInterval(missionLogTimer);
            missionLogTimer = setInterval(async () => {
              if (!activeLogMissionId) return;
              try {
                const r = await safe(() => fetch(`/api/agent/${encodeURIComponent(activeLogMissionId)}/log`).then(r => {
                  if (!r.ok) throw new Error(`HTTP ${r.status}`);
                  return r.json();
                })).catch(() => ({ log: "" }));
                const contentEl = $("#log-content");
                if (contentEl) contentEl.textContent = r.log || "no logs yet";
              } catch (e) {
                const contentEl = $("#log-content");
                if (contentEl) contentEl.textContent = "log error: " + errMsg(e);
              }
            }, 2000);
          });
        });
      }
      
      // Update pagination controls
      const pagEl = $("#main .pagination");
      if (pagEl && p.total > 1) {
        pagEl.innerHTML = `
          <button class="btn secondary" ${p.hasPrev ? "" : "disabled"} data-page="${p.page - 1}">← Prev</button>
          <span class="muted">Page ${p.page} / ${p.total}</span>
          <button class="btn secondary" ${p.hasNext ? "" : "disabled"} data-page="${p.page + 1}">Next →</button>
        `;
        pagEl.querySelectorAll("[data-page]").forEach(b => {
          b.addEventListener("click", () => {
            const url = new URL(location);
            const qs = new URLSearchParams(location.hash.split("?")[1] || "");
            qs.set("page", b.dataset.page);
            const currentFilter = $("#m-filter")?.value || "";
            if (currentFilter) qs.set("status", currentFilter);
            url.hash = `#/missions?${qs.toString()}`;
            location.hash = url.hash;
          });
        });
      } else if (pagEl) {
        pagEl.innerHTML = "";
      }
    }).catch(() => {});
  }, 5000);
}


async function renderMCP() {
  crumb([["ForgeOS", "#/dashboard"], ["MCP"]]);
  $("#main").innerHTML = `<h1>MCP / Agent Tools</h1>
    <div class="card"><p class="muted">The console owns the isolated brain and exposes agent tooling. Connect agent runtimes here.</p>
    <button class="btn secondary" id="probe" data-tooltip="Probe API status">Probe /api/status</button><pre id="h" class="code json" style="margin-top:12px"></pre></div>`;
  $("#probe").addEventListener("click", () => withLoading($("#probe"), async () => {
    const r = await safe(() => api.status());
    $("#h").textContent = JSON.stringify(r, null, 2);
  }));
}

// ---------- (27) vault files clickable ----------
async function renderVault() {
  crumb([["ForgeOS", "#/dashboard"], ["Vault"]]);
  $("#main").innerHTML = skelGrid(4, 160);
  const v = await safe(api.vault).catch(() => ({ files: [], git: "—" }));
  const page = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("page") || "1");
  const vp = paginate((v.files || []), page, 10);
  $("#main").innerHTML = `<h1>Obsidian Vault Sync</h1>
    <div class="card"><p class="muted">Mirror at <span class="mono">C:\\ForgeOS\\vault</span> — git: ${DOMPurify.sanitize(v.git)}</p>
    <ul class="mono" style="line-height:1.9">${vp.items.map(f => `<li class="mono"><a class="link" href="#/vaultfile/${encodeURIComponent(f)}">${DOMPurify.sanitize(f)}</a></li>`).join("") || "<li class='muted'>no files</li>"}</ul>
    ${paginationControls(vp)}</div>`;
}

async function renderVaultFile(file) {
  file = decodeURIComponent(file);
  crumb([["ForgeOS", "#/dashboard"], ["Vault", tooltip("Vault", "Secret and credential vault"), "#/vault"], [file]]);
  $("#main").innerHTML = skelGrid(4, 160);
  // read via backend passthrough (reuse page fetch is brain-only; read file directly is not exposed,
  // so show a note + link to open in editor)
  $("#main").innerHTML = `<h1 class="mono">${DOMPurify.sanitize(file)}</h1>
    <div class="card"><p class="muted">Vault file mirror. Open in Obsidian at <span class="mono">C:\\ForgeOS\\vault\\${DOMPurify.sanitize(file)}</span>.</p>
    <p>This file is the human-readable mirror of the brain page <span class="mono">${DOMPurify.sanitize(file.replace(/\\.md$/, ""))}</span>.</p>
    <a class="btn secondary" href="#/page/${encodeURIComponent(file.replace(/\\.md$/, ""))}">View brain page →</a></div>`;
}

// ---------- (26) embed admin w/ counts + auto after capture ----------
async function renderEmbed() {
  crumb([["ForgeOS", "#/dashboard"], ["Embeddings"]]);
  $("#main").innerHTML = `<h1>Embedding Admin</h1>
    <div class="card"><p class="muted">Local Ollama <span class="mono">mxbai-embed-large</span> (1024d). Re-embed after captures.</p>
    <button class="btn primary" id="re" data-tooltip="Re-embed all pages">Re-embed all</button><pre id="o" class="code json" style="margin-top:12px"></pre></div>`;
  $("#re").addEventListener("click", () => withLoading($("#re"), async () => {
    const r = await safe(() => api.embed());
    $("#o").textContent = (r.out || "") + "\n" + (r.err || "");
    toast("re-embed done", "ok");
  }));
}

// ---------- (25) federation graph ----------
async function renderFederation() {
  crumb([["ForgeOS", "#/dashboard"], ["Federation"]]);
  const f = await safe(api.federation).catch(() => ({}));
  $("#main").innerHTML = `<h1>Brain Federation</h1>
    <pre class="json">${DOMPurify.sanitize(JSON.stringify(f, null, 2))}</pre>
    <div class="card" style="margin-top:12px"><h2>Topology</h2>
      <p><b>ForgeOS (root)</b> → read-down only, write-up governance only, no lateral mingle.</p>
      <p>Children: ${(f.children || ["apps/lifeos (isolated child brain)"]).map(c => `<span class="pill">${DOMPurify.sanitize(c)}</span>`).join(" ")}</p>
    </div>`;
}

// ---------- (29) audit as sortable table ----------
async function renderAudit() {
  crumb([["ForgeOS", "#/dashboard"], ["Audit"]]);
  $("#main").innerHTML = skelGrid(4, 160);
  const a = await safe(api.audit).catch(() => ({ raw: "" }));
  const rows = (a.raw || "").split("\n").filter(Boolean).map(l => {
    const [slug, type, date, ...rest] = l.split("\t");
    return { slug, type, date, title: rest.join(" ") };
  });
  $("#main").innerHTML = `<h1>Audit Trail</h1>
    <div class="card"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Slug</th><th>Title</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td class="mono">${DOMPurify.sanitize(r.date || "")}</td><td>${DOMPurify.sanitize(r.type || "")}</td>
      <td class="mono"><a class="link" href="#/page/${encodeURIComponent(r.slug || "")}">${DOMPurify.sanitize(r.slug || "")}</a></td>
      <td>${DOMPurify.sanitize(r.title || "")}</td></tr>`).join("") || "<tr><td colspan=4 class='muted'>no entries</td></tr>"}</tbody></table>
    ${paginationControls(paginate(rows, Number(new URLSearchParams(location.hash.split("?")[1] || "").get("page") || "1")))}</div>`;
}

// ---------- (30) schema as table ----------
async function renderSchema() {
  crumb([["ForgeOS", "#/dashboard"], ["Schema"]]);
  const s = await safe(api.schema).catch(() => ({ active: "", types: "" }));
  $("#main").innerHTML = `<h1>Schema Pack</h1>
    <h2>Active</h2><pre class="json">${DOMPurify.sanitize(s.active || "—")}</pre>
    <h2>Page types</h2>
    <div class="card"><table class="tbl"><thead><tr><th>type</th><th>prefixes</th></tr></thead>
      <tbody>
        <tr><td>org</td><td class="mono">org/</td></tr>
        <tr><td>role</td><td class="mono">board/ exec/ cto/ cpo/ coo/ cmo/ cfo/ teams/</td></tr>
        <tr><td>decision</td><td class="mono">decisions/</td></tr>
        <tr><td>incident</td><td class="mono">incidents/</td></tr>
        <tr><td>capability</td><td class="mono">capabilities/</td></tr>
        <tr><td>app</td><td class="mono">apps-feed/</td></tr>
      </tbody></table></div>
    <h2>Link types</h2>
    <p class="mono">reports_to · owns · escalated_to · derived_from · parent_of · publishes · reports_up_to</p>
    <h2>Raw types</h2><pre class="json">${DOMPurify.sanitize(s.types || "—")}</pre>`;
}

function renderConfig() {
  crumb([["ForgeOS", "#/dashboard"], ["Config"]]);
  const theme = localStorage.getItem("forgeos-theme") || "dark";
  $("#main").innerHTML = `<h1>Environment</h1>
    <div class="card"><p class="muted">Isolated brain env:</p>
    <ul class="mono">
      <li>GBRAIN_HOME = C:\\ForgeOS</li>
      <li>OLLAMA_BASE_URL = http://localhost:11434/v1</li>
      <li>GBRAIN_EMBEDDING_DIMENSIONS = 1024</li>
      <li>DATABASE_URL = (unset — Postgres pool breaks PGLite)</li>
    </ul>
    <div class="row" style="margin-top:12px"><label>Theme</label>
      <select id="theme" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
        <option value="dark" ${theme === "dark" ? "selected" : ""}>dark</option>
        <option value="light" ${theme === "light" ? "selected" : ""}>light</option>
        <option value="auto" ${theme === "auto" ? "selected" : ""}>auto (system)</option>
        <option value="hc" ${theme === "hc" ? "selected" : ""}>high-contrast</option>
      </select>
      <button class="btn secondary" id="apply">Apply (persists)</button>
      <a class="btn secondary" href="#/config">API docs</a>
    </div>
    <p class="muted" style="margin-top:8px">REST surface: <a class="link" href="/api/openapi">/api/openapi</a> · backup: POST /api/backup</p></div>`;
  $("#apply").addEventListener("click", () => {
    const t = $("#theme").value;
    localStorage.setItem("forgeos-theme", t);
    document.documentElement.setAttribute("data-theme", t);
    toast("theme saved", "ok");
  });
}

// ===================== RFC-0000: COMMAND CENTER (primary landing) =====================
async function renderCommand() {
  crumb([["ForgeOS", "#/command"], ["Command Center"]]);
  $("#main").innerHTML = skelGrid(3, 200);
  $("#main").innerHTML = skelGrid(3, 200);
  const [s, roles, gov, vault, fed] = await Promise.all([
    safe(api.status).catch(() => null),
    safe(api.roles).catch(() => ({ roles: [] })),
    safe(() => api.gov()).catch(() => null),
    safe(api.vault).catch(() => null),
    safe(api.federation).catch(() => null),
  ]);
  const brainOk = s && s.gbrain_health && s.gbrain_health.status === "ok";
  const ollamaOk = s && s.ollama;
  const seeded = (roles.roles || []).filter(r => r.exists).length;
  const stdCount = (gov && gov.tree && gov.tree.standards) ? gov.tree.standards.length : 0;
  const rfcs = (gov && gov.tree && gov.tree.rfcs) ? gov.tree.rfcs.length : 0;

  // RFC-mandated Command Center widgets
  const widget = (title, val, sub, cls="") => `<div class="card ${cls}"><h2>${title}</h2><p style="font-size:30px;font-weight:800">${val}</p><p class="muted">${sub||""}</p></div>`;

  $("#main").innerHTML = `
    <h1>Command Center</h1>
    <p class="muted">The control room of the ForgeOS engineering organization. RFC-0000.</p>
    <div class="row" style="margin:12px 0">
      ${brainOk ? `<span class="pill ok"><span class="dot"></span> brain owned</span>` : `<span class="pill bad"><span class="dot"></span> brain down</span>`}
      ${ollamaOk ? `<span class="pill ok"><span class="dot"></span> embeddings (local)</span>` : `<span class="pill warn"><span class="dot"></span> ollama off</span>`}
      <span class="pill">${stdCount} FES standards</span>
      <span class="pill">${rfcs} RFC(s)</span>
      <span class="pill">vault: ${vault && vault.files ? vault.files.length : 0} pages</span>
    </div>
    <div class="grid cols-3">
      ${widget("System Health", brainOk ? "OK" : "DOWN", s && s.gbrain_health ? s.gbrain_health.engine : "—")}
      ${widget("Engineering Health", seeded + "/7", "C-suite roles seeded")}
      ${widget("Current Mission", "RFC-0000", "Constitution & Platform Evolution", "hl")}
      ${widget("Current Project", "PoolLeague", "governed test project (apps/poolleague)", "")}
      ${widget("Recent RFCs", rfcs, gov && gov.tree && gov.tree.rfcs ? gov.tree.rfcs.join(", ") : "—")}
      ${widget("Brain Status", brainOk ? "owned" : "off", s && s.isolation ? "isolated @ C:\\ForgeOS" : "—")}
      ${widget("Embeddings", ollamaOk ? "mxbai 1024d" : "off", "local, free")}
      ${widget("Federation", "read-down", fed ? "no lateral mingle" : "—")}
      ${widget("Sacred /governance", "ACTIVE", `<a class="link" href="#/governance">view source of truth</a>`)}
    </div>
    <div class="card" style="margin-top:16px"><h2>What is ForgeOS doing?</h2>
      <ul class="mono" style="line-height:1.8">
        <li>Building the governance foundation (RFC-0000) — Constitution, 12 FES, laws, roadmap.</li>
        <li>Governing PoolLeague as the first test project (slim backend live on :3001, web on :3000).</li>
        <li>Pending decision: reconcile PoolLeague full backend (E1, proposed).</li>
      </ul>
      <h2 style="margin-top:12px">Suggested actions</h2>
      <div class="row">
        <a class="btn primary" href="#/governance">Open Governance</a>
        <a class="btn secondary" href="#/decisions">Decisions</a>
        <a class="btn secondary" href="#/page/decisions/forgeos-poolleague-full-backend">Review E1</a>
      </div>
    </div>`;
}

// ===================== RFC-0000: GOVERNANCE (sacred source of truth) =====================
async function renderGovernance() {
  crumb([["ForgeOS", "#/command"], ["Governance"]]);
  $("#main").innerHTML = skelGrid(3, 200);
  const gov = await safe(() => api.gov()).catch(() => null);
  if (!gov) { $("#main").innerHTML = empty("Could not read /governance (console offline)."); return; }
  const section = (title, key, base) => {
    const files = (gov.tree && gov.tree[key]) || [];
    return `<div class="card"><h2>${title}</h2>
      <p class="muted mono">${base}</p>
      <ul class="mono" style="line-height:1.9">${files.length ? files.map(f => `<li><a class="link" href="#/page/${encodeURIComponent(key + "/" + f.replace(/\.md$/, ""))}">${DOMPurify.sanitize(f)}</a></li>`).join("") : "<li class='muted'>—</li>"}</ul>
    </div>`;
  };
  $("#main").innerHTML = `
    <h1>Governance <span class="pill ok"><span class="dot"></span> sacred</span> <span class="pill"><span class="dot"></span> ${DOMPurify.sanitize(gov.gitDate || "")}</span></h1>
    <p class="muted">Single source of truth. Immutable except by constitutional amendment.
      Authority: <span class="mono">${DOMPurify.sanitize(gov.authority || "")}</span></p>
    <div class="grid cols-3">
      ${section("Constitution", "constitution", "governance/constitution/")}
      ${section("Engineering Standards", "standards", "governance/standards/")}
      ${section("RFCs", "rfcs", "governance/rfcs/")}
      ${section("Laws", "laws", "governance/laws/")}
      ${section("Roadmap", "roadmap", "governance/roadmap/")}
    </div>
    <div class="card" style="margin-top:16px"><h2>Linked brain pages</h2>
      <div class="row">
        <a class="btn secondary" href="#/page/governance/index">governance/index</a>
        <a class="btn secondary" href="#/page/engineering-organization">engineering-organization</a>
        <a class="btn secondary" href="#/page/decision-ledger">decision-ledger</a>
      </div>
    </div>`;
}


// ---------- Phase 11: notification system ----------
function notify(msg, kind = "info") {
  const key = "forgeos-notifications";
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  list.unshift({ msg, kind, ts: Date.now() });
  localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  toast(msg, kind);
}

// ---------- Phase 11: work item templates ----------
const WORK_ITEM_TEMPLATES = {
  "feature": { title: "Feature: [name]", status: "todo", priority: "medium", assignee: "agent-1" },
  "bugfix": { title: "Bugfix: [description]", status: "todo", priority: "high", assignee: "agent-1" },
  "mission": { title: "Mission: [objective]", status: "todo", priority: "medium", assignee: "agent-1" },
  "review": { title: "Review: [artifact]", status: "review", priority: "low", assignee: "agent-1" },
};

// ---------- Sentry error tracking ----------
function initSentry() {
  if (typeof Sentry === "undefined") return;
  Sentry.init({
    dsn: window.SENTRY_DSN || "https://YOUR_DSN@o123.ingest.sentry.io/123",
    environment: location.hostname === "localhost" ? "development" : "production",
    tracesSampleRate: 0.1,
  });
}

// ---------- PoolLeague control panel ----------
async function renderPoolleague() {
  crumb([["ForgeOS", "#/dashboard"], ["PoolLeague"]]);
  document.querySelector("main").innerHTML = `
    <h1>PoolLeague Control</h1>
    <div class="grid cols-2">
      <div class="card">
        <h2>Backend Status</h2>
        <pre id="poolleague-status" class="code json">loading...</pre>
      </div>
      <div class="card">
        <h2>Actions</h2>
        <button class="btn primary" id="poolleague-refresh">Refresh</button>
        <button class="btn secondary" id="poolleague-open-web">Open Web UI</button>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Tournaments</h2>
      <pre id="poolleague-tournaments" class="code json">loading...</pre>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Matches</h2>
      <pre id="poolleague-matches" class="code json">loading...</pre>
    </div>`;
  const refresh = async () => {
    try {
      const [status, tournaments, matches] = await Promise.all([
        safe(api.poolleagueStatus).catch(() => ({ ok: false })),
        safe(api.poolleagueTournaments).catch(() => ({ ok: false, data: [] })),
        safe(api.poolleagueMatches).catch(() => ({ ok: false, data: [] })),
      ]);
      const statusEl = document.querySelector("#poolleague-status");
      const tournamentsEl = document.querySelector("#poolleague-tournaments");
      const matchesEl = document.querySelector("#poolleague-matches");
      if (statusEl) statusEl.textContent = JSON.stringify(status, null, 2);
      if (tournamentsEl) tournamentsEl.textContent = JSON.stringify(tournaments.data || [], null, 2);
      if (matchesEl) matchesEl.textContent = JSON.stringify(matches.data || [], null, 2);
    } catch (e) {
      toast("poolleague error: " + errMsg(e), "err");
    }
  };
  refresh();
  document.querySelector("#poolleague-refresh").addEventListener("click", refresh);
  document.querySelector("#poolleague-open-web").addEventListener("click", () => {
    window.open("http://localhost:3000", "_blank");
  });
}

// ---------- Monitoring: live agent + PoolLeague status ----------
async function renderMonitoring() {
  crumb([["ForgeOS", "#/dashboard"], ["Monitoring"]]);
  $("main").innerHTML = `
    <h1>Monitoring</h1>
    <div class="grid cols-2">
      <div class="card">
        <h2>C-Suite Agents</h2>
        <div id="agent-status">loading...</div>
      </div>
      <div class="card">
        <h2>PoolLeague</h2>
        <pre id="poolleague-monitor" class="code json">loading...</pre>
      </div>
    </div>`;
  const refresh = async () => {
    try {
      const [agents, poolleague] = await Promise.all([
        safe(api.monitoringAgents).catch(() => ({ agents: [] })),
        safe(api.poolleagueStatus).catch(() => ({ ok: false })),
      ]);
      const agentEl = document.querySelector("#agent-status");
      const poolEl = document.querySelector("#poolleague-monitor");
      if (agentEl) {
        const list = (agents.agents || []).map(a => `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="mono">${a.role}</span><span class="pill ${a.status==='idle'?'ok':'warn'}">${a.status}</span></div>`).join("");
        agentEl.innerHTML = list || "<p class='muted'>no agent data</p>";
      }
      if (poolEl) poolEl.textContent = JSON.stringify(poolleague, null, 2);
    } catch (e) {
      toast("monitor error: " + errMsg(e), "err");
    }
  };
  refresh();
  setInterval(refresh, 5000);
}

// ---------- Phase 11: setup wizard ----------
async function renderWizard() {
  crumb([["ForgeOS", "#/dashboard"], ["Setup Wizard"]]);
  const done = localStorage.getItem("forgeos-wizard-done");
  document.body.classList.toggle("wizard-active", !done);
  document.body.classList.toggle("wizard-done", !!done);
  document.querySelector("main").innerHTML = `<h1>Setup Wizard</h1>
    <div class="card">
      <h2>Welcome to ForgeOS Brain Console</h2>
      <p class="muted">This wizard will guide you through the initial configuration. Estimated time: 2 minutes.</p>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" id="wizard-start">Start Setup</button>
      </div>
    </div>
    <div id="wizard-step" class="card" style="margin-top:16px;display:none"></div>`;

  const step = (idx, title, body, nextLabel = "Next") => {
    const el = document.querySelector("#wizard-step");
    if (!el) return;
    el.style.display = "block";
    el.innerHTML = `<h2>${DOMPurify.sanitize(title)}</h2>
      <div style="margin-top:8px">${body}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn secondary" id="wizard-skip">Skip</button>
        <button class="btn primary" id="wizard-next">${DOMPurify.sanitize(nextLabel)}</button>
      </div>`;
    let stepIdx = idx;
    document.querySelector("#wizard-next").addEventListener("click", () => {
      stepIdx += 1;
      runWizardStep(stepIdx);
    });
    document.querySelector("#wizard-skip").addEventListener("click", () => finishWizard());
  };

  const runWizardStep = (idx) => {
    if (idx === 1) {
      step(idx, "Console Configuration", `
        <p class="muted">Set the port and token for your local console.</p>
        <div class="row" style="margin-top:8px"><label>Port</label><input id="w-port" class="mono" value="7777" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
        <div class="row" style="margin-top:8px"><label>Token</label><input id="w-token" class="mono" placeholder="optional" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      `);
    } else if (idx === 2) {
      step(idx, "Brain & Model", `
        <p class="muted">Configure your gbrain path and Ollama endpoint.</p>
        <div class="row" style="margin-top:8px"><label>GBRAIN_HOME</label><input id="w-gbrain" class="mono" value="C:\ForgeOS" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
        <div class="row" style="margin-top:8px"><label>Ollama URL</label><input id="w-ollama" class="mono" value="http://localhost:11434/v1" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      `);
    } else if (idx === 3) {
      step(idx, "VPS Connection", `
        <p class="muted">Connect to your VPS for agent orchestration.</p>
        <div class="row" style="margin-top:8px"><label>Host</label><input id="w-host" class="mono" placeholder="host" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
        <div class="row" style="margin-top:8px"><label>SSH Port</label><input id="w-ssh" class="mono" value="2222" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      `);
    } else if (idx === 4) {
      step(idx, "First Mission", `
        <p class="muted">Create your first mission and dispatch an agent.</p>
        <div class="row" style="margin-top:8px"><label>Mission title</label><input id="w-title" class="mono" value="Demo mission" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      `, "Launch");
    } else {
      finishWizard();
    }
  };

  const finishWizard = async () => {
    localStorage.setItem("forgeos-wizard-done", "true");
    document.body.classList.add("wizard-done");
    document.body.classList.remove("wizard-active");
    const port = (document.querySelector("#w-port")?.value || "").trim() || "7777";
    const title = (document.querySelector("#w-title")?.value || "").trim() || "Demo mission";
    if (title) {
      try {
        await safe(() => api.capture("missions/" + Date.now(), "mission", "# " + title));
        toast("Created first mission", "ok");
      } catch {}
    }
    location.hash = "#/projects";
  };

  document.querySelector("#wizard-start").addEventListener("click", () => runWizardStep(1));
}

// ---------- Phase 11: project management ----------
async function renderProjects() {
  crumb([["ForgeOS", "#/dashboard"], ["Projects"]]);
  document.querySelector("main").innerHTML = `<h1>Project Management</h1>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2>Work Items</h2>
        <button class="btn primary" id="new-work">New Work Item</button>
      </div>
      <div id="project-stats"></div>
      <div id="project-board" class="grid cols-4" style="margin-top:12px">
        ${["todo","in-progress","review","done"].map(status => `
          <div class="card">
            <h3>${DOMPurify.sanitize(status.replace("-"," "))}</h3>
            <div id="col-${status}" class="project-col" data-status="${status}"></div>
          </div>
        `).join("")}
      </div>
    </div>
    <div id="project-modal" class="modal-backdrop" style="display:none">
      <div class="modal">
        <h2>Work Item</h2>
        <div class="row" style="margin-top:8px"><label>Title</label><input id="p-title" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
        <div class="row" style="margin-top:8px"><label>Assignee</label><input id="p-assignee" class="mono" value="agent-1" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
        <div class="row" style="margin-top:8px"><label>Template</label><select id="p-template" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">custom</option>
          <option value="feature">Feature</option>
          <option value="bugfix">Bugfix</option>
          <option value="mission">Mission</option>
          <option value="review">Review</option>
        </select></div>
        <div class="row" style="margin-top:8px"><label>Priority</label><select id="p-priority" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="low">low</option><option value="medium" selected>medium</option><option value="high">high</option>
        </select></div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="p-save">Save</button>
          <button class="btn secondary" id="p-cancel">Cancel</button>
        </div>
      </div>
    </div>`;

  const STORE_KEY = "forgeos-work-items";
  const load = () => JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  const save = (items) => localStorage.setItem(STORE_KEY, JSON.stringify(items));

  const renderBoard = () => {
    const items = load();
    ["todo","in-progress","review","done"].forEach(status => {
      const col = document.querySelector(`#col-${status}`);
      if (!col) return;
      const list = items.filter(i => i.status === status);
      col.innerHTML = list.map(i => `
        <div class="card" data-id="${DOMPurify.sanitize(i.id)}">
          <div class="row" style="justify-content:space-between">
            <strong>${DOMPurify.sanitize(i.title)}</strong>
            <span class="pill ${i.priority==="high"?"warn":""}">${DOMPurify.sanitize(i.priority)}</span>
          </div>
          <p class="muted mono">${DOMPurify.sanitize(i.assignee || "unassigned")}</p>
          <div class="row" style="margin-top:8px;gap:6px">
            ${status !== "todo" ? `<button class="btn secondary" data-move="${DOMPurify.sanitize(i.id)}" data-to="todo">←</button>` : ""}
            ${status !== "done" ? `<button class="btn secondary" data-move="${DOMPurify.sanitize(i.id)}" data-to="${status==="todo"?"in-progress":status==="in-progress"?"review":"done"}">→</button>` : ""}
            <button class="btn secondary" data-delete="${DOMPurify.sanitize(i.id)}">×</button>
          </div>
        </div>
      `).join("") || `<p class="muted">no items</p>`;
    });
  };


  // ---------- Phase 11: burndown + velocity ----------
  const renderStats = () => {
    const items = load();
    const total = items.length;
    const done = items.filter(i => i.status === "done").length;
    const inProgress = items.filter(i => i.status === "in-progress").length;
    const review = items.filter(i => i.status === "review").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const stats = $(`#project-stats`);
    if (stats) {
      stats.innerHTML = `
        <div class="grid cols-4" style="margin-top:12px">
          <div class="card"><h3>${total}</h3><p class="muted">Total</p></div>
          <div class="card"><h3>${inProgress}</h3><p class="muted">In Progress</p></div>
          <div class="card"><h3>${review}</h3><p class="muted">Review</p></div>
          <div class="card"><h3>${pct}%</h3><p class="muted">Complete</p></div>
        </div>
        <div class="card" style="margin-top:12px">
          <h3>Burndown</h3>
          <div class="progress-track" style="height:24px;margin-top:8px">
            <div class="progress-bar" style="width:${pct}%;height:100%"></div>
          </div>
          <p class="muted" style="margin-top:8px">${done} of ${total} items done</p>
        </div>
      `;
    }
  };

  const originalRender = renderBoard;
  renderBoard = () => { originalRender(); renderStats(); };


  renderBoard();
  document.querySelector("#new-work").addEventListener("click", () => {
    document.querySelector("#project-modal").style.display = "block";
    document.querySelector("#p-title").value = "";
    document.querySelector("#p-assignee").value = "agent-1";
  });
  document.querySelector("#p-cancel").addEventListener("click", () => { document.querySelector("#project-modal").style.display = "none"; });
  document.querySelector("#p-save").addEventListener("click", () => {
    const title = document.querySelector("#p-title").value.trim();
    if (!title) return;
    const items = load();
    items.push({ id: String(Date.now()), title, status: "todo", priority: document.querySelector("#p-priority").value, assignee: document.querySelector("#p-assignee").value.trim() || "unassigned" });
    save(items);
    document.querySelector("#project-modal").style.display = "none";
    renderBoard();
    toast("work item created", "ok");
  });
  document.querySelector("#project-board").addEventListener("click", (e) => {
    const moveBtn = e.target.closest("[data-move]");
    const delBtn = e.target.closest("[data-delete]");
    if (moveBtn) {
      const items = load();
      const item = items.find(i => i.id === moveBtn.dataset.move);
      if (item) { item.status = moveBtn.dataset.to; save(items); renderBoard(); }
    }
    if (delBtn) {
      const items = load().filter(i => i.id !== delBtn.dataset.delete);
      save(items); renderBoard();
    }
  });
}

// ---------- Phase 11: settings ----------
async function renderSettings() {
  crumb([["ForgeOS", "#/dashboard"], ["Settings"]]);
  document.querySelector("main").innerHTML = `<h1 data-tooltip="Open settings">Settings</h1>
    <div class="card">
      <h2>Environment</h2>
      <p class="muted">These values are loaded from the server process. Changing them requires a server restart.</p>
      <div id="settings-env" class="mono" style="margin-top:8px;line-height:1.8"></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Preferences</h2>
      <div class="row" style="margin-top:8px">
        <label>Theme</label>
        <select id="s-theme" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="system">System</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="hc">High contrast</option>
          <option value="midnight">Midnight</option>
          <option value="solarized-light">Solarized light</option>
          <option value="retro">Retro</option>
          <option value="matrix">Matrix</option>
          <option value="ocean">Ocean</option>
        </select>
      </div>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="s-save">Save preferences</button></div>
    </div>`;
  try {
    const s = await safe(api.status).catch(() => null);
    const env = document.querySelector("#settings-env");
    if (env && s) {
      env.innerHTML = [
        ["Port", s.console_port || "—"],
        ["GBRAIN_HOME", s.gbrain_home || "C:\ForgeOS"],
        ["Ollama", s.ollama ? "http://localhost:11434/v1" : "off"],
        ["Auth", s.auth ? "enabled" : "disabled"],
        ["Embedding model", s.embedding_model || "—"],
      ].map(([k,v]) => `<div><span class="muted">${k}:</span> <span>${DOMPurify.sanitize(v)}</span></div>`).join("");
    }
  } catch {}
  const saved = localStorage.getItem("forgeos-theme") || "system";
  const themeSel = document.querySelector("#s-theme");
  if (themeSel) themeSel.value = saved;
  document.querySelector("#s-save").addEventListener("click", () => {
    const val = document.querySelector("#s-theme").value;
    localStorage.setItem("forgeos-theme", val);
    applyTheme(val);
    toast("preferences saved", "ok");
  });
}

// ---------- Phase 11: workflows ----------
async function renderWorkflows() {
  crumb([["ForgeOS", "#/dashboard"], ["Workflows"]]);
  document.querySelector("main").innerHTML = `<h1>Agent Workflows</h1>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2>Workflows</h2>
        <button class="btn primary" id="new-workflow">New workflow</button>
      </div>
      <pre id="workflow-out" class="code json" style="margin-top:12px"></pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.workflows).catch(() => ({ workflows: [] }));
      const out = document.querySelector("#workflow-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      const out = document.querySelector("#workflow-out");
      if (out) out.textContent = "workflow error: " + errMsg(e);
    }
  };
  refresh();
  document.querySelector("#new-workflow").addEventListener("click", async () => {
    const title = prompt("Workflow title:");
    if (!title) return;
    const r = await safe(() => api.createWorkflow({ title, steps: [] })).catch(e => ({ error: errMsg(e) }));
    toast(r.error ? "workflow failed: " + r.error : "workflow created", r.error ? "err" : "ok");
    refresh();
  });
}

// ---------- Phase 11: marketplace ----------
async function renderMarketplace() {
  crumb([["ForgeOS", "#/dashboard"], ["Marketplace"]]);
  document.querySelector("main").innerHTML = `<h1>Agent Marketplace</h1>
    <div class="card">
      <h2>Discoverable agents</h2>
      <pre id="market-out" class="code json" style="margin-top:12px"></pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.marketplace).catch(() => ({ marketplace: [] }));
      const out = document.querySelector("#market-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      const out = document.querySelector("#market-out");
      if (out) out.textContent = "marketplace error: " + errMsg(e);
    }
  };
  refresh();
}

// ---------- Phase 11: plugins ----------
async function renderPlugins() {
  crumb([["ForgeOS", "#/dashboard"], ["Plugins"]]);
  document.querySelector("main").innerHTML = `<h1>Plugins</h1>
    <div class="card">
      <h2>Loaded modules</h2>
      <pre id="plugin-out" class="code json" style="margin-top:12px"></pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.plugins).catch(() => ({ plugins: [] }));
      const out = document.querySelector("#plugin-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      const out = document.querySelector("#plugin-out");
      if (out) out.textContent = "plugin error: " + errMsg(e);
    }
  };
  refresh();
}

// ===================== ROUTER =====================


// ---------- Push notifications ----------
async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  const perm = await Notification.requestPermission();
  return perm;
}
function showNotification(title, body, icon) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: icon || '/favicon.ico' });
  }
}
// Register service worker for push
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    console.log('SW registered for push');
  }).catch(e => console.warn('SW failed:', e));
}
// ---------- Plugin hot-reload UI ----------
async function reloadPlugins() {
  const btn = document.getElementById('plugin-reload-btn');
  if (btn) btn.textContent = 'Reloading...';
  await api.post('/api/hotreload', {}, { headers: { 'x-reload-secret': '' } }).catch(() => ({}));
  if (btn) btn.textContent = 'Reload Plugins';
  toast('Plugins reloaded');
}
// ---------- Webhook management panel ----------

async function renderWebhooks() {
  const list = await api.listWebhooks().catch(() => ({ webhooks: [] }));
  const dead = await api.get('/api/webhooks/dead-letter').catch(() => ({ dead: [] }));
  document.querySelector("main").innerHTML = `<h1>Webhooks</h1>
    <div class="card"><h3>Create Webhook</h3>
      <input id="wh-url" class="input" placeholder="https://example.com/hook"/>
      <input id="wh-events" class="input" placeholder="mission.created,agent.completed"/>
      <input id="wh-secret" class="input" placeholder="optional secret"/>
      <button class="btn" id="wh-create">Create</button>
    </div>
    <h2>Active Webhooks</h2>
    <div id="wh-list">${(list.webhooks||[]).map(w => `<div class="card"><b>${w.url}</b><br/><span class="muted">${w.events.join(", ")} ${w.active ? "✅" : "⏸️"}</span></div>`).join("")}</div>
    <h2>Dead Letter Queue</h2>
    <div id="dlq-list">${(dead.dead||[]).map(d => `<div class="card"><b>${d.url}</b><br/><span class="muted">${d.event} — ${d.error}</span></div>`).join("")}</div>`;
  $("#wh-create")?.addEventListener("click", async () => {
    const url = $("#wh-url")?.value;
    const events = ($("#wh-events")?.value || "").split(",").map(s => s.trim()).filter(Boolean);
    await api.createWebhook(url, events, $("#wh-secret")?.value);
    renderWebhooks();
  });
}

// ---------- Drag-and-drop kanban ----------
function initKanban(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let dragged = null;
  container.querySelectorAll(".kanban-col").forEach(col => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault(); col.classList.remove("drag-over");
      if (!dragged) return;
      const item = dragged;
      col.querySelector(".kanban-items").appendChild(item);
      item.dataset.from = col.dataset.status;
      item.dispatchEvent(new CustomEvent("kanban-move", { detail: { from: item.dataset.from, to: col.dataset.status, id: item.dataset.id } }));
    });
  });
  container.querySelectorAll(".kanban-item").forEach(item => {
    item.draggable = true;
    item.addEventListener("dragstart", (e) => { dragged = item; e.dataTransfer.effectAllowed = "move"; });
    item.addEventListener("dragend", () => { dragged = null; container.querySelectorAll(".kanban-col").forEach(c => c.classList.remove("drag-over")); });
  });
}


// ---------- Virtual scrolling ----------
function initVirtualScroll(containerId, rowHeight = 40, buffer = 10) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const rows = Array.from(container.querySelectorAll('tr'));
  const total = rows.length;
  const viewport = document.createElement('div');
  viewport.style.cssText = `height:${total * rowHeight}px;position:relative;overflow:auto;`;
  const view = document.createElement('div');
  view.style.cssText = 'position:absolute;top:0;left:0;right:0;';
  container.innerHTML = '';
  container.appendChild(viewport);
  viewport.appendChild(view);
  function render() {
    const scrollTop = viewport.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const end = Math.min(total, Math.ceil((scrollTop + viewport.clientHeight) / rowHeight) + buffer);
    let html = '';
    for (let i = start; i < end; i++) {
      html += rows[i].outerHTML;
    }
    view.innerHTML = html;
    view.style.transform = `translateY(${start * rowHeight}px)`;
  }
  viewport.addEventListener('scroll', render);
  render();
}

// ---------- Lazy panel loading ----------
const panelCache = {};
async function loadPanel(name) {
  if (panelCache[name]) return panelCache[name]();
  // In production, these would be separate chunks; for now, wrap existing render fns
  const fn = window[name];
  if (!fn) return '<div class="card">Panel not found</div>';
  const html = await fn();
  return html;
}

// ---------- Offline capture queue (IndexedDB) ----------
let offlineDB = null;
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    if (offlineDB) return resolve(offlineDB);
    const req = indexedDB.open('forgeos-offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('captures')) {
        db.createObjectStore('captures', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => { offlineDB = req.result; resolve(offlineDB); };
    req.onerror = () => reject(req.error);
  });
}
async function queueCapture(data) {
  const db = await openOfflineDB();
  const tx = db.transaction('captures', 'readwrite');
  tx.objectStore('captures').add({ ...data, ts: Date.now() });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  toast('Saved offline — will sync when online');
}
async function flushOfflineQueue() {
  if (!navigator.onLine) return;
  const db = await openOfflineDB();
  const tx = db.transaction('captures', 'readwrite');
  const store = tx.objectStore('captures');
  const items = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!items.length) return;
  for (const item of items) {
    try {
      await api.capture(item.slug, item.type || 'note', item.body);
    } catch (e) {
      toast('sync failed: ' + errMsg(e), 'err');
      return;
    }
  }
  const clearTx = db.transaction('captures', 'readwrite');
  clearTx.objectStore('captures').clear();
  await new Promise((resolve, reject) => {
    clearTx.oncomplete = resolve;
    clearTx.onerror = () => reject(clearTx.error);
  });
  toast(`Synced ${items.length} captures`, 'ok');
}
window.addEventListener('online', flushOfflineQueue);
// ---------- Live search/filter ----------
function initLiveSearch(containerId, rowSelector, delay = 200) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const search = document.createElement("input");
  search.type = "text"; search.placeholder = "Filter..."; search.className = "input";
  search.style.cssText = "margin-bottom:8px;width:100%;box-sizing:border-box;";
  container.insertBefore(search, container.firstChild);
  let timer;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = search.value.toLowerCase().trim();
      container.querySelectorAll(rowSelector).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = (!q || text.includes(q)) ? "" : "none";
      });
    }, delay);
  });
}

const NAV = [
  ["Command Center", tooltip("Command Center", "Command Center overview"), "command"], ["Governance", tooltip("Governance", "View and manage ForgeOS governance"), "governance"], ["Dashboard", tooltip("Dashboard", "Console dashboard with system metrics"), "dashboard"], ["Roles", "roles"], ["Org", tooltip("Org", "Organization chart and structure"), "org"], ["Timeline", tooltip("Timeline", "Decision timeline and history"), "timeline"], ["Ledger", tooltip("Ledger", "Decision ledger with filters"), "ledger"],
  ["Search", tooltip("Search", "Search across brains and pages"), "search"], ["Capture", tooltip("Capture", "Capture and create new brain pages"), "capture"], ["Decisions", tooltip("Decisions", "Decision management and tracking"), "decisions"], ["Missions", tooltip("Missions", "Agent missions and dispatch"), "missions"], ["MCP", tooltip("MCP", "Model Context Protocol tools"), "mcp"], ["Vault", "vault"],
  ["Embeddings", "embed"], ["Federation", tooltip("Federation", "Cross-brain federation status"), "federation"], ["Audit", tooltip("Audit", "Audit log and compliance trail"), "audit"], ["Schema", tooltip("Schema", "Brain schema explorer"), "schema"], ["Config", "config"],
  ["Projects", tooltip("Projects", "Project management and kanban"), "projects"], ["Wizard", tooltip("Wizard", "Setup wizard for first-time config"), "wizard"], ["Monitoring", tooltip("Monitoring", "Live agent and PoolLeague status"), "monitoring"], ["Settings", tooltip("Settings", "Console settings and configuration"), "settings"], ["Workflows", tooltip("Workflows", "Agent workflow management"), "workflows"], ["Marketplace", tooltip("Marketplace", "Browse discoverable agents"), "marketplace"], ["Plugins", tooltip("Plugins", "Manage console plugins"), "plugins"],
];

const routes = {
  command: renderCommand, governance: renderGovernance, dashboard: renderDashboard, roles: renderRoles, org: renderOrg, timeline: renderTimeline, ledger: renderLedger,
  search: renderSearch, capture: renderCapture, decisions: renderDecisions, missions: renderMissions, mcp: renderMCP, vault: renderVault, vaultfile: renderVaultFile,
  embed: renderEmbed, federation: renderFederation, audit: renderAudit, schema: renderSchema, config: renderConfig,
  projects: renderProjects, wizard: renderWizard, monitoring: renderMonitoring, settings: renderSettings, workflows: renderWorkflows, marketplace: renderMarketplace, plugins: renderPlugins, webhooks: renderWebhooks,
};

// ---------- (50) per-panel error boundary ----------
async function guard(fn, slug) {
  try { await fn(slug); }
  catch (e) { $("#main").innerHTML = `<div class="card"><h2>Panel error</h2><pre class="json">${DOMPurify.sanitize(errMsg(e))}</pre></div>`; }
}

// =====================================================================
// RFC-0000 additions: 50 feature + theme/vis additions
// =====================================================================

// ---------- helpers: theme switcher ----------
function renderThemeSwitcher(active = "dark") {
  const themes = ["dark","midnight","graphite","retro","ocean","berry","matrix","solarized-light","light","hc"];
  return `<div class="theme-swatches">${themes.map(t => `<button class="swatch ${t===active?'active':''}" data-tip="${t}" style="background:${themeBg(t)}" data-theme-switch="${t}"></button>`).join("")}</div>
    <p class="caption" style="margin-top:8px">Tip: <span class="kbd">⌘K</span> command palette → search “theme”</p>`;
}
function themeBg(t) {
  return { dark:"#0b0e14", midnight:"#07080c", graphite:"#0f1115", retro:"#1a1025", ocean:"#0b1622", berry:"#180a16", matrix:"#0a0f0a", "solarized-light":"#fdf6e3", light:"#f4f6fa", hc:"#000" }[t] || "#111";
}
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("forgeos-theme", t);
  toast("theme: " + t, "ok");
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-theme-switch]"); if (!b) return; e.preventDefault(); applyTheme(b.dataset.themeSwitch);
});

// ---------- helpers: SVG chart skeletons ----------
function svgWrap(w=600, h=220) {
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;
}
function svgEnd() { return `</svg>`; }
function xAxisLabels(labels, w=600, h=220) {
  const n=labels.length; if (!n) return "";
  const step=w/Math.max(n-1,1);
  return labels.map((l,i)=>`<text class="label" x="${(i*step).toFixed(1)}" y="${h-4}" text-anchor="middle">${DOMPurify.sanitize(l)}</text>`).join("");
}
function gridLines(h=220, count=4) {
  return Array.from({length:count},(_,i)=>{
    const y=(i/(count-1))*h; return `<line class="grid-line" x1="0" y1="${y.toFixed(1)}" x2="600" y2="${y.toFixed(1)}"/>`;
  }).join("");
}

// ---------- (51) bar chart ----------
function barChart(series, w=600, h=220) {
  // series: [{label,value,cls}] cls: ""|"ok"|"bad"
  const max = Math.max(1, ...series.map(s=>s.value));
  const barW = Math.max(12, Math.floor((w - 20) / Math.max(series.length,1)) - 6);
  const bars = series.map((s,i)=>{
    const bh = Math.round((s.value/max)*(h-30));
    const x = 10 + i*(barW+6);
    const y = h-20-bh;
    return `<rect class="bar-rect ${s.cls||""}" x="${x}" y="${y}" width="${barW}" height="${bh}" rx="3"><title>${DOMPurify.sanitize(s.label)}: ${s.value}</title></rect>
      <text class="label" x="${x+barW/2}" y="${h-6}" text-anchor="middle">${DOMPurify.sanitize(s.label)}</text>`;
  }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${gridLines(h)}${bars}${svgEnd()}</svg></div>`;
}

// ---------- (52) donut chart ----------
function donutChart(series, w=600, h=240) {
  const total = Math.max(1, series.reduce((a,b)=>a+b.value,0));
  const r = Math.min(w,h)/2 - 24; const cx = w/2; const cy = h/2 - 10;
  const circ = 2*Math.PI*r;
  let offset = 0;
  const segs = series.map(s => {
    const frac = s.value/total; const dash = frac*circ; const gap = circ-dash;
    const path = `<circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}" stroke="${s.color||'var(--accent)'}" stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}"><title>${DOMPurify.sanitize(s.label)}: ${s.value}</title></circle>`;
    offset += dash; return path;
  }).join("");
  const legend = series.map(s => `<span class="swatch" style="background:${s.color||'var(--accent)'}"></span><span>${DOMPurify.sanitize(s.label)} ${s.value}</span>`).join("");
  return `<div class="chart" style="text-align:center">
    <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <circle class="donut-ring" cx="${cx}" cy="${cy}" r="${r}"/>
      ${segs}
      <circle class="donut-hole" cx="${cx}" cy="${cy}" r="${Math.max(4, r-18)}"/>
      <text class="donut-center" x="${cx}" y="${cy}">${total}</text>
    </svg>
    <div class="donut-legend">${legend}</div>
  </div>`;
}

// ---------- (53) line chart with area ----------
function lineChart(points, w=600, h=220, color="var(--accent)") {
  const max = Math.max(1, ...points); const min = Math.min(0, ...points);
  const range = max - min || 1; const step = w/Math.max(points.length-1,1);
  const coords = points.map((v,i)=>({x:i*step, y: h-20 - ((v-min)/range)*(h-30)}));
  const d = coords.map((c,i)=> (i? "L":"M") + `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = d + ` L${coords[coords.length-1].x},${h-20} L0,${h-20} Z`;
  const dots = coords.map(c => `<circle class="dot" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" fill="var(--surface)"><title>${v=>v}</title></circle>`).join("");
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${gridLines(h)}
    <path class="line-area" d="${area}" fill="${color}"/>
    <path class="line-path" d="${d}" stroke="${color}"/>
    ${dots}${svgEnd()}</svg></div>`;
}

// ---------- (54) gauge ----------
function gauge(value, max=100, w=600, h=150) {
  const r = Math.min(w,h)/2 - 24; const cx = w/2; const cy = h/2 + 10;
  const circ = 2*Math.PI*r; const pct = Math.max(0,Math.min(1, value/max));
  const dash = pct*circ; const gap = circ-dash;
  const color = pct > 0.8 ? "var(--success)" : pct > 0.4 ? "var(--warn)" : "var(--danger)";
  return `<div class="chart" style="text-align:center">
    <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <circle class="gauge-bg" cx="${cx}" cy="${cy}" r="${r}" stroke-dasharray="${circ} ${circ}" transform="rotate(135 ${cx} ${cy})"/>
      <circle class="gauge-fg" cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" transform="rotate(135 ${cx} ${cy})"/>
      <text class="gauge-label" x="${cx}" y="${cy-8}" text-anchor="middle">score</text>
      <text class="donut-center" x="${cx}" y="${cy+12}">${value}</text>
    </svg>
  </div>`;
}

// ---------- (55) heatmap ----------
function heatmap(weeks=12, days=7, intensityFn=(d,w)=> Math.random()) {
  const cells = [];
  for (let w=0;w<weeks;w++) for (let d=0;d<days;d++) {
    const v = intensityFn(d,w); const lvl = v<0.2?"":v<0.4?"l1":v<0.6?"l2":v<0.8?"l3":"l4"; if(v>0.9) lvl="l5";
    cells.push(`<span class="heat-cell ${lvl}" title="day ${d} week ${w}: ${v.toFixed(2)}"></span>`);
  }
  return `<div class="heatmap" style="grid-template-columns:repeat(${weeks},1fr);grid-row:repeat(${days},1fr)">${cells.join("")}</div>
    <div class="row" style="margin-top:6px"><span class="caption">Less</span><span class="heat-cell l1"></span><span class="heat-cell l2"></span><span class="heat-cell l3"></span><span class="heat-cell l4"></span><span class="heat-cell l5"></span><span class="caption">More</span></div>`;
}

// ---------- (56) timeline renderer ----------
function timeline(items) {
  // items: [{time, title, meta, cls}] cls: ""|"done"|"blocked"
  return `<div class="timeline">${items.map(i=>`<div class="tl-item ${i.cls||""}">
    <div class="tl-time">${DOMPurify.sanitize(i.time)}</div>
    <div class="tl-title">${DOMPurify.sanitize(i.title)}</div>
    ${i.meta ? `<div class="tl-meta">${DOMPurify.sanitize(i.meta)}</div>` : ""}
  </div>`).join("")}</div>`;
}

// ---------- (57) stepper ----------
function stepper(steps, activeIdx=0) {
  return `<div class="stepper">${steps.map((s,i)=>`
    <div class="step ${i<activeIdx?"done":i===activeIdx?"active":""}"><span class="circle">${i<activeIdx?"✓":(i+1)}</span><span class="caption">${DOMPurify.sanitize(s)}</span>
    ${i<steps.length-1 ? `<div class="step-line ${i<activeIdx?"done":""}"></div>` : ""}
  </div>`).join("")}</div>`;
}

// ---------- (58) tabs ----------
function tabs(items, activeIdx=0, onSwitch) {
  return `<div class="tabs">${items.map((t,i)=>`<div class="tab ${i===activeIdx?"active":""}" data-tab="${i}">${DOMPurify.sanitize(t)}</div>`).join("")}</div>
  <div class="tab-panel" data-panel="${activeIdx}"></div>`;
}
document.addEventListener("click", e => {
  const t = e.target.closest(".tab"); if (!t) return;
  const parent = t.parentElement; parent.querySelectorAll(".tab").forEach((x,i)=> x.classList.toggle("active", i===Number(t.dataset.tab)));
  const panel = parent.nextElementSibling; if (panel) panel.dataset.panel = t.dataset.tab;
});

// ---------- (59) snackbar ----------
function snackbar(msg, kind="") {
  const el = document.createElement("div"); el.className = "snackbar " + kind; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2800);
}

// ---------- (60) KPI stat row ----------
function statTile(label, value, delta, deltaDir="up") {
  return `<div class="stat">
    <div class="caption">${DOMPurify.sanitize(label)}</div>
    <div class="value">${DOMPurify.sanitize(value)}</div>
    <div class="delta ${deltaDir}">${deltaDir==="up"?"▲":"▼"} ${DOMPurify.sanitize(delta)}</div>
  </div>`;
}

// =====================================================================
// ===================== PANELS =====================
// =====================================================================

// ---------- (5) 404 route ----------
const KNOWN = new Set(["command","governance","dashboard","roles","org","timeline","ledger","search","capture","decisions","missions","mcp","vault","vaultfile","embed","federation","audit","schema","config","page","projects","wizard","settings","workflows","marketplace","plugins","webhooks"]);
// ---------- (10) favicon/title per panel ----------
const TITLES = { command:"Command Center", governance:"Governance", dashboard:"Console", roles:"Roles", org:"Org", timeline:"Timeline", ledger:"Decision Ledger", search:"Search", capture:"Capture", decisions:"Decisions", missions:"Missions", mcp:"MCP", vault:"Vault", vaultfile:"Vault", embed:"Embeddings", federation:"Federation", audit:"Audit", schema:"Schema", config:"Config", page:"Page", projects:"Projects", wizard:"Setup Wizard", settings:"Settings", workflows:"Workflows", marketplace:"Marketplace", plugins:"Plugins" };

// ---------- (11) restore last panel ----------
function lastPanel() { return localStorage.getItem("forgeos-last") || "command"; }

async function route() {
  let hash = location.hash.slice(2) || lastPanel();
  const parts = hash.split("/");
  const panel = parts[0];
  if (!KNOWN.has(panel)) { $("#main").innerHTML = empty("Unknown route: " + DOMPurify.sanitize(panel), `<a class="btn secondary" href="#/dashboard">Go home</a>`); document.title = "ForgeOS — 404"; return; }
  localStorage.setItem("forgeos-last", panel);
  document.title = "ForgeOS — " + (TITLES[panel] || "Console");
  document.querySelectorAll(".sidebar a").forEach(a => a.classList.remove("active"));
  const navEl = document.querySelector(`.sidebar a[href="#/${panel}"]`);
  if (navEl) navEl.classList.add("active");
  if (panel === "page") return guard(() => renderPage(parts[1]), parts[1]);
  if (panel === "vaultfile") return guard(() => renderVaultFile(parts[1]), parts[1]);
  await guard(routes[panel] || routes.dashboard);
}

// ---------- (27) command palette: fuzzy + arrows + history ----------
const MAXHIST = 8;
function pushHist(h) { const a = JSON.parse(localStorage.getItem("forgeos-hist") || "[]"); a.unshift(h); localStorage.setItem("forgeos-hist", JSON.stringify(a.slice(0, MAXHIST))); }
const CMDS = NAV.map(([label, , p]) => ({ label, go: () => { pushHist(p); location.hash = "#/" + p; } }));
let cmdkSel = 0;
function openCmdk() {
  const el = $("#cmdk"); el.classList.add("open"); cmdkSel = 0;
  const inp = el.querySelector("input"); inp.value = ""; inp.focus();
  renderCmdk("");
  inp.oninput = () => { cmdkSel = 0; renderCmdk(inp.value); };
  inp.onkeydown = (e) => {
    const items = $$("#cmdk li");
    if (e.key === "ArrowDown") { cmdkSel = Math.min(cmdkSel + 1, items.length - 1); paintSel(items); e.preventDefault(); }
    if (e.key === "ArrowUp") { cmdkSel = Math.max(cmdkSel - 1, 0); paintSel(items); e.preventDefault(); }
    if (e.key === "Enter") { items[cmdkSel] && items[cmdkSel].click(); }
  };
}
function paintSel(items) { items.forEach((li, i) => li.classList.toggle("sel", i === cmdkSel)); }
function renderCmdk(q) {
  const ul = $("#cmdk ul");
  const hist = JSON.parse(localStorage.getItem("forgeos-hist") || "[]");
  const opts = CMDS.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
  const histItems = q ? [] : hist.map(h => ({ label: "↺ " + (NAV.find(n => (n[2] ?? n[1]) === h)?.[0] || h), go: () => location.hash = "#/" + h }));
  const all = q ? opts : opts.concat(histItems);
  ul.innerHTML = all.map((c, i) => `<li data-i="${i}">${DOMPurify.sanitize(c.label)}</li>`).join("") || "<li class='muted'>no match</li>";
  $$("#cmdk li").forEach((li, i) => li.addEventListener("click", () => { all[i].go(); $("#cmdk").classList.remove("open"); }));
  paintSel($$("#cmdk li"));
}
// ---------- (35) confirm modal ----------
function confirmModal(msg, onYes) {
  const back = document.createElement("div");
  back.className = "modal-backdrop open";
  back.innerHTML = `<div class="modal"><h2>Confirm</h2><p>${DOMPurify.sanitize(msg)}</p>
    <div class="row"><button class="btn danger" id="y">Yes</button><button class="btn secondary" id="n">Cancel</button></div></div>`;
  document.body.appendChild(back);
  back.querySelector("#y").addEventListener("click", () => { back.remove(); onYes(); });
  back.querySelector("#n").addEventListener("click", () => back.remove());
}

// ---------- (13) copy deep link ----------
function copyLink(slug) {
  const url = `${location.origin}/#/page/${encodeURIComponent(slug)}`;
  navigator.clipboard?.writeText(url).then(() => toast("link copied", "ok"), () => toast("copy failed", "err"));
}

document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openCmdk(); }
  if (e.key === "Escape") { $("#cmdk").classList.remove("open"); }
  if (e.key === "?") { e.preventDefault(); showShortcuts(); }
  // quick nav: 1-9 jumps to panel
  if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key >= "1" && e.key <= "9") {
    const idx = Number(e.key) - 1;
    const target = NAV[idx];
    if (target && !$("cmdk").classList.contains("open")) { e.preventDefault(); location.hash = "#/" + (target[2] ?? target[1]); }
  }
  // g + 1-9 quick goto
  if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "g") {
    const listener = (ev) => {
      if (ev.key >= "1" && ev.key <= "9") {
        const idx = Number(ev.key) - 1;
        const target = NAV[idx];
        if (target) { ev.preventDefault(); location.hash = "#/" + (target[2] ?? target[1]); }
        document.removeEventListener("keydown", listener);
      } else if (ev.key !== "g" && ev.key !== "Shift" && ev.key !== "CapsLock") {
        document.removeEventListener("keydown", listener);
      }
    };
    document.addEventListener("keydown", listener);
    setTimeout(() => document.removeEventListener("keydown", listener), 800);
  }
});
function showShortcuts() {
  const back = document.createElement("div");
  back.className = "modal-backdrop open";
  back.innerHTML = `<div class="modal"><h2>Keyboard shortcuts</h2>
    <ul class="mono" style="line-height:1.9">
      <li>⌘K / Ctrl+K — command palette</li>
      <li>1-9 — jump to nav panel</li>
      <li>G then 1-9 — quick goto panel</li>
      <li>↑ / ↓ — move in sidebar</li>
      <li>? — this sheet</li>
      <li>Esc — close palette / modal</li>
    </ul>
    <button class="btn secondary" id="c">Close</button></div>`;
  document.body.appendChild(back);
  back.querySelector("#c").addEventListener("click", () => back.remove());
}

// ---------- (66) onboarding tour ----------
const TOUR_KEY = "forgeos-tour-done";
const TOUR_STEPS = [
  { title: "Welcome to ForgeOS", body: "This is your Brain Console — the control room for the ForgeOS engineering organization. Let's take a quick tour.", target: "#app" },
  { title: "Navigation", body: "Use the sidebar to jump between panels: Command Center, Governance, Search, Missions, and more.", target: "#sidebar" },
  { title: "Command Palette", body: "Press ⌘K (or Ctrl+K) to open the command palette. Type to fuzzy-search panels and hit Enter to jump.", target: "#cmdkbtn" },
  { title: "Theme", body: "Switch themes in Config. Try dark, light, or auto to match your system preference.", target: "#app" },
  { title: "Keyboard shortcuts", body: "Press ? anytime to see shortcuts. Use 1-9 to jump directly to a panel.", target: "#app" },
  { title: "You're ready", body: "Capture decisions, run missions, and keep the brain healthy. Enjoy ForgeOS!", target: "#app" },
];
let tourStep = 0;
function startTour() {
  if (localStorage.getItem(TOUR_KEY)) return;
  tourStep = 0;
  document.getElementById("tourbtn") && (document.getElementById("tourbtn").style.display = "none");
  renderTourStep();
}
function renderTourStep() {
  const step = TOUR_STEPS[tourStep];
  const card = $("#tour-card");
  const dots = $("#tour-dots");
  const backdrop = $("#tour-backdrop");
  const overlay = $("#tour-overlay");
  if (!card || !step) { endTour(); return; }
  // position near target or center
  const target = $(step.target);
  if (target) {
    const rect = target.getBoundingClientRect();
    card.style.top = (rect.bottom + 12) + "px";
    card.style.left = Math.max(16, rect.left) + "px";
  } else {
    card.style.top = "50%"; card.style.left = "50%"; card.style.transform = "translate(-50%, -50%)";
  }
  $("#tour-title").textContent = step.title;
  $("#tour-body").textContent = step.body;
  dots.innerHTML = TOUR_STEPS.map((_, i) => `<div class="tour-dot ${i===tourStep?"active":""}"></div>`).join("");
  backdrop.classList.add("open");
  overlay.classList.remove("hidden");
  card.classList.add("open");
  card.setAttribute("aria-hidden", "false");
  $("#tour-prev").style.visibility = tourStep === 0 ? "hidden" : "visible";
  $("#tour-next").textContent = tourStep === TOUR_STEPS.length - 1 ? "Finish" : "Next";
  if (target) { target.classList.add("tour-highlight"); } else {
    $$(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
  }
}
function endTour() {
  $("#tour-card")?.classList.remove("open");
  $("#tour-backdrop")?.classList.remove("open");
  $("#tour-overlay")?.classList.add("hidden");
  $$(".tour-highlight").forEach(el => el.classList.remove("tour-highlight"));
  localStorage.setItem(TOUR_KEY, "1");
  const btn = $("#tourbtn");
  if (btn) btn.style.display = "";
}
document.addEventListener("click", (e) => {
  const prev = e.target.closest("#tour-prev");
  const next = e.target.closest("#tour-next");
  const skip = e.target.closest("#tour-skip");
  const tourbtn = e.target.closest("#tourbtn");
  if (tourbtn) { e.preventDefault(); startTour(); return; }
  if (skip) { endTour(); return; }
  if (prev) { tourStep = Math.max(0, tourStep - 1); $$(".tour-highlight").forEach(el => el.classList.remove("tour-highlight")); renderTourStep(); return; }
  if (next) { tourStep = Math.min(TOUR_STEPS.length - 1, tourStep + 1); $$(".tour-highlight").forEach(el => el.classList.remove("tour-highlight")); renderTourStep(); if (tourStep === TOUR_STEPS.length - 1) endTour(); return; }
});
// auto-start tour for first-time users
setTimeout(() => { if (!localStorage.getItem(TOUR_KEY) && $("#tourbtn")) startTour(); }, 1500);

// ---------- (19) up/down sidebar nav ----------
document.addEventListener("keydown", e => {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const links = $$(".sidebar a"); const idx = links.findIndex(a => a.classList.contains("active"));
    if (idx < 0) return;
    const next = e.key === "ArrowDown" ? Math.min(idx + 1, links.length - 1) : Math.max(idx - 1, 0);
    if (next !== idx) { e.preventDefault(); links[next].click(); }
  }
});

// ---------- (20) mobile sidebar overlay ----------
function toggleMobileMenu() {
  const sidebar = $("#sidebar");
  const overlay = $("#sidebar-overlay");
  const btn = $("#menubtn");
  const isOpen = sidebar.classList.contains("open");
  if (isOpen) { closeMobileMenu(); } else {
    sidebar.classList.add("open");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    if (btn) { btn.setAttribute("aria-expanded", "true"); }
    sidebar.querySelector("a")?.focus();
  }
}
function closeMobileMenu() {
  const sidebar = $("#sidebar");
  const overlay = $("#sidebar-overlay");
  const btn = $("#menubtn");
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  if (btn) { btn.setAttribute("aria-expanded", "false"); }
}

// ---------- offline service worker ----------
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    reg.addEventListener("updatefound", () => toast("update available", "ok"));
  } catch (e) { console.warn("SW register failed", e); }
}
registerSW();

// ===================== SHELL =====================
// (12) sidebar collapse (persisted) + (20) mobile hamburger
function shell() {
  const theme = localStorage.getItem("forgeos-theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const collapsed = localStorage.getItem("forgeos-collapsed") === "1";
  const sidebar = NAV.map(([label, , p]) => `<a href="#/${p}" aria-label="${label}">${label}</a>`).join("");
  $("#app").innerHTML = `
    <a href="#main" class="sr-only" id="skip-link">Skip to content</a>
    <div class="navbar" role="banner">
      <button class="btn secondary" id="menubtn" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="sidebar">☰</button>
      <span class="wordmark">Forge<span class="os">OS</span> Console</span>
      <button class="btn secondary" id="cmdkbtn" aria-label="Open command palette">⌘K</button>
      <span class="spacer"></span>
      <span class="pill ok" aria-label="Brain status: owned"><span class="dot"></span> brain: owned</span>
      <button class="btn secondary" id="tourbtn" aria-label="Start onboarding tour" style="display:${localStorage.getItem('forgeos-tour-done') ? '' : 'none'}">Tour</button>
    </div>
    <div class="layout ${collapsed ? "collapsed" : ""}" id="layout">
      <div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>
      <aside class="sidebar" id="sidebar" role="navigation" aria-label="Main navigation">${sidebar}</aside>
      <main class="main" id="main" role="main" aria-live="polite" aria-label="Main content"></main>
    </div>
    <div class="breadcrumb" id="crumb" role="navigation" aria-label="Breadcrumb"></div>
    <div class="toasts" id="toasts" role="status" aria-live="assertive" aria-atomic="true"></div>
    <div class="cmdk" id="cmdk" role="dialog" aria-modal="true" aria-label="Command palette"><input placeholder="Jump to… (↑↓ enter)" aria-label="Search commands"/><ul></ul></div>
    <div class="tour-overlay" id="tour-overlay" aria-hidden="true"></div>
    <div class="tour-backdrop" id="tour-backdrop"></div>
    <div class="tour-card" id="tour-card" role="dialog" aria-modal="true" aria-label="Onboarding tour">
      <div class="tour-dots" id="tour-dots"></div>
      <h2 id="tour-title"></h2>
      <p id="tour-body"></p>
      <div class="tour-actions">
        <button class="btn secondary" id="tour-skip">Skip</button>
        <div class="row">
          <button class="btn secondary" id="tour-prev">Back</button>
          <button class="btn primary" id="tour-next">Next</button>
        </div>
      </div>
    </div>`;
  $("#cmdkbtn").addEventListener("click", openCmdk);
  $("#menubtn").addEventListener("click", toggleMobileMenu);
  $("#sidebar-overlay").addEventListener("click", closeMobileMenu);
  window.addEventListener("hashchange", () => { closeMobileMenu(); route(); });
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeMobileMenu(); });
  // (2) boot self-check
  if (!$("#app").children.length) $("#main").innerHTML = empty("Failed to load shell.");
  route();
}
shell();

// ---------- Keyboard shortcuts cheatsheet ----------
function renderShortcuts() {
  const el = document.createElement('div');
  el.id = 'shortcuts-overlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:200;';
  el.innerHTML = `
    <div class="card" style="max-width:520px;width:90%;max-height:80vh;overflow:auto;">
      <h2>Keyboard Shortcuts</h2>
      <table class="table" style="margin-top:8px;">
        <tr><th>Shortcut</th><th>Action</th></tr>
        <tr><td class="mono">?</td><td>Show this cheatsheet</td></tr>
        <tr><td class="mono">Cmd/Ctrl + K</td><td>Command palette</td></tr>
        <tr><td class="mono">Cmd/Ctrl + /</td><td>Focus search</td></tr>
        <tr><td class="mono">Esc</td><td>Close modal / palette</td></tr>
        <tr><td class="mono">1-9</td><td>Jump to nav item</td></tr>
      </table>
      <div style="margin-top:12px;text-align:right;"><button class="btn secondary" id="close-shortcuts">Close</button></div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.id === 'close-shortcuts') el.remove(); });
}
document.addEventListener('keydown', (e) => {
  if (e.key === '?' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); renderShortcuts(); }
});

// ---------- Column visibility toggles ----------
function columnToggle(headerEl, tableEl) {
  const cols = Array.from(headerEl.querySelectorAll('th'));
  const menu = document.createElement('div');
  menu.className = 'card';
  menu.style.cssText = 'position:absolute;top:100%;right:0;z-index:50;min-width:180px;padding:8px;';
  cols.forEach((th, i) => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = true;
    cb.addEventListener('change', () => { tableEl.querySelectorAll('tr').forEach(r => r.children[i].style.display = cb.checked ? '' : 'none'); });
    label.appendChild(cb); label.appendChild(document.createTextNode(th.textContent));
    menu.appendChild(label);
  });
  headerEl.style.position = 'relative';
  headerEl.appendChild(menu);
  document.addEventListener('click', (e) => { if (!headerEl.contains(e.target)) menu.remove(); }, { once: true });
}

// ---------- Bulk actions for vault/audit ----------
function bulkActions(containerId, rowSelector) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const bar = document.createElement('div');
  bar.className = 'card';
  bar.style.cssText = 'margin-bottom:8px;padding:8px;display:flex;gap:8px;align-items:center;';
  const selectAll = document.createElement('input'); selectAll.type = 'checkbox'; selectAll.id = containerId + '-all';
  const label = document.createElement('span'); label.textContent = 'Select all'; label.className = 'muted';
  const delBtn = document.createElement('button'); delBtn.className = 'btn danger'; delBtn.textContent = 'Delete selected';
  bar.append(selectAll, label, delBtn);
  container.insertBefore(bar, container.firstChild);
  selectAll.addEventListener('change', () => {
    container.querySelectorAll(rowSelector + ' input[type=checkbox]').forEach(cb => cb.checked = selectAll.checked);
  });
  delBtn.addEventListener('click', () => {
    const checked = container.querySelectorAll(rowSelector + ' input[type=checkbox]:checked');
    if (!checked.length) return;
    if (!confirm('Delete ' + checked.length + ' items?')) return;
    checked.forEach(cb => cb.closest(rowSelector).remove());
    bar.remove();
  });
  container.querySelectorAll(rowSelector).forEach(row => {
    const cb = document.createElement('input'); cb.type = 'checkbox';
    row.insertBefore(cb, row.firstChild);
  });
}

// ---------- Confirmation modal helper ----------

// ---------- Column visibility toggles ----------

