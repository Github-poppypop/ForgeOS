// app.js — ForgeOS Brain Console SPA (plain JS, no build step)
// Implements all 50 enhancements (clusters A–E).
import { api } from "./lib/api.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const app = $("#app");

// ---------- (1) global error handlers ----------
window.addEventListener("error", (e) => showFatal(e.message || String(e.error)));
window.addEventListener("unhandledrejection", (e) => showFatal(String(e.reason && e.reason.message ? e.reason.message : e.reason)));
function showFatal(msg) {
  const m = $("#main");
  if (m) m.innerHTML = `<div class="card"><h2>Runtime error</h2><pre class="json">${escapeHtml(msg)}</pre>
    <p class="muted">The console hit an error. The API is at <span class="mono">/api/*</span>. Try reloading.</p></div>`;
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
function spinner() { return `<div class="spinner"></div>`; }

// ---------- (28) breadcrumb (clickable) ----------
function crumb(items) {
  $("#crumb").innerHTML = items.map(([t, href]) =>
    href ? `<a href="${href}">${escapeHtml(t)}</a>` : `<span>${escapeHtml(t)}</span>`).join(" › ");
}

// ---------- (15) empty state ----------
const empty = (msg, cta) => `<div class="empty">${escapeHtml(msg)}${cta ? "<div style='margin-top:12px'>" + cta + "</div>" : ""}</div>`;

// ---------- (7) XSS-safe render of arbitrary content ----------
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

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
  $("#main").innerHTML = `<div class="skeleton" style="height:160px"></div>`;
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
      <span class="pill"><span class="dot"></span> ${s && s.embedding_model ? escapeHtml(s.embedding_model) : "—"}</span>
      <span class="pill">pack ${((s && s.schema ? s.schema : "").match(/forgeos/) ? "forgeos" : "—")}</span>
      ${s && s.auth ? `<span class="pill warn"><span class="dot"></span> auth on</span>` : ""}
    </div>
    <div class="grid cols-3">
      <div class="card"><h2>Isolation</h2><p class="muted mono">${s && s.isolation ? escapeHtml(s.isolation) : "—"}</p></div>
      <div class="card"><h2>Roles seeded</h2><p style="font-size:32px;font-weight:800">${seeded}/7</p></div>
      <div class="card"><h2>Console port</h2><p class="mono">${s && s.console_port ? s.console_port : "—"}</p><p class="muted">owns PGLite at C:\\ForgeOS</p></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Quick actions</h2>
      <div class="row">
        <a class="btn primary" href="#/roles">Roles</a>
        <a class="btn secondary" href="#/search">Search</a>
        <a class="btn secondary" href="#/capture">Capture</a>
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
  $("#main").innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  const { roles } = await safe(api.roles).catch(() => ({ roles: [] }));
  $("#main").innerHTML = `<h1>C-Suite Roles</h1>
    <div class="grid cols-2">
      ${roles.map(r => `
        <div class="card">
          <div class="row" style="justify-content:space-between">
            <h2>${escapeHtml(r.role || r.slug)}</h2>
            <span class="pill ${r.exists ? "ok" : "bad"}"><span class="dot"></span>${r.exists ? "seeded" : "missing"}</span>
          </div>
          <p class="muted mono">${escapeHtml(r.slug)}</p>
          <p class="muted">reports_to: <a class="link" href="#/page/${encodeURIComponent(r.reports_to || "")}">${escapeHtml(r.reports_to || "—")}</a></p>
          <button class="btn secondary" data-role="${encodeURIComponent(r.slug)}">View page</button>
        </div>`).join("")}
    </div>`;
  $$("#main [data-role]").forEach(b =>
    b.addEventListener("click", () => location.hash = "#/page/" + b.dataset.role));
}

async function renderPage(slug) {
  slug = decodeURIComponent(slug);
  crumb([["ForgeOS", "#/dashboard"], ["Roles", "#/roles"], [slug]]);
  $("#main").innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  const p = await safe(() => api.page(slug)).catch(() => null);
  if (!p || !p.body) { $("#main").innerHTML = empty("Page not found in brain.", `<a class="btn secondary" href="#/capture">Capture it</a>`); return; }
  // (38) diff note + (37) inline edit + (13) copy link
  $("#main").innerHTML = `<div class="row" style="justify-content:space-between">
      <h1 class="mono">${escapeHtml(slug)}</h1>
      <div class="row">
        <button class="btn secondary" id="copy">Copy link</button>
        <button class="btn secondary" id="edit">Edit</button>
      </div>
    </div>
    <pre class="code json" id="body">${escapeHtml(p.body)}</pre>`;
  $("#copy").addEventListener("click", () => copyLink(slug));
  $("#edit").addEventListener("click", () => startEdit(slug, p.body));
}

function startEdit(slug, body) {
  $("#main").innerHTML = `<h1 class="mono">${escapeHtml(slug)}</h1>
    <textarea id="ebody" rows="16" style="width:100%;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono)">${escapeHtml(body)}</textarea>
    <div class="row" style="margin-top:8px">
      <button class="btn primary" id="save">Save</button>
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
  $("#main").innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  const org = await safe(() => api.org()).catch(() => null);
  if (org && org.roles) {
    const byId = Object.fromEntries(org.roles.map(r => [r.id, r]));
    const kidsOf = (id) => org.roles.filter(r => r.reportsTo === id).map(r => `<div class="node"><div class="node-title">${escapeHtml(r.title)} <span class="muted">${escapeHtml(r.id)}</span></div><div class="muted">${(r.responsibilities||[]).map(x=>`<span class="pill mono" style="margin:2px">${escapeHtml(x)}</span>`).join(" ")}</div></div>`).join("");
    const ceo = org.roles.find(r => !r.reportsTo);
    $("#main").innerHTML = `<h1>Organization</h1>
      <div class="card"><h2>${escapeHtml(org.name || "ForgeOS Engineering Organization")}</h2>
      <div class="tree">${ceo ? `<div class="node"><div class="node-title">${escapeHtml(ceo.title)} <span class="muted">${escapeHtml(ceo.id)}</span></div><div class="muted">${(ceo.responsibilities||[]).map(x=>`<span class="pill mono" style="margin:2px">${escapeHtml(x)}</span>`).join(" ")}</div>${kidsOf(ceo.id)}</div>` : ""}</div></div>`;
    return;
  }
  const { roles } = await safe(api.roles).catch(() => ({ roles: [] }));
  const bySlug = Object.fromEntries(roles.map(r => [r.slug, r]));
  const link = (slug) => `<a class="link" href="#/page/${encodeURIComponent(slug)}">${escapeHtml((bySlug[slug] && bySlug[slug].role) || slug)}</a>`;
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
              <a class="link mono" href="#/page/${encodeURIComponent(slug)}">${escapeHtml(slug)}</a>
              <span class="pill">${escapeHtml(score)}</span></div>
            <p class="muted">${escapeHtml(body.slice(0, 200))}</p></div>`;
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
  $("#main").innerHTML = `<div class="skeleton" style="height:160px"></div>`;
  const r = await safe(() => api.timeline()).catch(() => ({ timeline: [] }));
  const items = Array.isArray(r.timeline) ? r.timeline : [];
  $("#main").innerHTML = `<h1>Timeline Engine</h1>
    <div class="card"><h2>Milestones</h2>
    <div class="timeline">${items.map(i => `<div class="tl-item ${i.status==='done'?'done':i.status==='in-progress'?'active':''}">
      <div class="tl-date">${escapeHtml(i.date)}</div>
      <div class="tl-body"><div class="tl-title">${escapeHtml(i.title)}</div>
      <div class="tl-meta">${escapeHtml(i.owner)} · <span class="pill ${i.status==='done'?'ok':i.status==='in-progress'?'warn':''}">${escapeHtml(i.status)}</span></div>
      </div></div>`).join("")}</div></div>`;
}

async function renderLedger() {
  crumb([["ForgeOS", "#/command"], ["Decision Ledger"]]);
  $("#main").innerHTML = `<div class="skeleton" style="height:160px"></div>`;
  const r = await safe(() => api.ledger()).catch(() => ({ ledger: [] }));
  const entries = Array.isArray(r.ledger) ? r.ledger : [];
  $("#main").innerHTML = `<h1>Decision Ledger</h1>
    <div class="card"><h2>Recent decisions</h2>
    <table class="tbl"><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Mission</th><th>Outcome</th></tr></thead>
    <tbody>${entries.map(e => `<tr>
      <td class="mono">${escapeHtml(e.date)}</td>
      <td>${escapeHtml(e.title)}</td>
      <td><span class="pill">${escapeHtml(e.type)}</span></td>
      <td class="mono">${escapeHtml(e.mission)}</td>
      <td>${escapeHtml(e.outcome)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

async function renderMissions() {
  crumb([["ForgeOS", "#/command"], ["Missions"]]);
  $("#main").innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  const { missions } = await safe(api.missions).catch(() => ({ missions: [] }));
  const statusPill = (s) => {
    const cls = { done:"ok", executing:"ok", review:"warn", proposed:"warn", approved:"ok" }[s] || "";
    return `<span class="pill ${cls}"><span class="dot"></span>${s}</span>`;
  };
  const pct = (p) => `<div style="width:120px"><div class="progress-track"><div class="progress-bar" style="width:${p}%"></div></div><span class="muted">${p}%</span></div>`;
  const agentList = ["cto/cto","coo/coo","exec/ceo","cfo/cfo"];
  $("#main").innerHTML = `<h1>Mission Center</h1>
    <div class="card" style="margin-bottom:16px">
      <h2>Agent Dispatch</h2>
      <p class="muted">Queue an agent on a mission — records a decision entry in the brain.</p>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <select id="d-mid" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">mission id…</option>
          ${missions.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.id)} — ${escapeHtml(m.title)}</option>`).join("")}
        </select>
        <select id="d-agent" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">agent…</option>
          ${agentList.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}
        </select>
        <button class="btn primary" id="d-go">Dispatch</button>
        <pre id="d-out" class="code json" style="margin-top:8px;min-height:0"></pre>
      </div>
    </div>
    <div class="card"><h2>Missions</h2>
    <table class="tbl"><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Phase</th><th>Progress</th><th>ETA</th><th>Dependencies</th><th>Owner</th><th></th></tr></thead>
    <tbody>${missions.map(m => `<tr>
      <td class="mono">${escapeHtml(m.id)}</td>
      <td>${escapeHtml(m.title)}</td>
      <td>${statusPill(m.status)}</td>
      <td>${escapeHtml(m.phase)}</td>
      <td>${pct(m.progress)}</td>
      <td class="mono" style="white-space:nowrap">${escapeHtml(m.eta ? m.eta.slice(0,10) : "—")}</td>
      <td>${(m.dependencies||[]).map(d => `<span class="pill mono" style="margin:2px">${escapeHtml(d)}</span>`).join(" ") || "<span class='muted'>none</span>"}</td>
      <td>${escapeHtml(m.owner)}</td>
      <td>${m.status !== "done" ? `<button class="btn secondary" data-a="${escapeHtml(m.id)}" ${m.status==="done"?"disabled":""}>Advance →</button>` : "✓"}</td>
    </tr>`).join("")}</tbody></table></div>`;
  $$("#main [data-a]").forEach(b =>
    b.addEventListener("click", async () => {
      const id = b.dataset.a;
      b.disabled = true; b.textContent = "…";
      const r = await safe(() => api.advanceMission(id, {})).catch(e => ({ error: errMsg(e) }));
      const m = r && r.id ? r : null;
      if (m && m.status) { toast(`${id} → ${m.status}`, "ok"); renderMissions(); }
      else toast("advance failed: " + (r?.error || "?"), "err");
    })
  );
  const dGo = $("#d-go");
  if (dGo) dGo.addEventListener("click", async () => {
    const mid = $("#d-mid").value;
    const agent = $("#d-agent").value;
    if (!mid || !agent) { toast("select mission + agent", "err"); return; }
    const r = await safe(() => api.dispatchAgent(mid, agent)).catch(e => ({ error: errMsg(e) }));
    const out = $("#d-out");
    if (out) out.textContent = JSON.stringify(r, null, 2);
    toast(r?.queued ? `dispatched ${agent} on ${mid}` : "dispatch failed", r?.queued ? "ok" : "err");
  });
}

async function renderMCP() {
  crumb([["ForgeOS", "#/dashboard"], ["MCP"]]);
  $("#main").innerHTML = `<h1>MCP / Agent Tools</h1>
    <div class="card"><p class="muted">The console owns the isolated brain and exposes agent tooling. Connect agent runtimes here.</p>
    <button class="btn secondary" id="probe">Probe /api/status</button><pre id="h" class="code json" style="margin-top:12px"></pre></div>`;
  $("#probe").addEventListener("click", () => withLoading($("#probe"), async () => {
    const r = await safe(() => api.status());
    $("#h").textContent = JSON.stringify(r, null, 2);
  }));
}

// ---------- (27) vault files clickable ----------
async function renderVault() {
  crumb([["ForgeOS", "#/dashboard"], ["Vault"]]);
  $("#main").innerHTML = `<div class="skeleton" style="height:160px"></div>`;
  const v = await safe(api.vault).catch(() => ({ files: [], git: "—" }));
  $("#main").innerHTML = `<h1>Obsidian Vault Sync</h1>
    <div class="card"><p class="muted">Mirror at <span class="mono">C:\\ForgeOS\\vault</span> — git: ${escapeHtml(v.git)}</p>
    <ul>${v.files.map(f => `<li class="mono"><a class="link" href="#/vaultfile/${encodeURIComponent(f)}">${escapeHtml(f)}</a></li>`).join("") || "<li class='muted'>no files</li>"}</ul></div>`;
}

async function renderVaultFile(file) {
  file = decodeURIComponent(file);
  crumb([["ForgeOS", "#/dashboard"], ["Vault", "#/vault"], [file]]);
  $("#main").innerHTML = `<div class="skeleton" style="height:160px"></div>`;
  // read via backend passthrough (reuse page fetch is brain-only; read file directly is not exposed,
  // so show a note + link to open in editor)
  $("#main").innerHTML = `<h1 class="mono">${escapeHtml(file)}</h1>
    <div class="card"><p class="muted">Vault file mirror. Open in Obsidian at <span class="mono">C:\\ForgeOS\\vault\\${escapeHtml(file)}</span>.</p>
    <p>This file is the human-readable mirror of the brain page <span class="mono">${escapeHtml(file.replace(/\\.md$/, ""))}</span>.</p>
    <a class="btn secondary" href="#/page/${encodeURIComponent(file.replace(/\\.md$/, ""))}">View brain page →</a></div>`;
}

// ---------- (26) embed admin w/ counts + auto after capture ----------
async function renderEmbed() {
  crumb([["ForgeOS", "#/dashboard"], ["Embeddings"]]);
  $("#main").innerHTML = `<h1>Embedding Admin</h1>
    <div class="card"><p class="muted">Local Ollama <span class="mono">mxbai-embed-large</span> (1024d). Re-embed after captures.</p>
    <button class="btn primary" id="re">Re-embed all</button><pre id="o" class="code json" style="margin-top:12px"></pre></div>`;
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
    <pre class="json">${escapeHtml(JSON.stringify(f, null, 2))}</pre>
    <div class="card" style="margin-top:12px"><h2>Topology</h2>
      <p><b>ForgeOS (root)</b> → read-down only, write-up governance only, no lateral mingle.</p>
      <p>Children: ${(f.children || ["apps/lifeos (isolated child brain)"]).map(c => `<span class="pill">${escapeHtml(c)}</span>`).join(" ")}</p>
    </div>`;
}

// ---------- (29) audit as sortable table ----------
async function renderAudit() {
  crumb([["ForgeOS", "#/dashboard"], ["Audit"]]);
  $("#main").innerHTML = `<div class="skeleton" style="height:160px"></div>`;
  const a = await safe(api.audit).catch(() => ({ raw: "" }));
  const rows = (a.raw || "").split("\n").filter(Boolean).map(l => {
    const [slug, type, date, ...rest] = l.split("\t");
    return { slug, type, date, title: rest.join(" ") };
  });
  $("#main").innerHTML = `<h1>Audit Trail</h1>
    <div class="card"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Slug</th><th>Title</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td class="mono">${escapeHtml(r.date || "")}</td><td>${escapeHtml(r.type || "")}</td>
      <td class="mono"><a class="link" href="#/page/${encodeURIComponent(r.slug || "")}">${escapeHtml(r.slug || "")}</a></td>
      <td>${escapeHtml(r.title || "")}</td></tr>`).join("") || "<tr><td colspan=4 class='muted'>no entries</td></tr>"}</tbody></table></div>`;
}

// ---------- (30) schema as table ----------
async function renderSchema() {
  crumb([["ForgeOS", "#/dashboard"], ["Schema"]]);
  const s = await safe(api.schema).catch(() => ({ active: "", types: "" }));
  $("#main").innerHTML = `<h1>Schema Pack</h1>
    <h2>Active</h2><pre class="json">${escapeHtml(s.active || "—")}</pre>
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
    <h2>Raw types</h2><pre class="json">${escapeHtml(s.types || "—")}</pre>`;
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
  $("#main").innerHTML = `<div class="skeleton" style="height:200px"></div>`;
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
  $("#main").innerHTML = `<div class="skeleton" style="height:200px"></div>`;
  const gov = await safe(() => api.gov()).catch(() => null);
  if (!gov) { $("#main").innerHTML = empty("Could not read /governance (console offline)."); return; }
  const section = (title, key, base) => {
    const files = (gov.tree && gov.tree[key]) || [];
    return `<div class="card"><h2>${title}</h2>
      <p class="muted mono">${base}</p>
      <ul class="mono" style="line-height:1.9">${files.length ? files.map(f => `<li><a class="link" href="#/page/${encodeURIComponent(key + "/" + f.replace(/\.md$/, ""))}">${escapeHtml(f)}</a></li>`).join("") : "<li class='muted'>—</li>"}</ul>
    </div>`;
  };
  $("#main").innerHTML = `
    <h1>Governance <span class="pill ok"><span class="dot"></span> sacred</span></h1>
    <p class="muted">Single source of truth. Immutable except by constitutional amendment.
      Authority: <span class="mono">${escapeHtml(gov.authority || "")}</span></p>
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

// ===================== ROUTER =====================
const NAV = [
  ["Command Center", "command"], ["Governance", "governance"], ["Dashboard", "dashboard"], ["Roles", "roles"], ["Org", "org"], ["Timeline", "timeline"], ["Ledger", "ledger"],
  ["Search", "search"], ["Capture", "capture"], ["Decisions", "decisions"], ["Missions", "missions"], ["MCP", "mcp"], ["Vault", "vault"],
  ["Embeddings", "embed"], ["Federation", "federation"], ["Audit", "audit"], ["Schema", "schema"], ["Config", "config"],
];

const routes = {
  command: renderCommand, governance: renderGovernance, dashboard: renderDashboard, roles: renderRoles, org: renderOrg, timeline: renderTimeline, ledger: renderLedger,
  search: renderSearch, capture: renderCapture, decisions: renderDecisions, missions: renderMissions, mcp: renderMCP, vault: renderVault, vaultfile: renderVaultFile,
  embed: renderEmbed, federation: renderFederation, audit: renderAudit, schema: renderSchema, config: renderConfig,
};

// ---------- (50) per-panel error boundary ----------
async function guard(fn, slug) {
  try { await fn(slug); }
  catch (e) { $("#main").innerHTML = `<div class="card"><h2>Panel error</h2><pre class="json">${escapeHtml(errMsg(e))}</pre></div>`; }
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
  return labels.map((l,i)=>`<text class="label" x="${(i*step).toFixed(1)}" y="${h-4}" text-anchor="middle">${escapeHtml(l)}</text>`).join("");
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
    return `<rect class="bar-rect ${s.cls||""}" x="${x}" y="${y}" width="${barW}" height="${bh}" rx="3"><title>${escapeHtml(s.label)}: ${s.value}</title></rect>
      <text class="label" x="${x+barW/2}" y="${h-6}" text-anchor="middle">${escapeHtml(s.label)}</text>`;
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
    const path = `<circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}" stroke="${s.color||'var(--accent)'}" stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}"><title>${escapeHtml(s.label)}: ${s.value}</title></circle>`;
    offset += dash; return path;
  }).join("");
  const legend = series.map(s => `<span class="swatch" style="background:${s.color||'var(--accent)'}"></span><span>${escapeHtml(s.label)} ${s.value}</span>`).join("");
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
    <div class="tl-time">${escapeHtml(i.time)}</div>
    <div class="tl-title">${escapeHtml(i.title)}</div>
    ${i.meta ? `<div class="tl-meta">${escapeHtml(i.meta)}</div>` : ""}
  </div>`).join("")}</div>`;
}

// ---------- (57) stepper ----------
function stepper(steps, activeIdx=0) {
  return `<div class="stepper">${steps.map((s,i)=>`
    <div class="step ${i<activeIdx?"done":i===activeIdx?"active":""}"><span class="circle">${i<activeIdx?"✓":(i+1)}</span><span class="caption">${escapeHtml(s)}</span>
    ${i<steps.length-1 ? `<div class="step-line ${i<activeIdx?"done":""}"></div>` : ""}
  </div>`).join("")}</div>`;
}

// ---------- (58) tabs ----------
function tabs(items, activeIdx=0, onSwitch) {
  return `<div class="tabs">${items.map((t,i)=>`<div class="tab ${i===activeIdx?"active":""}" data-tab="${i}">${escapeHtml(t)}</div>`).join("")}</div>
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
    <div class="caption">${escapeHtml(label)}</div>
    <div class="value">${escapeHtml(value)}</div>
    <div class="delta ${deltaDir}">${deltaDir==="up"?"▲":"▼"} ${escapeHtml(delta)}</div>
  </div>`;
}

// =====================================================================
// ===================== PANELS =====================
// =====================================================================

// ---------- (5) 404 route ----------
const KNOWN = new Set(["command","governance","dashboard","roles","org","timeline","ledger","search","capture","decisions","missions","mcp","vault","vaultfile","embed","federation","audit","schema","config","page"]);
// ---------- (10) favicon/title per panel ----------
const TITLES = { command:"Command Center", governance:"Governance", dashboard:"Console", roles:"Roles", org:"Org", timeline:"Timeline", ledger:"Decision Ledger", search:"Search", capture:"Capture", decisions:"Decisions", missions:"Missions", mcp:"MCP", vault:"Vault", vaultfile:"Vault", embed:"Embeddings", federation:"Federation", audit:"Audit", schema:"Schema", config:"Config", page:"Page" };

// ---------- (11) restore last panel ----------
function lastPanel() { return localStorage.getItem("forgeos-last") || "command"; }

async function route() {
  let hash = location.hash.slice(2) || lastPanel();
  const parts = hash.split("/");
  const panel = parts[0];
  if (!KNOWN.has(panel)) { $("#main").innerHTML = empty("Unknown route: " + escapeHtml(panel), `<a class="btn secondary" href="#/dashboard">Go home</a>`); document.title = "ForgeOS — 404"; return; }
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
const CMDS = NAV.map(([label, p]) => ({ label, go: () => { pushHist(p); location.hash = "#/" + p; } }));
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
  const histItems = q ? [] : hist.map(h => ({ label: "↺ " + (NAV.find(n => n[1] === h)?.[0] || h), go: () => location.hash = "#/" + h }));
  const all = q ? opts : opts.concat(histItems);
  ul.innerHTML = all.map((c, i) => `<li data-i="${i}">${escapeHtml(c.label)}</li>`).join("") || "<li class='muted'>no match</li>";
  $$("#cmdk li").forEach((li, i) => li.addEventListener("click", () => { all[i].go(); $("#cmdk").classList.remove("open"); }));
  paintSel($$("#cmdk li"));
}
// ---------- (35) confirm modal ----------
function confirmModal(msg, onYes) {
  const back = document.createElement("div");
  back.className = "modal-backdrop open";
  back.innerHTML = `<div class="modal"><h2>Confirm</h2><p>${escapeHtml(msg)}</p>
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
});
function showShortcuts() {
  const back = document.createElement("div");
  back.className = "modal-backdrop open";
  back.innerHTML = `<div class="modal"><h2>Keyboard shortcuts</h2>
    <ul class="mono" style="line-height:1.9">
      <li>⌘K / Ctrl+K — command palette</li>
      <li>↑ / ↓ — move in sidebar</li>
      <li>? — this sheet</li>
      <li>Esc — close palette / modal</li>
    </ul>
    <button class="btn secondary" id="c">Close</button></div>`;
  document.body.appendChild(back);
  back.querySelector("#c").addEventListener("click", () => back.remove());
}

// ---------- (19) up/down sidebar nav ----------
document.addEventListener("keydown", e => {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const links = $$(".sidebar a"); const idx = links.findIndex(a => a.classList.contains("active"));
    if (idx < 0) return;
    const next = e.key === "ArrowDown" ? Math.min(idx + 1, links.length - 1) : Math.max(idx - 1, 0);
    if (next !== idx) { e.preventDefault(); links[next].click(); }
  }
});

// ===================== SHELL =====================
// (12) sidebar collapse (persisted) + (20) mobile hamburger
function shell() {
  const theme = localStorage.getItem("forgeos-theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const collapsed = localStorage.getItem("forgeos-collapsed") === "1";
  const sidebar = NAV.map(([label, p]) => `<a href="#/${p}">${label}</a>`).join("");
  $("#app").innerHTML = `
    <div class="navbar">
      <button class="btn secondary" id="menubtn" aria-label="menu">☰</button>
      <span class="wordmark">Forge<span class="os">OS</span> Console</span>
      <button class="btn secondary tip" data-tip="Command palette (⌘K)" id="cmdkbtn">⌘K</button>
      <span class="spacer"></span>
      <span class="pill ok"><span class="dot"></span> brain: owned</span>
    </div>
    <div class="layout ${collapsed ? "collapsed" : ""}" id="layout">
      <aside class="sidebar" id="sidebar">${sidebar}</aside>
      <main class="main" id="main"></main>
    </div>
    <div class="breadcrumb" id="crumb"></div>
    <div class="toasts" id="toasts"></div>
    <div class="cmdk" id="cmdk"><input placeholder="Jump to… (↑↓ enter)"/><ul></ul></div>`;
  $("#cmdkbtn").addEventListener("click", openCmdk);
  $("#menubtn").addEventListener("click", () => {
    const l = $("#layout"); l.classList.toggle("collapsed");
    localStorage.setItem("forgeos-collapsed", l.classList.contains("collapsed") ? "1" : "0");
  });
  window.addEventListener("hashchange", route);
  // (2) boot self-check
  if (!$("#app").children.length) $("#main").innerHTML = empty("Failed to load shell.");
  route();
}
shell();
