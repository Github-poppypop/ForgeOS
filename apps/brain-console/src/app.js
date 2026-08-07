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

function emptyState(title, hint='', cta=''){
  return `<div class="card empty-state" style="text-align:center;padding:32px;"><div style="font-size:48px;margin-bottom:8px;">${title ? '📭' : '✅'}</div><h3>${DOMPurify.sanitize(title)}</h3>${hint ? `<p class="muted">${DOMPurify.sanitize(hint)}</p>` : ''}${cta ? `<div style="margin-top:12px">${cta}</div>` : ''}</div>`;
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

const SHORTCUTS = [
  ["?", "Shortcuts", "Toggle this help"],
  ["d", "Dashboard", "Go to dashboard"],
  ["r", "Roles", "Go to roles"],
  ["s", "Search", "Go to search"],
  ["c", "Capture", "Go to capture"],
  ["Esc", "Close", "Close modal / clear selection"],
];

function showShortcuts() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:200;';
  el.innerHTML = `<div class="card" style="max-width:520px;width:92vw">
    <h3>Keyboard shortcuts</h3>
    <table class="tbl" style="margin-top:12px">
      <thead><tr><th>Key</th><th>Action</th></tr></thead>
      <tbody>${SHORTCUTS.map(([k,a,d]) => `<tr><td class="mono" style="width:120px"><span class="kbd">${k}</span></td><td><div>${a}</div><div class="muted" style="font-size:12px">${d}</div></td></tr>`).join('')}</tbody>
    </table>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn secondary" id="close-shortcuts">Close</button></div>
  </div>`;
  document.body.appendChild(el);
  el.querySelector('#close-shortcuts').addEventListener('click', () => el.remove());
}

function bindShortcuts() {
  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (isInput) return;
    const key = ev.key === ' ' ? 'Space' : ev.key;
    if (key === '?') { ev.preventDefault(); showShortcuts(); return; }
    if (key === 'Escape') { document.querySelectorAll('[style*="position:fixed"][style*="z-index:200"]').forEach(el => el.remove()); return; }
    if (key === 'd') { ev.preventDefault(); location.hash = '#/dashboard'; }
    if (key === 'r') { ev.preventDefault(); location.hash = '#/roles'; }
    if (key === 's') { ev.preventDefault(); location.hash = '#/search'; }
    if (key === 'c') { ev.preventDefault(); location.hash = '#/capture'; }
  });
}

bindShortcuts();

const THEME_PREFIX = "forgeos-theme-";
function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove("theme-system", "theme-dark", "theme-light", "theme-hc", "theme-midnight", "theme-solarized-light", "theme-retro", "theme-matrix", "theme-ocean", "theme-berry", "theme-graphite");
  if (!theme || theme === "system") {
    root.dataset.theme = "auto";
    applySystemTheme();
    return;
  }
  root.dataset.theme = theme;
}
function applySystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(mq.matches ? 'theme-dark' : 'theme-light');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (document.documentElement.dataset.theme === 'auto' || !document.documentElement.dataset.theme) {
    applySystemTheme();
  }
});

function applyContrast(contrast) {
  const root = document.documentElement;
  root.classList.remove("contrast-default", "contrast-high", "contrast-soft");
  if (contrast) root.classList.add("contrast-" + contrast);
}

// ---------- (1) global error handlers ----------
async function logClientError(err, extra = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    route: location.hash || "/",
    userAgent: navigator.userAgent,
    message: err && err.message ? err.message : String(err),
    stack: err && err.stack ? err.stack : undefined,
    ...extra,
  };
  try {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch { /* swallow audit failures */ }
}
window.addEventListener("error", (e) => {
  const err = e.error instanceof Error ? e.error : new Error(e.message);
  logClientError(err, { type: "runtime-error" });
  showFatal(err);
});
window.addEventListener("unhandledrejection", (e) => {
  const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
  logClientError(err, { type: "unhandled-rejection" });
  showFatal(err);
});
function showFatal(err) {
  function showFatal(msg) {
    errorBoundary(msg, null);
  }

  function errorBoundary(msg, retryFn) {
    const m = $("#main");
    if (!m) return;
    m.innerHTML = `<div class="error-boundary">
      <div class="error-boundary-icon">⚠️</div>
      <h2>Panel error</h2>
      <p class="muted">This panel hit an unexpected error. You can retry or go back.</p>
      <pre class="json error-boundary-msg">${DOMPurify.sanitize(msg)}</pre>
      <div class="row" style="justify-content:center;gap:8px;margin-top:16px">
        ${retryFn ? '<button class="btn primary" id="eb-retry">Retry</button>' : ''}
        <button class="btn secondary" id="eb-home">Go Home</button>
      </div>
    </div>`;
    const retryBtn = $("#eb-retry");
    if (retryBtn && retryFn) {
      retryBtn.addEventListener("click", async () => {
        m.innerHTML = skelGrid(3, 200);
        try { await retryFn(); }
        catch (e) { errorBoundary(errMsg(e), retryFn); }
      });
    }
    const homeBtn = $("#eb-home");
    if (homeBtn) {
      homeBtn.addEventListener("click", () => { location.hash = "#/dashboard"; });
    }
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
const empty = (msg, cta) => emptyState(msg, '', cta);

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
    ? `<span class="pill ok" data-tooltip="Core brain service is healthy"><span class="dot"></span> brain ok</span>`
    : `<span class="pill bad" data-tooltip="Core brain service is unreachable"><span class="dot"></span> brain down</span>`;
  const ollamaPill = s && s.ollama
    ? `<span class="pill ok" data-tooltip="Local LLM runtime available"><span class="dot"></span> ollama</span>`
    : `<span class="pill bad" data-tooltip="Local LLM runtime offline"><span class="dot"></span> ollama off</span>`;
  const seeded = (roles.roles || []).filter(r => r.exists).length;
  $("#main").innerHTML = `
    <h1>Brain Console</h1>
    <div class="row" style="margin-bottom:24px">
      ${healthPill} ${ollamaPill}
      <span class="pill" data-tooltip="Embedding model for semantic search"><span class="dot"></span> ${s && s.embedding_model ? DOMPurify.sanitize(s.embedding_model) : "—"}</span>
      <span class="pill" data-tooltip="Loaded knowledge pack">pack ${((s && s.schema ? s.schema : "").match(/forgeos/) ? "forgeos" : "—")}</span>
      ${s && s.auth ? `<span class="pill warn" data-tooltip="Authentication system is enabled"><span class="dot"></span> auth on</span>` : ""}
    </div>
    <div class="grid cols-3">
      <div class="card"><h2>Isolation</h2><p class="muted mono">${s && s.isolation ? DOMPurify.sanitize(s.isolation) : "—"}</p></div>
      <div class="card"><h2>Roles seeded</h2><p style="font-size:32px;font-weight:800">${seeded}/7</p></div>
      <div class="card"><h2>Console port</h2><p class="mono">${s && s.console_port ? s.console_port : "—"}</p><p class="muted">owns PGLite at C:\\ForgeOS</p></div>
      <div class="card" id="health-card"><h2>Health</h2><p class="muted">loading…</p></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Quick actions</h2>
      <div class="row">
        <a class="btn primary" href="#/roles">Roles</a>
        <button class="btn secondary" id="refresh-dashboard" data-tooltip="Reload dashboard data">Refresh</button>
        <a class="btn secondary" href="#/search" data-tooltip="Search across all brains">Search</a>
        <a class="btn secondary" href="#/capture" data-tooltip="Create new brain page">Capture</a>
        <button class="btn secondary" id="copy-status" data-tooltip="Copy current status as JSON">Copy status</button>
        <a class="btn secondary" href="#/embed" data-tooltip="Re-embed all knowledge">Re-embed</a>
      </div>
    </div>
    <p class="muted" id="live" style="margin-top:12px">live: connecting… <span id="last-refreshed" data-tooltip="Time of last successful data fetch">(refreshed —)</span></p>`;

  const refreshBtn = $("#refresh-dashboard");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.classList.add("loading");
      await renderDashboard();
      toast("dashboard refreshed", "ok");
    });
  }

  const copyBtn = $("#copy-status");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        const status = await safe(() => api.status);
        await navigator.clipboard.writeText(JSON.stringify(status, null, 2));
        toast("status copied to clipboard", "ok");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    });
  }

  if (healthTimer) clearInterval(healthTimer);
  try {
    const useWs = window.WebSocket && location.protocol !== 'https:';
    if (useWs) {
      const ws = new WebSocket(`ws://${location.host}/api/health/stream`);
      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          const live = $("live");
          const lr = $("last-refreshed");
          if (live) {
            live.innerHTML = `live: ws ok @ ${new Date(d.ts).toLocaleTimeString()} <span id="last-refreshed" data-tooltip="Time of last successful data fetch">(refreshed ${new Date().toLocaleTimeString()})</span>`;
          }
        } catch {}
      };
      ws.onerror = () => {
        const live = $("live");
        if (live) {
          live.innerHTML = `live: (ws unavailable, fallback not available) <span id="last-refreshed" data-tooltip="Time of last successful data fetch">(refreshed ${new Date().toLocaleTimeString()})</span>`;
        }
      };
    } else {
      const es = new EventSource("/api/health/stream");
    es.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      const live = $("#live");
      const lr = $("#last-refreshed");
      if (live) {
        live.innerHTML = `live: ok @ ${new Date(d.ts).toLocaleTimeString()} <span id="last-refreshed" data-tooltip="Time of last successful data fetch">(refreshed ${new Date().toLocaleTimeString()})</span>`;
      }
    };
    es.onerror = () => {
      const live = $("#live");
      if (live) {
        live.innerHTML = `live: (polling unavailable) <span id="last-refreshed" data-tooltip="Time of last successful data fetch">(refreshed ${new Date().toLocaleTimeString()})</span>`;
      }
    };
  } catch {}
  const refreshHealth = async () => {
    const card = $("#health-card");
    if (!card) return;
    try {
      const data = await safe(() => api.get("/api/health/detailed")).catch(() => null);
      if (!data) { card.innerHTML = "<h2>Health</h2><p class='muted'>unavailable</p>"; return; }
      const recent = data.errors?.recent || [];
      card.innerHTML = `<h2>Health</h2>
        <p class="mono">uptime ${Math.round((data.uptime || 0) / 1000)}s</p>
        <p class="muted">last min: ${data.requests?.lastMinute ?? "-"} req / ${data.errors?.lastMinute ?? "-"} err</p>
        ${recent.length ? `<pre class="code json">${DOMPurify.sanitize(JSON.stringify(recent, null, 2))}</pre>` : "<p class='muted'>no recent errors</p>"}`;
      const lr = $("#last-refreshed");
      if (lr) lr.textContent = "(refreshed " + new Date().toLocaleTimeString() + ")";
    } catch {
      card.innerHTML = "<h2>Health</h2><p class='muted'>error loading health</p>";
    }
  };
  refreshHealth();
  healthTimer = setInterval(refreshHealth, 10000);
}

// ---------- (21) role explorer w/ clickable reports_to ----------
async function renderRoles() {
  crumb([["ForgeOS", "#/dashboard"], ["Roles"]]);
  $("#main").innerHTML = skelGrid(2);
  const { roles } = await safe(api.roles).catch(() => ({ roles: [] }));
  if (!roles.length) {
    $("#main").innerHTML = `<h1>C-Suite Roles</h1>` + emptyState("No roles seeded", "Seed C-suite roles to get started", '<a class="btn secondary" href="#/dashboard">Go to Dashboard</a>');
    return;
  }
  let currentRoles = roles;
  $("#main").innerHTML = `<h1>C-Suite Roles</h1>
    <div class="card">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <input type="search" id="role-search" placeholder="Search roles..." data-tooltip="Filter roles by name or slug" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:180px" />
          <select id="role-status-filter" data-tooltip="Filter by seeding status" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
            <option value="">All statuses</option>
            <option value="seeded">Seeded</option>
            <option value="missing">Missing</option>
          </select>
        </div>
        <div class="row" style="gap:8px">
          <span id="role-count" class="pill" data-tooltip="Total C-suite roles">0 roles</span>
          <button class="btn secondary" id="role-refresh" data-tooltip="Reload roles data">Refresh</button>
        </div>
      </div>
      <div id="role-grid" class="grid cols-2" style="margin-top:12px"></div>
    </div>`;
  const renderGrid = () => {
    const q = ($("#role-search")?.value || "").toLowerCase();
    const status = $("#role-status-filter")?.value || "";
    const filtered = currentRoles.filter((r) => {
      const matchesSearch = !q || (r.role || "").toLowerCase().includes(q) || (r.slug || "").toLowerCase().includes(q);
      const matchesStatus = !status || (r.exists ? "seeded" : "missing") === status;
      return matchesSearch && matchesStatus;
    });
    const countEl = $("#role-count");
    if (countEl) countEl.textContent = filtered.length + " role" + (filtered.length !== 1 ? "s" : "");
    const grid = $("#role-grid");
    if (!grid) return;
    if (!filtered.length) {
      grid.innerHTML = emptyState("No roles match", "Try a different filter or capture a new page", '<a class="btn secondary" href="#/capture">Go to Capture</a>');
      return;
    }
    grid.innerHTML = filtered.map(r => {
      const statusTip = r.exists ? "Role is seeded in the brain" : "Role page is missing from the brain";
      const reportsTip = r.reports_to ? "Manager this role reports to: " + r.reports_to : "This role has no manager";
      return `
        <div class="card">
          <div class="row" style="justify-content:space-between">
            <h2 data-tooltip="${DOMPurify.sanitize(r.role || r.slug)}">${DOMPurify.sanitize(r.role || r.slug)}</h2>
            <span class="pill ${r.exists ? "ok" : "bad"}" data-tooltip="${statusTip}"><span class="dot"></span>${r.exists ? "seeded" : "missing"}</span>
          </div>
          <p class="muted mono" data-tooltip="Role slug identifier">${DOMPurify.sanitize(r.slug)}</p>
          <p class="muted" data-tooltip="${reportsTip}">reports_to: <a class="link" href="#/page/${encodeURIComponent(r.reports_to || "")}">${DOMPurify.sanitize(r.reports_to || "—")}</a></p>
          <div class="row" style="gap:6px;margin-top:8px">
            <button class="btn primary sm" data-role="${encodeURIComponent(r.slug)}" data-tooltip="Open role page in brain">View page</button>
            <button class="btn secondary sm" data-copy-slug="${encodeURIComponent(r.slug)}" data-tooltip="Copy role slug to clipboard">Copy slug</button>
            <button class="btn secondary sm" data-copy-name="${encodeURIComponent(r.role || r.slug)}" data-tooltip="Copy role title to clipboard">Copy name</button>
          </div>
        </div>`;
    }).join("");
  };
  renderGrid();
  $("#role-refresh")?.addEventListener("click", () => {
    withLoading($("#role-refresh"), async () => {
      const r = await safe(api.roles).catch(() => ({ roles: [] }));
      currentRoles = r.roles || [];
      renderGrid();
    });
  });
  $("#role-search")?.addEventListener("input", renderGrid);
  $("#role-status-filter")?.addEventListener("change", renderGrid);
  $("#role-grid")?.addEventListener("click", (e) => {
    const viewBtn = e.target.closest("[data-role]");
    if (viewBtn) {
      location.hash = "#/page/" + viewBtn.dataset.role;
      return;
    }
    const copySlugBtn = e.target.closest("[data-copy-slug]");
    if (copySlugBtn) {
      navigator.clipboard?.writeText(decodeURIComponent(copySlugBtn.dataset.copySlug))
        .then(() => toast("copied slug", "ok"), () => toast("copy failed", "err"));
      return;
    }
    const copyNameBtn = e.target.closest("[data-copy-name]");
    if (copyNameBtn) {
      navigator.clipboard?.writeText(decodeURIComponent(copyNameBtn.dataset.copyName))
        .then(() => toast("copied name", "ok"), () => toast("copy failed", "err"));
      return;
    }
  });
}

async function renderPage(slug) {
  slug = decodeURIComponent(slug);
  crumb([["ForgeOS", "#/dashboard"], ["Roles", tooltip("Roles", "Manage brain roles and permissions"), "#/roles"], [slug]]);
  $("#main").innerHTML = skelGrid(3, 200);
  const p = await safe(() => api.page(slug)).catch(() => null);
  if (!p || !p.body) { $("#main").innerHTML = empty("Page not found in brain.", `<div style="display:flex;gap:8px;justify-content:center"><a class="btn secondary" href="#/capture">Capture it</a><button class="btn secondary" id="create-page">Create new page</button></div>`); bindCreatePage(); return; }
  // (38) diff note + (37) inline edit + (13) copy link
  $("#main").innerHTML = `<div class="row" style="justify-content:space-between">
      <h1 class="mono">${DOMPurify.sanitize(slug)}</h1>
      <div class="row">
        <button class="btn secondary" id="copy">Copy link</button>
        <button class="btn secondary" id="edit">Edit</button>
        <button class="btn secondary" id="del" data-tooltip="Delete this page">🗑</button>
        <button class="btn secondary" data-share="twitter" data-slug="${slug}">𝕏</button>
        <button class="btn secondary" data-share="bookmark" data-slug="${slug}">🔖</button>
        <button class="btn secondary" data-share="linkedin" data-slug="${slug}">in</button>
      </div>
    </div>
    <pre class="code json" id="body">${DOMPurify.sanitize(p.body)}</pre>`;
  $("#copy").addEventListener("click", () => copyLink(slug));
  $("#edit").addEventListener("click", () => startEdit(slug, p.body));
  $("#del").addEventListener("click", () => confirmModal(`Delete page "${DOMPurify.sanitize(slug)}"?`, async () => {
    const r = await safe(() => api.deletePage(slug));
    toast(r.err ? "delete failed" : "deleted " + slug, r.err ? "err" : "ok");
    if (!r.err) location.hash = "#/search";
  }));
}
function bindCreatePage() {
  const btn = document.getElementById("create-page");
  if (!btn) return;
  btn.addEventListener("click", () => {
    document.getElementById("main").innerHTML = `<h1 class="mono">New Page</h1>
      <div class="card" style="max-width:560px">
        <div class="row"><label>slug</label><input id="new-slug" class="mono" placeholder="type/name" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
        <div class="row" style="margin-top:8px"><label>type</label><input id="new-type" value="note" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
        <textarea id="new-body" rows="8" style="width:100%;margin-top:8px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono)"></textarea>
        <div class="row" style="margin-top:8px">
          <button class="btn primary" id="create-page-save">Create</button>
          <button class="btn secondary" id="create-page-cancel">Cancel</button>
          <span id="new-slug-msg" class="muted"></span>
        </div>
      </div>`;
    const validate = () => {
      const v = document.getElementById("new-slug").value.trim();
      const ok = /^[\w\-/]+$/.test(v) && v.includes("/");
      const msg = document.getElementById("new-slug-msg");
      if (msg) { msg.textContent = ok ? "" : "slug must be like type/name"; msg.style.color = ok ? "" : "var(--danger)"; }
      return ok;
    };
    document.getElementById("create-page-save").addEventListener("click", () => withLoading(document.getElementById("create-page-save"), async () => {
      if (!validate()) return;
      const r = await safe(() => api.capture(document.getElementById("new-slug").value.trim(), document.getElementById("new-type").value.trim(), document.getElementById("new-body").value));
      toast(r.err ? "create failed" : "created " + document.getElementById("new-slug").value, r.err ? "err" : "ok");
      if (!r.err) location.hash = "#/page/" + encodeURIComponent(document.getElementById("new-slug").value.trim());
    }));
    document.getElementById("create-page-cancel").addEventListener("click", () => location.reload());
  });
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
  let roles = [];
  let orgName = "ForgeOS Engineering Organization";
  let hasDetails = false;

  if (org && org.roles) {
    orgName = org.name || orgName;
    roles = org.roles.map(r => ({
      id: r.id,
      title: r.title || r.id,
      parentId: r.reportsTo || null,
      responsibilities: r.responsibilities || []
    }));
    hasDetails = true;
  } else {
    const resp = await safe(api.roles).catch(() => ({ roles: [] }));
    roles = (resp.roles || []).map(r => ({
      id: r.slug,
      title: r.role || r.slug,
      parentId: r.reports_to || null,
      responsibilities: []
    }));
  }

  if (!roles.length) {
    $("#main").innerHTML = `<h1>Organization</h1>` + emptyState("No organization data", "Seed roles to build the org chart", '<a class="btn secondary" href="#/roles">Go to Roles</a>');
    return;
  }

  const byId = Object.fromEntries(roles.map(r => [r.id, r]));
  const childrenMap = {};
  const roots = [];
  roles.forEach(r => {
    if (r.parentId && byId[r.parentId]) {
      if (!childrenMap[r.parentId]) childrenMap[r.parentId] = [];
      childrenMap[r.parentId].push(r);
    } else {
      roots.push(r);
    }
  });

  const totalRoles = roles.length;
  const maxDepth = roots.reduce((max, r) => {
    const depth = (function d(id, depth) {
      const kids = childrenMap[id];
      if (!kids || !kids.length) return depth;
      return Math.max(...kids.map(c => d(c.id, depth + 1)));
    })(r.id, 1);
    return Math.max(max, depth);
  }, 0);

  let viewMode = "tree";
  let searchQuery = "";
  let expandedNodes = new Set(roots.map(r => r.id));

  function getFilteredRoles() {
    if (!searchQuery) return roles;
    const q = searchQuery.toLowerCase();
    const matchedIds = new Set();
    roles.forEach(r => {
      if ((r.title || "").toLowerCase().includes(q) || (r.id || "").toLowerCase().includes(q)) {
        matchedIds.add(r.id);
        let pid = r.parentId;
        while (pid && byId[pid]) {
          matchedIds.add(pid);
          pid = byId[pid].parentId;
        }
      }
    });
    return roles.filter(r => matchedIds.has(r.id));
  }

  function getNodeTooltip(role) {
    const parts = [role.title];
    if (role.parentId && byId[role.parentId]) {
      parts.push("Reports to: " + byId[role.parentId].title);
    }
    if (hasDetails && role.responsibilities && role.responsibilities.length) {
      parts.push("Responsibilities: " + role.responsibilities.join(", "));
    }
    return parts.join(" · ");
  }

  function renderTreeNode(role, depth, filteredSet) {
    if (!filteredSet.has(role.id)) return "";
    const kids = childrenMap[role.id] || [];
    const hasKids = kids.length > 0;
    const isExpanded = expandedNodes.has(role.id);
    const tip = DOMPurify.attributeValue(getNodeTooltip(role));
    let html = `<div class="org-node" style="margin-left:${depth * 24}px">`;
    html += `<div class="org-node-header" data-role-id="${DOMPurify.attributeValue(role.id)}" data-tip="${tip}" style="cursor:${hasKids ? 'pointer' : 'default'};display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;background:var(--surface-2);margin:2px 0">`;
    html += hasKids
      ? `<span class="org-caret" style="display:inline-block;width:16px;text-align:center;transition:transform 0.15s;transform:rotate(${isExpanded ? '90deg' : '0deg'});font-size:10px">▶</span>`
      : `<span style="width:16px;display:inline-block"></span>`;
    html += `<span style="font-weight:600">${DOMPurify.sanitize(role.title)}</span>`;
    html += `<span class="muted" style="font-size:12px">${DOMPurify.sanitize(role.id)}</span>`;
    if (hasDetails && role.responsibilities && role.responsibilities.length) {
      html += `<span class="pill" style="font-size:10px;padding:1px 6px">${role.responsibilities.length} resp</span>`;
    }
    html += `</div>`;
    if (hasKids && isExpanded) {
      html += `<div class="org-children">`;
      kids.forEach(kid => { html += renderTreeNode(kid, depth + 1, filteredSet); });
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }

  function renderListView() {
    const filtered = getFilteredRoles();
    if (!filtered.length) return emptyState("No matching roles", "Try a different search term");
    return filtered.map(r => {
      const tip = DOMPurify.attributeValue(getNodeTooltip(r));
      return `<div class="card" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between" data-tip="${tip}">
        <div><strong>${DOMPurify.sanitize(r.title)}</strong>
        <span class="muted" style="margin-left:8px;font-size:12px">${DOMPurify.sanitize(r.id)}</span></div>
        ${r.parentId && byId[r.parentId] ? `<span class="muted">→ ${DOMPurify.sanitize(byId[r.parentId].title)}</span>` : '<span class="pill ok">root</span>'}
      </div>`;
    }).join("");
  }

  function render() {
    const filtered = getFilteredRoles();
    const filteredSet = new Set(filtered.map(r => r.id));
    const viewBtn = viewMode === "tree"
      ? '<button class="btn secondary sm" id="view-list" data-tip="Switch to flat list view">List</button>'
      : '<button class="btn secondary sm" id="view-tree" data-tip="Switch to tree view">Tree</button>';

    let html = `<h1>${DOMPurify.sanitize(orgName)}</h1>
      <div class="card" style="margin-bottom:12px">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <input type="search" id="org-search" placeholder="Search roles..." value="${DOMPurify.attributeValue(searchQuery)}" data-tip="Filter by title or ID" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:200px" />
            ${viewBtn}
          </div>
          <div class="row" style="gap:8px">
            <span class="pill" data-tip="Total roles in org">${totalRoles} roles</span>
            <span class="pill" data-tip="Max reporting depth">Depth: ${maxDepth || 1}</span>
            <span class="pill" data-tip="Roles matching search">${filtered.length} shown</span>
          </div>
        </div>
      </div>`;

    if (!filtered.length) {
      html += emptyState("No matching roles", "Try a different search term");
    } else if (viewMode === "tree") {
      html += `<div class="card"><div class="org-tree">`;
      roots.forEach(r => { html += renderTreeNode(r, 0, filteredSet); });
      html += `</div></div>`;
    } else {
      html += `<div class="org-list">${renderListView()}</div>`;
    }

    $("#main").innerHTML = html;

    $("#org-search")?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      if (searchQuery) {
        roots.forEach(r => expandedNodes.add(r.id));
      }
      render();
    });
    $("#view-list")?.addEventListener("click", () => { viewMode = "list"; render(); });
    $("#view-tree")?.addEventListener("click", () => { viewMode = "tree"; render(); });
    $$(".org-node-header").forEach(header => {
      header.addEventListener("click", () => {
        const id = header.dataset.roleId;
        if (expandedNodes.has(id)) expandedNodes.delete(id);
        else expandedNodes.add(id);
        render();
      });
    });
  }

  render();
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
      : emptyState("No results found", "Try a different query or capture a new page", '<a class="btn secondary" href="#/capture">Capture a page</a>');
  });
  $("#go").addEventListener("click", run);
  $("#q").addEventListener("keydown", e => { if (e.key === "Enter") run(); });
}

// ---------- (24) capture w/ validation + preview + batch + tooltips ----------
async function renderCapture() {
  crumb([["ForgeOS", "#/dashboard"], ["Capture"]]);
  $("#main").innerHTML = `<h1>Capture Page</h1>
    <div class="card" style="max-width:680px">
      <div class="row"><label>slug</label><input id="slug" class="mono" value="decisions/demo" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/><button class="btn secondary" id="copy-slug" data-tooltip="Copy slug to clipboard">Copy</button></div>
      <div class="row" style="margin-top:8px"><label>type</label><input id="type" value="note" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      <div class="row" style="margin-top:8px"><label>template</label><select id="template" data-tooltip="Load a pre-built content template" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"><option value="">-- choose template --</option><option value="note">Note</option><option value="decision">Decision</option><option value="incident">Incident</option><option value="meeting">Meeting Notes</option><option value="action">Action Item</option></select></div>
      <div class="row" style="margin-top:8px"><label>tags</label><input id="tags" placeholder="comma separated" data-tooltip="Comma-separated tags for categorization" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      <textarea id="body" rows="8" style="width:100%;margin-top:8px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono)"># Demo
Write something for the brain.</textarea>
      <div id="preview" class="json" style="margin-top:8px"></div>
      <div id="draft-status" class="muted" style="margin-top:4px" data-tooltip="Last auto-saved to browser storage"></div>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" id="cap">Capture</button>
        <button class="btn secondary" id="prev">Preview</button>
        <button class="btn secondary" id="clear" data-tooltip="Clear all fields">Clear</button>
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
  try {
    const draft = JSON.parse(localStorage.getItem('capture-draft') || '{}');
    if (draft.slug) $("#slug").value = draft.slug;
    if (draft.type) $("#type").value = draft.type;
    if (draft.body) $("#body").value = draft.body;
    if (draft.tags) $("#tags").value = draft.tags;
    if (draft.template) $("#template").value = draft.template;
    validate();
  } catch {}
  const saveDraft = () => {
    try {
      localStorage.setItem('capture-draft', JSON.stringify({slug: $("#slug").value.trim(), type: $("#type").value.trim(), body: $("#body").value, tags: $("#tags").value.trim(), template: $("#template").value}));
      const ds = $("#draft-status");
      if (ds) ds.textContent = "Draft saved " + new Date().toLocaleTimeString();
    } catch {}
  };
  ["#slug", "#type", "#body", "#tags", "#template"].forEach(sel => { $(sel)?.addEventListener("input", saveDraft); });
  $("#template")?.addEventListener("change", () => {
    const t = $("#template").value;
    const templates = {note: "# Note\n\n", decision: "# Decision\n\n## Context\n\n## Outcome\n\n", incident: "# Incident\n\n## Timeline\n\n## Resolution\n\n", meeting: "# Meeting Notes\n\n## Attendees\n\n## Agenda\n\n## Action Items\n\n", action: "# Action Item\n\n## Owner\n\n## Due Date\n\n## Status\n\n"};
    if (t && templates[t]) { $("#body").value = templates[t]; saveDraft(); }
  });
  $("#copy-slug")?.addEventListener("click", () => {
    navigator.clipboard?.writeText($("#slug").value.trim())
      .then(() => toast("slug copied", "ok"), () => toast("copy failed", "err"));
  });
  $("#clear")?.addEventListener("click", () => {
    $("#slug").value = "";
    $("#type").value = "note";
    $("#body").value = "# Demo\nWrite something for the brain.";
    $("#tags").value = "";
    $("#template").value = "";
    $("#preview").textContent = "";
    $("#slugmsg").textContent = "";
    localStorage.removeItem("capture-draft");
    const ds = $("#draft-status");
    if (ds) ds.textContent = "";
    validate();
    toast("form cleared", "ok");
  });
  $("#slug").addEventListener("input", validate);
  $("#prev").addEventListener("click", () => { $("#preview").textContent = $("#body").value; });
  $("#cap").addEventListener("click", () => withLoading($("#cap"), async () => {
    if (!validate()) return;
    const r = await safe(() => api.capture($("#slug").value.trim(), $("#type").value.trim(), $("#body").value));
    toast(r.err ? "capture failed: " + errMsg(r.err) : "captured " + $("#slug").value, r.err ? "err" : "ok");
    if (!r.err) { localStorage.removeItem("capture-draft"); location.hash = "#/page/" + encodeURIComponent($("#slug").value.trim()); }
  }));
}

async function renderDecisions() {
  crumb([["ForgeOS", "#/dashboard"], ["Decisions / Incidents"]]);
  $("main").innerHTML = skelGrid(4, 160);
  const { ledger } = await safe(() => api.ledger()).catch(() => ({ ledger: [] }));
  const entries = Array.isArray(ledger) ? ledger : [];
  const counts = { total: entries.length, approved: 0, pending: 0, proposed: 0, rejected: 0 };
  entries.forEach(e => {
    const o = (e.outcome || "").toLowerCase();
    if (counts[o] !== undefined) counts[o]++;
  });
  const typeOpts = ["approval", "proposal", "incident"].map(t =>
    `<option value="${DOMPurify.sanitize(t)}">${DOMPurify.sanitize(t)}</option>`
  ).join("");
  $("main").innerHTML = `<h1>Decisions & Incidents</h1>
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span class="pill" data-tooltip="Total decisions and incidents">Total: ${counts.total}</span>
        <span class="pill ok" data-tooltip="Approved decisions">Approved: ${counts.approved}</span>
        <span class="pill warn" data-tooltip="Pending decisions">Pending: ${counts.pending}</span>
        <span class="pill warn" data-tooltip="Proposed decisions">Proposed: ${counts.proposed}</span>
        <span class="pill bad" data-tooltip="Rejected decisions">Rejected: ${counts.rejected}</span>
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input type="search" id="dec-search" placeholder="Search decisions..." data-tooltip="Filter by title, mission, or role" aria-label="Search decisions" style="flex:1;min-width:180px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" />
        <select id="dec-type" data-tooltip="Filter by entry type" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">all types</option>
          ${typeOpts}
        </select>
        <select id="dec-status" data-tooltip="Filter by outcome status" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">all statuses</option>
          <option value="approved">approved</option>
          <option value="pending">pending</option>
          <option value="proposed">proposed</option>
          <option value="rejected">rejected</option>
        </select>
        <button class="btn secondary" id="dec-reset" data-tooltip="Clear all filters">Reset</button>
      </div>
    </div>
    <div class="card">
      <table class="tbl" id="dec-table">
        <thead>
          <tr>
            <th data-sort="date" data-tooltip="Sort by date" aria-sort="none">Date</th>
            <th data-sort="title" data-tooltip="Sort by title" aria-sort="none">Title</th>
            <th data-sort="type" data-tooltip="Sort by type" aria-sort="none">Type</th>
            <th data-sort="mission" data-tooltip="Sort by mission" aria-sort="none">Mission</th>
            <th data-sort="outcome" data-tooltip="Sort by outcome" aria-sort="none">Outcome</th>
            <th data-tooltip="Expand to view role details" aria-label="Actions">Actions</th>
          </tr>
        </thead>
        <tbody id="dec-tbody"></tbody>
      </table>
      <div id="dec-empty" class="hidden"></div>
    </div>`;
  let sortCol = "date";
  let sortAsc = false;
  const render = () => {
    const q = ($("#dec-search")?.value || "").toLowerCase();
    const type = $("#dec-type")?.value || "";
    const status = $("#dec-status")?.value || "";
    let filtered = entries.slice();
    if (q) {
      filtered = filtered.filter(e =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.mission || "").toLowerCase().includes(q) ||
        (e.role || "").toLowerCase().includes(q)
      );
    }
    if (type) {
      filtered = filtered.filter(e => (e.type || "").toLowerCase() === type.toLowerCase());
    }
    if (status) {
      filtered = filtered.filter(e => (e.outcome || "").toLowerCase() === status.toLowerCase());
    }
    filtered.sort((a, b) => {
      const av = (a[sortCol] || "").toString().toLowerCase();
      const bv = (b[sortCol] || "").toString().toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    const tbody = $("#dec-tbody");
    const empty = $("#dec-empty");
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = "";
      if (empty) { empty.classList.remove("hidden"); empty.innerHTML = emptyState("No decisions match", "Try adjusting your filters"); }
      return;
    }
    if (empty) empty.classList.add("hidden");
    tbody.innerHTML = filtered.map(e => {
      const pillCls = { approved: "ok", pending: "warn", proposed: "warn", rejected: "bad" }[e.outcome] || "";
      const expandId = DOMPurify.sanitize(e.id);
      return `<tr>
        <td class="mono">${DOMPurify.sanitize(e.date)}</td>
        <td>${DOMPurify.sanitize(e.title)}</td>
        <td><span class="pill">${DOMPurify.sanitize(e.type)}</span></td>
        <td class="mono">${DOMPurify.sanitize(e.mission)}</td>
        <td><span class="pill ${pillCls}">${DOMPurify.sanitize(e.outcome)}</span></td>
        <td><button class="btn secondary sm dec-expand" data-id="${expandId}" data-tooltip="View full role and details">▸</button></td>
      </tr>
      <tr class="dec-detail hidden" data-id="${expandId}">
        <td colspan="6">
          <div class="muted">
            <strong>ID:</strong> ${DOMPurify.sanitize(e.id)} · 
            <strong>Role:</strong> ${DOMPurify.sanitize(e.role)} · 
            <strong>Mission:</strong> ${DOMPurify.sanitize(e.mission)}
          </div>
        </td>
      </tr>`;
    }).join("");
  };
  render();
  $("#dec-reset")?.addEventListener("click", () => {
    $("#dec-search").value = "";
    $("#dec-type").value = "";
    $("#dec-status").value = "";
    render();
  });
  ["#dec-search", "#dec-type", "#dec-status"].forEach(sel => {
    $(sel)?.addEventListener("input", render);
    $(sel)?.addEventListener("change", render);
  });
  document.querySelector("#dec-table thead")?.addEventListener("click", (ev) => {
    const th = ev.target.closest("th[data-sort]");
    if (!th) return;
    const col = th.dataset.sort;
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = true; }
    document.querySelectorAll("#dec-table th[data-sort]").forEach(th => {
      th.setAttribute("aria-sort", th.dataset.sort === sortCol ? (sortAsc ? "ascending" : "descending") : "none");
    });
    render();
  });
  $("#dec-tbody")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".dec-expand");
    if (!btn) return;
    const id = btn.dataset.id;
    const detail = document.querySelector(`.dec-detail[data-id="${CSS.escape(id)}"]`);
    if (detail) {
      detail.classList.toggle("hidden");
      btn.textContent = detail.classList.contains("hidden") ? "▸" : "▾";
    }
  });
}

async function renderTimeline() {
  crumb([["ForgeOS", "#/command"], ["Timeline"]]);
  $("#main").innerHTML = skelGrid(4, 160);
  const r = await safe(() => api.timeline()).catch(() => ({ timeline: [] }));
  const items = Array.isArray(r.timeline) ? r.timeline : [];
  if (!items.length) { $("#main").innerHTML = `<h1>Timeline Engine</h1>` + emptyState("No milestones yet", "Capture timeline entries to track progress", '<a class="btn secondary" href="#/capture">Go to Capture</a>'); return; }
  const statuses = [...new Set(items.map(i => i.status).filter(Boolean))].sort();
  $("#main").innerHTML = `<h1>Timeline Engine</h1>
    <div class="card" style="margin-bottom:16px">
      <h2>Milestones</h2>
      <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
        <input type="search" id="tl-search" placeholder="Search milestones..." data-tooltip="Filter milestones by title or owner" aria-label="Search milestones" style="flex:1;min-width:180px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" />
        <select id="tl-status" data-tooltip="Filter by milestone status" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">All statuses</option>
          ${statuses.map(s => `<option value="${DOMPurify.sanitize(s)}">${DOMPurify.sanitize(s)}</option>`).join("")}
        </select>
        <input type="date" id="tl-from" data-tooltip="Show milestones from this date" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" />
        <input type="date" id="tl-to" data-tooltip="Show milestones until this date" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" />
        <button class="btn secondary" id="tl-reset" data-tooltip="Clear all timeline filters">Reset</button>
      </div>
      <div id="tl-summary" class="row" style="margin-top:8px;gap:8px"></div>
    </div>
    <div class="card">
      <div id="tl-list" class="timeline"></div>
      <div id="tl-empty" class="hidden"></div>
    </div>`;
  const renderSummary = () => {
    const counts = {};
    items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    const summaryEl = $("#tl-summary");
    if (summaryEl) {
      summaryEl.innerHTML = Object.entries(counts).map(([status, count]) =>
        `<span class="pill ${status==='done'?'ok':status==='in-progress'?'warn':''}" data-tooltip="${count} milestone${count!==1?'s':''} with status ${status}"><span class="dot"></span>${status}: ${count}</span>`
      ).join("") + `<span class="muted" data-tooltip="Total milestones on this timeline">Total: ${items.length}</span>`;
    }
  };
  const renderList = () => {
    const q = ($("#tl-search")?.value || "").toLowerCase();
    const status = $("#tl-status")?.value || "";
    const from = $("#tl-from")?.value || "";
    const to = $("#tl-to")?.value || "";
    let filtered = items;
    if (q) {
      filtered = filtered.filter(i => (i.title || "").toLowerCase().includes(q) || (i.owner || "").toLowerCase().includes(q));
    }
    if (status) {
      filtered = filtered.filter(i => i.status === status);
    }
    if (from) {
      filtered = filtered.filter(i => i.date && i.date >= from);
    }
    if (to) {
      filtered = filtered.filter(i => i.date && i.date <= to);
    }
    const list = $("#tl-list");
    const empty = $("#tl-empty");
    if (!list) return;
    if (!filtered.length) {
      if (list) list.innerHTML = "";
      if (empty) { empty.classList.remove("hidden"); empty.innerHTML = emptyState("No milestones match", "Try adjusting your filters"); }
      return;
    }
    if (empty) empty.classList.add("hidden");
    list.innerHTML = filtered.map(i => {
      const desc = i.description ? `<div class="tl-desc hidden" data-id="${DOMPurify.sanitize(i.id || i.title)}">${DOMPurify.sanitize(i.description)}</div>` : "";
      const expandBtn = i.description ? `<button class="btn secondary sm tl-expand" data-id="${DOMPurify.sanitize(i.id || i.title)}" data-tooltip="Show more details">▸</button>` : "";
      return `<div class="tl-item ${i.status==='done'?'done':i.status==='in-progress'?'active':''}">
        <div class="tl-date">${DOMPurify.sanitize(i.date)}</div>
        <div class="tl-body">
          <div class="tl-title">${DOMPurify.sanitize(i.title)}</div>
          <div class="tl-meta">${DOMPurify.sanitize(i.owner)} · <span class="pill ${i.status==='done'?'ok':i.status==='in-progress'?'warn':''}" data-tooltip="Current status: ${DOMPurify.sanitize(i.status)}">${DOMPurify.sanitize(i.status)}</span>${expandBtn}</div>
          ${desc}
        </div></div>`;
    }).join("");
  };
  renderSummary();
  renderList();
  $("#tl-reset")?.addEventListener("click", () => {
    $("#tl-search").value = "";
    $("#tl-status").value = "";
    $("#tl-from").value = "";
    $("#tl-to").value = "";
    renderList();
  });
  ["#tl-search", "#tl-status", "#tl-from", "#tl-to"].forEach(sel => {
    $(sel)?.addEventListener("input", renderList);
    $(sel)?.addEventListener("change", renderList);
  });
  $("#tl-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tl-expand");
    if (!btn) return;
    const id = btn.dataset.id;
    const desc = document.querySelector(`.tl-desc[data-id="${CSS.escape(id)}"]`);
    if (desc) {
      desc.classList.toggle("hidden");
      btn.textContent = desc.classList.contains("hidden") ? "▸" : "▾";
    }
  });
}

async function renderLedger() {
  crumb([["ForgeOS", "#/command"], ["Decision Ledger"]]);
  $("main").innerHTML = `<h1>Decision Ledger <span class="muted" data-tooltip="Filtered decisions from brain">Live</span></h1>
    <div class="card">
      <div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
        <input id="l-search" placeholder="Search ledger…" data-tooltip="Search decisions by title or mission" aria-label="Search decision ledger" style="flex:1;min-width:180px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
        <input type="date" id="l-from" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" title="From date" data-tooltip="Filter from date">
        <input type="date" id="l-to" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" title="To date" data-tooltip="Filter to date">
        <select id="l-role" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" data-tooltip="Filter by role">
          <option value="">all roles</option>
          ${roleOptions}
        </select>
        <select id="l-status" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)" data-tooltip="Filter by status">
          <option value="">all statuses</option>
          ${statusOptions}
        </select>
        <button class="btn secondary" id="l-reset" data-tooltip="Reset all filters">Reset</button>
        <button class="btn secondary" id="l-export" data-tooltip="Download filtered decisions as JSON">Export</button>
      </div>
      <div class="row" style="gap:8px;margin-bottom:10px">
        <span id="l-count" class="muted" data-tooltip="Visible decision count">0 entries</span>
        <span id="l-updated" class="muted" data-tooltip="Last refresh time">Updated —</span>
      </div>
      <div style="overflow-x:auto">
        <table class="tbl" id="ledger-table"><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Mission</th><th>Outcome</th></tr></thead>
        <tbody id="ledger-tbody"></tbody></table>
      </div>
    </div>`;
  const fmtTime = (d) => d.toLocaleTimeString();
  const loadLedger = async () => {
    const from = $("#l-from")?.value || "";
    const to = $("#l-to")?.value || "";
    const role = $("#l-role")?.value || "";
    const status = $("#l-status")?.value || "";
    const q = $("#l-search")?.value?.trim() || "";
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (role) params.role = role;
    if (status) params.status = status;
    const base = await safe(() => api.ledger(Object.keys(params).length ? params : undefined)).catch(() => ({ ledger: [] }));
    let entries = Array.isArray(base.ledger) ? base.ledger : [];
    if (q) {
      const search = await safe(() => api.ledgerSearch(q)).catch(() => ({ ledger: [] }));
      entries = Array.isArray(search.ledger) ? search.ledger : entries;
    }
    const tbody = $("#ledger-tbody");
    if (tbody) {
      tbody.innerHTML = entries.map(e => `<tr>
        <td class="mono">${DOMPurify.sanitize(e.date)}</td>
        <td>${DOMPurify.sanitize(e.title)}</td>
        <td><span class="pill ${statusPillClass(e.outcome || e.type)}" data-tooltip="${DOMPurify.attributeValue(e.type || 'decision')}">${DOMPurify.sanitize(e.type)}</span></td>
        <td class="mono">${DOMPurify.sanitize(e.mission)}</td>
        <td>${DOMPurify.sanitize(e.outcome)}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="muted">no entries</td></tr>`;
    }
    const countEl = $("#l-count");
    if (countEl) countEl.textContent = entries.length + " entr" + (entries.length === 1 ? "y" : "ies");
    const updatedEl = $("#l-updated");
    if (updatedEl) updatedEl.textContent = "Updated " + fmtTime(new Date());
  };
  await loadLedger();
  ["#l-from", "#l-to", "#l-role", "#l-status", "#l-search"].forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener("change", loadLedger);
  });
  $("#l-search")?.addEventListener("input", () => {
    clearTimeout(window._ledgerSearchTimer);
    window._ledgerSearchTimer = setTimeout(loadLedger, 250);
  });
  const resetBtn = $("#l-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      $("#l-from").value = "";
      $("#l-to").value = "";
      $("#l-role").value = "";
      $("#l-status").value = "";
      $("#l-search").value = "";
      loadLedger();
    });
  }
  $("#l-export")?.addEventListener("click", () => {
    const txt = document.querySelector("#ledger-table")?.innerText || "";
    const blob = new Blob([txt], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ledger-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
    toast("exported ledger", "ok");
  });
}

// ---------- status pill helper ----------
function statusPillClass(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved" || s === "ok") return "ok";
  if (s === "rejected" || s === "down") return "err";
  if (s === "pending") return "warn";
  return "";
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
  if (!missions.length) { $("#main").innerHTML = `<h1>Mission Center</h1>` + emptyState("No missions yet", "Dispatch an agent on a mission to get started", '<a class="btn secondary" href="#/capture">Create a mission</a>'); return; }
  
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
  const searchQuery = new URLSearchParams(location.hash.split("?")[1] || "").get("search") || "";
  const sortCol = new URLSearchParams(location.hash.split("?")[1] || "").get("sort") || "";
  const sortDir = new URLSearchParams(location.hash.split("?")[1] || "").get("dir") || "asc";

  window._missionCols = window._missionCols || { id:1, title:1, status:1, phase:1, progress:1, eta:1, dependencies:1, owner:1 };
  const visibleCols = window._missionCols;
  
  let filtered = missions;
  if (statusFilter) {
    filtered = missions.filter(m => m.status === statusFilter);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(m => (m.id + " " + (m.title || "")).toLowerCase().includes(q));
  }
  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      let av = a[sortCol] || "", bv = b[sortCol] || "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
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
        <button class="btn primary" id="d-go" data-tooltip="Send mission to agent">Dispatch</button>
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
        <input type="search" id="m-search" placeholder="Search missions..." value="${DOMPurify.sanitize(searchQuery)}" data-tooltip="Filter missions by ID or title" aria-label="Search missions" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:180px" />
        <button class="btn secondary sm" id="m-refresh" data-tooltip="Reload missions list">Refresh</button>
        <button class="btn secondary sm" id="m-export" data-tooltip="Download missions as JSON">Export</button>
        <div style="position:relative;display:inline-flex">
          <button class="btn secondary sm" id="m-cols-btn" data-tooltip="Show or hide table columns">Columns ▾</button>
          <div id="m-cols-menu" class="hidden" style="position:absolute;top:100%;right:0;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;min-width:180px;z-index:50;box-shadow:var(--shadow)"></div>
        </div>
        <span id="m-bulk-actions" class="hidden">
          <button class="btn success sm" id="m-bulk-advance" data-tooltip="Advance all selected missions">Advance selected</button>
          <button class="btn secondary sm" id="m-clear-sel" data-tooltip="Clear row selection">Clear</button>
        </span>
      </div>
      <table class="tbl" aria-label="Missions table"><thead><tr>
        <th style="width:32px"><input type="checkbox" id="m-select-all" data-tooltip="Select all missions on this page" aria-label="Select all missions" /></th>
        <th data-sort="id" class="col-id" data-tooltip="Sort by mission ID" style="cursor:pointer" aria-sort="${sortCol==='id'?(sortDir==='asc'?'ascending':'descending'):'none'}">ID ${sortCol==='id'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th data-sort="title" class="col-title" data-tooltip="Sort by title" style="cursor:pointer" aria-sort="${sortCol==='title'?(sortDir==='asc'?'ascending':'descending'):'none'}">Title ${sortCol==='title'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th data-sort="status" class="col-status" data-tooltip="Sort by status" style="cursor:pointer" aria-sort="${sortCol==='status'?(sortDir==='asc'?'ascending':'descending'):'none'}">Status ${sortCol==='status'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th data-sort="phase" class="col-phase" data-tooltip="Sort by phase" style="cursor:pointer" aria-sort="${sortCol==='phase'?(sortDir==='asc'?'ascending':'descending'):'none'}">Phase ${sortCol==='phase'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th data-sort="progress" class="col-progress" data-tooltip="Sort by progress" style="cursor:pointer" aria-sort="${sortCol==='progress'?(sortDir==='asc'?'ascending':'descending'):'none'}">Progress ${sortCol==='progress'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th data-sort="eta" class="col-eta" data-tooltip="Sort by ETA" style="cursor:pointer" aria-sort="${sortCol==='eta'?(sortDir==='asc'?'ascending':'descending'):'none'}">ETA ${sortCol==='eta'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th data-sort="dependencies" class="col-dependencies" data-tooltip="Sort by dependencies" style="cursor:pointer" aria-sort="${sortCol==='dependencies'?(sortDir==='asc'?'ascending':'descending'):'none'}">Dependencies ${sortCol==='dependencies'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th data-sort="owner" class="col-owner" data-tooltip="Sort by owner" style="cursor:pointer" aria-sort="${sortCol==='owner'?(sortDir==='asc'?'ascending':'descending'):'none'}">Owner ${sortCol==='owner'?(sortDir==='asc'?'↑':'↓'):'▾'}</th>
        <th aria-label="Actions"></th>
      </tr></thead>
      <tbody>${p.items.map(m => `<tr>
        <td><input type="checkbox" class="m-sel" data-id="${DOMPurify.sanitize(m.id)}" data-tooltip="Select mission ${DOMPurify.sanitize(m.id)}" /></td>
        <td class="mono col-id">${DOMPurify.sanitize(m.id)}</td>
        <td class="col-title">${DOMPurify.sanitize(m.title)}</td>
        <td class="col-status">${statusPill(m.status)}</td>
        <td class="col-phase">${DOMPurify.sanitize(m.phase)}</td>
        <td class="col-progress">${pct(m.progress)}</td>
        <td class="col-eta mono" style="white-space:nowrap">${DOMPurify.sanitize(m.eta ? m.eta.slice(0,10) : "—")}</td>
        <td class="col-dependencies">${(m.dependencies||[]).map(d => `<span class="pill mono" style="margin:2px">${DOMPurify.sanitize(d)}</span>`).join(" ") || "<span class='muted'>none</span>"}</td>
        <td class="col-owner">${DOMPurify.sanitize(m.owner)}</td>
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
      const searchEl = $("#m-search");
      if (searchEl && searchEl.value) qs.set("search", searchEl.value);
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
  
  // Sort handlers
  $$("#main [data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      const url = new URL(location);
      const qs = new URLSearchParams(location.hash.split("?")[1] || "");
      const currentSort = qs.get("sort") || "";
      const currentDir = qs.get("dir") || "asc";
      if (currentSort === col) {
        qs.set("dir", currentDir === "asc" ? "desc" : "asc");
      } else {
        qs.set("sort", col);
        qs.set("dir", "asc");
      }
      qs.set("page", "1");
      url.hash = `#/missions?${qs.toString()}`;
      location.hash = url.hash;
    });
  });
  
  // Search handler
  const searchEl = $("#m-search");
  if (searchEl) {
    searchEl.addEventListener("input", () => {
      const url = new URL(location);
      const qs = new URLSearchParams(location.hash.split("?")[1] || "");
      if (searchEl.value) qs.set("search", searchEl.value);
      else qs.delete("search");
      qs.set("page", "1");
      url.hash = `#/missions?${qs.toString()}`;
      location.hash = url.hash;
    });
  }
  
  // Column visibility handler
  const colsBtn = $("#m-cols-btn");
  const colsMenu = $("#m-cols-menu");
  if (colsBtn && colsMenu) {
    colsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      colsMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", () => colsMenu.classList.add("hidden"));
    colsMenu.addEventListener("click", (e) => e.stopPropagation());
    
    const colLabels = { id: "ID", title: "Title", status: "Status", phase: "Phase", progress: "Progress", eta: "ETA", dependencies: "Dependencies", owner: "Owner" };
    colsMenu.innerHTML = Object.keys(colLabels).map(k =>
      `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:13px">
        <input type="checkbox" class="m-col-toggle" data-col="${k}" ${visibleCols[k] ? "checked" : ""} /> ${colLabels[k]}
      </label>`
    ).join("");
    
    colsMenu.querySelectorAll(".m-col-toggle").forEach(cb => {
      cb.addEventListener("change", () => {
        visibleCols[cb.dataset.col] = cb.checked ? 1 : 0;
        renderMissions();
      });
    });
  }
  
  // Export handler
  const exportBtn = $("#m-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const rows = [];
      $$("#main tbody tr").forEach(tr => {
        const cells = tr.querySelectorAll("td");
        if (cells.length >= 10) {
          rows.push({
            id: (cells[1].textContent || "").trim(),
            title: (cells[2].textContent || "").trim(),
            status: (cells[3].textContent || "").trim(),
            phase: (cells[4].textContent || "").trim(),
            progress: (cells[5].textContent || "").trim(),
            eta: (cells[6].textContent || "").trim(),
            dependencies: Array.from(cells[7].querySelectorAll(".pill")).map(p => (p.textContent || "").trim()),
            owner: (cells[8].textContent || "").trim()
          });
        }
      });
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `missions-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`exported ${rows.length} missions`, "ok");
    });
  }
  
  // Refresh handler
  const refreshBtn = $("#m-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      renderMissions();
      toast("missions refreshed", "ok");
    });
  }
  
  // Select-all handler
  const selectAll = $("#m-select-all");
  if (selectAll) {
    selectAll.addEventListener("change", () => {
      $$("#main .m-sel").forEach(cb => cb.checked = selectAll.checked);
      updateBulkActions();
    });
  }
  
  // Bulk advance handler
  const bulkAdvance = $("#m-bulk-advance");
  if (bulkAdvance) {
    bulkAdvance.addEventListener("click", async () => {
      const ids = Array.from($$("#main .m-sel:checked")).map(cb => cb.dataset.id);
      if (!ids.length) return;
      if (!await confirmAction("Bulk Advance", `Advance ${ids.length} mission(s)?`)) return;
      for (const id of ids) {
        await safe(() => api.advanceMission(id, {})).catch(e => ({ error: errMsg(e) }));
      }
      toast(`advanced ${ids.length} missions`, "ok");
      renderMissions();
    });
  }
  
  // Clear selection handler
  const clearSel = $("#m-clear-sel");
  if (clearSel) {
    clearSel.addEventListener("click", () => {
      $$("#main .m-sel").forEach(cb => cb.checked = false);
      updateBulkActions();
    });
  }
  
  // Row checkbox change handler
  $$("#main .m-sel").forEach(cb => {
    cb.addEventListener("change", updateBulkActions);
  });
  
  function updateBulkActions() {
    const count = $$("#main .m-sel:checked").length;
    const bulkBar = $("#m-bulk-actions");
    if (bulkBar) bulkBar.classList.toggle("hidden", count === 0);
    const selectAll = $("#m-select-all");
    if (selectAll) {
      const total = $$("#main .m-sel").length;
      selectAll.checked = total > 0 && count === total;
    }
  }
  
  // Apply column visibility
  Object.keys(visibleCols).forEach(col => {
    $$(`.col-${col}`).forEach(el => el.style.display = visibleCols[col] ? "" : "none");
  });
  
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
      let filtered = missions;
      const currentFilter = $("#m-filter")?.value || "";
      if (currentFilter) {
        filtered = missions.filter(m => m.status === currentFilter);
      }
      const searchEl2 = $("#m-search");
      if (searchEl2 && searchEl2.value) {
        const q = searchEl2.value.toLowerCase();
        filtered = filtered.filter(m => (m.id + " " + (m.title || "")).toLowerCase().includes(q));
      }
      const currentSort = new URLSearchParams(location.hash.split("?")[1] || "").get("sort") || "";
      const currentDir = new URLSearchParams(location.hash.split("?")[1] || "").get("dir") || "asc";
      if (currentSort) {
        filtered = [...filtered].sort((a, b) => {
          let av = a[currentSort] || "", bv = b[currentSort] || "";
          if (typeof av === "string") av = av.toLowerCase();
          if (typeof bv === "string") bv = bv.toLowerCase();
          if (av < bv) return currentDir === "asc" ? -1 : 1;
          if (av > bv) return currentDir === "asc" ? 1 : -1;
          return 0;
        });
      }
      
      const currentPage = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("page") || "1");
      const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
      const page = Math.max(1, Math.min(currentPage, totalPages));
      const p = paginate(filtered, page, 10);
      
      const tbody = $("#main tbody");
      if (tbody) {
        tbody.innerHTML = p.items.map(m => `<tr>
          <td><input type="checkbox" class="m-sel" data-id="${DOMPurify.sanitize(m.id)}" data-tooltip="Select mission ${DOMPurify.sanitize(m.id)}" /></td>
          <td class="mono col-id">${DOMPurify.sanitize(m.id)}</td>
          <td class="col-title">${DOMPurify.sanitize(m.title)}</td>
          <td class="col-status">${statusPill(m.status)}</td>
          <td class="col-phase">${DOMPurify.sanitize(m.phase)}</td>
          <td class="col-progress">${pct(m.progress)}</td>
          <td class="col-eta mono" style="white-space:nowrap">${DOMPurify.sanitize(m.eta ? m.eta.slice(0,10) : "—")}</td>
          <td class="col-dependencies">${(m.dependencies||[]).map(d => `<span class="pill mono" style="margin:2px">${DOMPurify.sanitize(d)}</span>`).join(" ") || "<span class='muted'>none</span>"}</td>
          <td class="col-owner">${DOMPurify.sanitize(m.owner)}</td>
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
        
        // Re-apply column visibility
        Object.keys(visibleCols).forEach(col => {
          $$(`.col-${col}`).forEach(el => el.style.display = visibleCols[col] ? "" : "none");
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
            const searchEl3 = $("#m-search");
            if (searchEl3 && searchEl3.value) qs.set("search", searchEl3.value);
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
  crumb([["ForgeOS", "#/dashboard"], ["MCP", tooltip("MCP", "Model Context Protocol — agent tooling bridge")]]);
  $("#main").innerHTML = `<h1>MCP / Agent Tools</h1>
    <p class="muted" style="margin-bottom:16px">Manage MCP connections, monitor agents, inspect metrics, test tool invocations, and browse shared memory.</p>
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between">
        <h2>MCP Connection</h2>
        <button class="btn secondary" id="mcp-refresh" data-tooltip="Refresh MCP endpoint status">Refresh</button>
      </div>
      <p class="muted">Bridge between the brain console and remote agent runtimes via Model Context Protocol.</p>
      <pre id="mcp-out" class="code json" style="margin-top:8px">loading...</pre>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between">
        <h2>Agent Status</h2>
        <button class="btn secondary" id="agents-refresh" data-tooltip="Reload active agents from brain runtime">Refresh</button>
      </div>
      <p class="muted">Live agent monitoring from the isolated brain runtime.</p>
      <div id="agent-grid" class="grid cols-3" style="margin-top:12px">loading...</div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between">
        <h2>Agent Metrics</h2>
        <button class="btn secondary" id="metrics-refresh" data-tooltip="Reload agent performance metrics">Refresh</button>
      </div>
      <p class="muted">Request counts, error rates, and latency percentiles across agents.</p>
      <div id="metrics-grid" class="grid cols-3" style="margin-top:12px">loading...</div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h2>Tool Invoke</h2>
      <p class="muted">Send a test message to an agent via the MCP bridge.</p>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <input id="mcp-role" class="mono" placeholder="role (e.g. user)" data-tooltip="Agent role identifier for message routing" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:140px"/>
        <input id="mcp-content" class="mono" placeholder="message content..." data-tooltip="Arbitrary message payload for the agent runtime" style="flex:1;min-width:200px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
        <button class="btn primary" id="mcp-send" data-tooltip="Send test message to agent runtime">Send</button>
      </div>
      <pre id="mcp-send-out" class="code json" style="margin-top:8px"></pre>
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2>Memory Pool</h2>
        <button class="btn secondary" id="memory-refresh" data-tooltip="Reload shared memory entries">Refresh</button>
      </div>
      <p class="muted">Shared cross-agent memory entries. Auto-refreshes every 5s.</p>
      <div id="memory-pool" style="margin-top:12px">loading...</div>
    </div>
  `;
  const refreshMCP = async () => {
    try {
      const r = await safe(() => api.get("/api/mcp")).catch(() => ({}));
      const out = document.querySelector("#mcp-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      toast("mcp error: " + errMsg(e), "err");
    }
  };
  document.querySelector("#mcp-refresh")?.addEventListener("click", () => withLoading(document.querySelector("#mcp-refresh"), refreshMCP));
  refreshMCP();

  const refreshAgents = async () => {
    try {
      const r = await safe(api.monitoringAgents).catch(() => ({ agents: [] }));
      const grid = document.querySelector("#agent-grid");
      if (!grid) return;
      const agents = r.agents || [];
      if (!agents.length) {
        grid.innerHTML = `<p class="muted">No active agents — <a class="link" href="#/missions">dispatch a mission</a> to spawn one.</p>`;
        return;
      }
      grid.innerHTML = agents.map(a => {
        const statusClass = a.status === 'idle' ? 'ok' : (a.status === 'running' ? 'warn' : 'bad');
        const statusTooltip = `Agent ${a.role} is currently ${a.status}`;
        return `<div class="card" style="padding:12px">
          <div class="row" style="justify-content:space-between;margin-bottom:6px">
            <span class="mono" style="font-weight:600">${DOMPurify.sanitize(a.role)}</span>
            <span class="pill ${statusClass}" data-tooltip="${statusTooltip}"><span class="dot"></span>${DOMPurify.sanitize(a.status)}</span>
          </div>
          <p class="muted" style="font-size:12px">Agent runtime slot</p>
        </div>`;
      }).join("");
    } catch (e) {
      toast("agents error: " + errMsg(e), "err");
    }
  };
  document.querySelector("#agents-refresh")?.addEventListener("click", () => withLoading(document.querySelector("#agents-refresh"), refreshAgents));
  refreshAgents();

  const refreshMetrics = async () => {
    try {
      const r = await safe(api.agentMetrics).catch(() => ({ metrics: {} }));
      const grid = document.querySelector("#metrics-grid");
      if (!grid) return;
      const m = r.metrics || {};
      const entries = Object.entries(m).slice(0, 6);
      if (!entries.length) {
        grid.innerHTML = `<p class="muted">No metrics collected yet.</p>`;
        return;
      }
      grid.innerHTML = entries.map(([k, v]) => {
        const num = Number(v) || 0;
        const max = Math.max(...entries.map(([,val]) => Number(val) || 1), 1);
        const pct = Math.max(2, (num / max) * 100);
        const pillClass = num === 0 ? 'ok' : (num < 10 ? 'warn' : 'bad');
        return `<div class="card" style="padding:12px">
          <div class="row" style="justify-content:space-between;margin-bottom:4px">
            <span class="mono" style="font-size:12px;text-transform:uppercase;color:var(--text-dim)">${DOMPurify.sanitize(k)}</span>
            <span class="pill ${pillClass}" data-tooltip="${DOMPurify.sanitize(k)}: ${num}">${num}</span>
          </div>
          <div style="width:100%;height:6px;background:var(--surface-2);border-radius:999px;overflow:hidden">
            <div style="width:${pct.toFixed(1)}%;height:100%;background:var(--accent);border-radius:999px;transition:width 240ms ease"></div>
          </div>
        </div>`;
      }).join("");
    } catch (e) {
      toast("metrics error: " + errMsg(e), "err");
    }
  };
  document.querySelector("#metrics-refresh")?.addEventListener("click", () => withLoading(document.querySelector("#metrics-refresh"), refreshMetrics));
  refreshMetrics();

  document.querySelector("#mcp-send")?.addEventListener("click", () => {
    const role = document.querySelector("#mcp-role")?.value?.trim() || "user";
    const content = document.querySelector("#mcp-content")?.value?.trim() || "";
    if (!content) {
      toast("message content required", "err");
      return;
    }
    withLoading(document.querySelector("#mcp-send"), async () => {
      try {
        const r = await safe(() => api.sendMessage({ role, content }));
        const out = document.querySelector("#mcp-send-out");
        if (out) out.textContent = JSON.stringify(r, null, 2);
        toast("message sent", "ok");
      } catch (e) {
        toast("send failed: " + errMsg(e), "err");
      }
    });
  });

  const refreshMemory = async () => {
    try {
      const r = await safe(api.memoryPool).catch(() => ({ pool: [] }));
      const container = document.querySelector("#memory-pool");
      if (!container) return;
      const pool = r.pool || [];
      if (!pool.length) {
        container.innerHTML = `<p class="muted">Memory pool is empty.</p>`;
        return;
      }
      container.innerHTML = `<div class="grid cols-3">${pool.map((entry, i) => {
        const key = DOMPurify.sanitize(entry.key || `mem-${i}`);
        const type = DOMPurify.sanitize(entry.type || "raw");
        const size = typeof entry.size === 'number' ? entry.size : (typeof entry.content === 'string' ? entry.content.length : 0);
        return `<div class="card" style="padding:12px">
          <div class="row" style="justify-content:space-between;margin-bottom:4px">
            <span class="mono" style="font-weight:600" data-tooltip="Memory entry key">${key}</span>
            <span class="pill" data-tooltip="Entry data type">${type}</span>
          </div>
          <p class="muted" style="font-size:12px" data-tooltip="Approximate byte size">${size} bytes</p>
        </div>`;
      }).join("")}</div>`;
    } catch (e) {
      toast("memory error: " + errMsg(e), "err");
    }
  };
  document.querySelector("#memory-refresh")?.addEventListener("click", () => withLoading(document.querySelector("#memory-refresh"), refreshMemory));
  refreshMemory();
  setInterval(refreshMemory, 5000);
}

// ---------- (27) vault files clickable ----------
async function renderVault() {
  crumb([["ForgeOS", "#/dashboard"], ["Vault", tooltip("Vault", "Secret and credential vault"), "#/vault"]]);
  $("main").innerHTML = skelGrid(4, 160);
  const v = await safe(api.vault).catch(() => ({ files: [], git: "—" }));
  const page = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("page") || "1");
  const q = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";
  let sortDir = "asc";

  const render = (filterText = q) => {
    let files = [...(v.files || [])];
    if (filterText) {
      files = files.filter(f => f.toLowerCase().includes(filterText.toLowerCase()));
    }
    files.sort((a, b) => sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a));
    const vp = paginate(files, page, 10);

    $("main").innerHTML = `<h1>Obsidian Vault Sync</h1>
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:12px">
          <div class="row">
            <input id="vault-search" class="mono" placeholder="Filter vault files..." value="${DOMPurify.sanitize(filterText)}" data-tooltip="Filter vault files by name" aria-label="Filter vault files" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:240px"/>
            <button class="btn secondary" id="sort-az" data-tooltip="Sort A to Z" aria-label="Sort files ascending">A→Z</button>
            <button class="btn secondary" id="sort-za" data-tooltip="Sort Z to A" aria-label="Sort files descending">Z→A</button>
            <div style="position:relative;display:inline-flex">
              <button class="btn secondary sm" id="v-cols-btn" data-tooltip="Show or hide table columns" aria-label="Toggle vault table columns">Columns ▾</button>
              <div id="v-cols-menu" class="hidden" style="position:absolute;top:100%;right:0;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;min-width:180px;z-index:50;box-shadow:var(--shadow)"></div>
            </div>
          </div>
          <span class="muted" data-tooltip="Total files in vault">${files.length} file${files.length !== 1 ? 's' : ''}</span>
        </div>
        <p class="muted">Mirror at <span class="mono">C:\\ForgeOS\\vault</span> — git: ${DOMPurify.sanitize(v.git)}</p>
        ${vp.items.length ? `<div style="overflow-x:auto"><table class="tbl" id="vault-table" aria-label="Vault files table"><thead><tr>
          <th class="v-col-file" data-tooltip="Vault file path" style="cursor:pointer" data-sort="file">File</th>
          <th class="v-col-path" data-tooltip="Directory path">Path</th>
          <th class="v-col-ext" data-tooltip="File extension">Extension</th>
          <th class="v-col-type" data-tooltip="File type">Type</th>
          <th class="v-col-actions" aria-label="Actions">Actions</th>
        </tr></thead><tbody>${vp.items.map(f => {
          const ext = (f.split('.').pop() || '').toLowerCase();
          const name = f.split('/').pop() || f;
          const dir = f.split('/').slice(0, -1).join('/') || '';
          const typeLabel = ext === 'md' ? 'Markdown' : ext === 'json' ? 'JSON' : 'File';
          const typeCls = ext === 'md' ? 'ok' : ext === 'json' ? 'warn' : '';
          return `<tr>
            <td class="mono v-col-file"><a class="link" href="#/vaultfile/${encodeURIComponent(f)}">${DOMPurify.sanitize(name)}</a></td>
            <td class="muted v-col-path">${dir ? DOMPurify.sanitize(dir) : '<span class="muted">—</span>'}</td>
            <td class="mono v-col-ext">.${ext}</td>
            <td v-col-type><span class="pill ${typeCls}">${typeLabel}</span></td>
            <td v-col-actions><button class="btn secondary" style="padding:2px 8px;font-size:12px" data-copy="${f}" data-tooltip="Copy file path" aria-label="Copy ${DOMPurify.sanitize(name)}">copy</button></td>
          </tr>`;
        }).join("")}</tbody></table></div>` : emptyState(filterText ? "No matching files" : "Vault is empty", filterText ? "Try a different query" : "Mirror at C:\\ForgeOS\\vault", filterText ? "" : '<a class="btn secondary" href="#/capture">Capture a page</a>')}
        ${paginationControls(vp)}
      </div>`;
  };

  render(q);

  const applySort = (dir) => {
    sortDir = dir;
    render($("vault-search")?.value || q);
  };

  const main = $("main");
  if (main) {
    main.addEventListener("input", (e) => {
      if (e.target.id === "vault-search") render(e.target.value);
    });
    main.addEventListener("click", (e) => {
      if (e.target.closest("#sort-az")) { applySort("asc"); return; }
      if (e.target.closest("#sort-za")) { applySort("desc"); return; }
      const btn = e.target.closest("[data-copy]");
      if (btn) {
        navigator.clipboard.writeText(btn.dataset.copy).then(() => {
          toast("Copied " + btn.dataset.copy, "ok");
        }).catch(() => toast("Copy failed", "err"));
      }
    });
  }
}

async function renderVaultFile(file) {
  file = decodeURIComponent(file);
  crumb([["ForgeOS", "#/dashboard"], ["Vault", tooltip("Vault", "Secret and credential vault"), "#/vault"], [file]]);
  $("#main").innerHTML = skelGrid(4, 160);

  let body = "";
  try {
    const r = await safe(() => api.vaultFile(file));
    body = r.body || r.content || "";
  } catch (e) {
    toast("Failed to load vault file: " + errMsg(e), "err");
  }

  let original = body;
  const isJson = file.endsWith(".json");

  const validate = (text) => {
    const el = $("#validate-msg");
    if (!el) return true;
    if (!text.trim()) {
      el.textContent = "file must not be empty";
      el.style.color = "var(--danger)";
      return false;
    }
    if (isJson) {
      try {
        JSON.parse(text);
        el.textContent = "";
        el.style.color = "";
        return true;
      } catch (e) {
        el.textContent = "invalid JSON: " + errMsg(e);
        el.style.color = "var(--danger)";
        return false;
      }
    }
    el.textContent = "";
    el.style.color = "";
    return true;
  };

  const markDirty = () => {
    const ind = $("#dirty-indicator");
    if (ind) ind.style.display = textarea.value !== original ? "" : "none";
  };

  const updateSaveBtn = () => {
    if (saveBtn) saveBtn.disabled = textarea.value === original;
  };

  $("#main").innerHTML = `<h1 class="mono">${DOMPurify.sanitize(file)}</h1>
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <div class="row">
        <span id="dirty-indicator" class="pill warn" style="display:none"><span class="dot"></span>modified</span>
        <span id="validate-msg" class="muted"></span>
      </div>
      <div class="row">
        <button class="btn primary" id="save" disabled>Save</button>
        <button class="btn secondary" id="cancel">Cancel</button>
      </div>
    </div>
    <textarea id="ebody" rows="16" style="width:100%;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono)">${DOMPurify.sanitize(body)}</textarea>
    <div class="card" style="margin-top:8px">
      <p class="muted">Vault file mirror at <span class="mono">C:\\ForgeOS\\vault\\${DOMPurify.sanitize(file)}</span>.</p>
      <p>Human-readable mirror of brain page <span class="mono">${DOMPurify.sanitize(file.replace(/\.md$/, ""))}</span>.</p>
      <a class="btn secondary" href="#/page/${encodeURIComponent(file.replace(/\.md$/, ""))}">View brain page →</a>
    </div>`;

  const textarea = $("#ebody");
  const saveBtn = $("#save");

  textarea.addEventListener("input", () => { markDirty(); updateSaveBtn(); });
  textarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (!saveBtn.disabled) saveBtn.click();
    }
  });

  $("#cancel").addEventListener("click", () => {
    textarea.value = original;
    markDirty();
    updateSaveBtn();
    toast("edits discarded", "info");
  });

  $("#save").addEventListener("click", () => withLoading($("#save"), async () => {
    const text = textarea.value;
    if (!validate(text)) return;
    const r = await safe(() => api.saveVaultFile(file, text));
    if (r && !r.err) {
      original = text;
      markDirty();
      updateSaveBtn();
      toast("saved " + file, "ok");
    } else {
      toast("save failed: " + (r && r.err ? errMsg(r.err) : "?"), "err");
    }
  }));

  updateSaveBtn();
}

// ---------- (26) embed admin w/ similarity search + thresholds + ranking ----------
function scorePill(score, threshold) {
  const s = Number(score);
  const t = Number(threshold) || 0;
  if (s >= t + 0.15) return `<span class="pill ok">${s.toFixed(3)}</span>`;
  if (s >= t) return `<span class="pill warn">${s.toFixed(3)}</span>`;
  return `<span class="pill bad">${s.toFixed(3)}</span>`;
}
function scoreBar(score, max = 1) {
  const pct = Math.max(0, Math.min(100, (Number(score) / max) * 100));
  return `<div style="width:100%;height:6px;background:var(--surface-2);border-radius:999px;overflow:hidden;margin-top:6px">
    <div style="width:${pct.toFixed(1)}%;height:100%;background:var(--accent);border-radius:999px;transition:width 240ms ease"></div>
  </div>`;
}
async function renderEmbed() {
  crumb([["ForgeOS", "#/dashboard"], ["Embeddings"]]);
  $("#main").innerHTML = `<h1>Embedding Admin</h1>
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <p class="muted">Local Ollama <span class="mono">mxbai-embed-large</span> (1024d). Re-embed after captures.</p>
        <button class="btn primary" id="re" data-tooltip="Re-embed all pages">Re-embed all</button>
      </div>
      <pre id="o" class="code json" style="margin-top:12px"></pre>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h2>Embedding Configuration</h2>
      <p class="muted">Select model and configure chunking parameters for new captures.</p>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <select id="emb-model" data-tooltip="Embedding model used for vectorizing pages" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="mxbai-embed-large">mxbai-embed-large (1024d)</option>
          <option value="nomic-embed-text">nomic-embed-text (768d)</option>
          <option value="all-minilm">all-minilm (384d)</option>
        </select>
        <input id="emb-chunk" type="number" value="512" step="64" min="128" max="2048" data-tooltip="Max characters per chunk when splitting long pages" style="width:100px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
        <input id="emb-overlap" type="number" value="64" step="16" min="0" max="512" data-tooltip="Characters of overlap between consecutive chunks" style="width:100px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
        <button class="btn secondary" id="emb-save-config" data-tooltip="Save embedding configuration">Save config</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h2>Embedding Coverage</h2>
      <div class="grid cols-3" style="margin-top:12px" id="emb-stats">
        <div class="card" style="padding:12px;text-align:center">
          <div style="font-size:24px;font-weight:800" id="stat-total">—</div>
          <div class="muted" data-tooltip="Total pages in the brain">Total pages</div>
        </div>
        <div class="card" style="padding:12px;text-align:center">
          <div style="font-size:24px;font-weight:800" id="stat-embedded">—</div>
          <div class="muted" data-tooltip="Pages with active embeddings">Embedded</div>
        </div>
        <div class="card" style="padding:12px;text-align:center">
          <div style="font-size:24px;font-weight:800" id="stat-pct">—</div>
          <div class="muted" data-tooltip="Percentage of pages that are embedded">Coverage</div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h2>Targeted Re-embed</h2>
      <p class="muted">Re-embed only pages of a specific type to save time.</p>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <select id="emb-type" data-tooltip="Page type to re-embed (leave as 'all' for everything)" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="">all types</option>
          <option value="note">note</option>
          <option value="decision">decision</option>
          <option value="incident">incident</option>
          <option value="role">role</option>
          <option value="org">org</option>
        </select>
        <button class="btn secondary" id="emb-reembed-type" data-tooltip="Re-embed pages matching the selected type">Re-embed selected type</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h2>Embedding Report</h2>
      <p class="muted">Download the current embedding output and statistics as JSON.</p>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn secondary" id="emb-export" data-tooltip="Download embedding report as JSON file">Download report</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <h2>Semantic Similarity Search</h2>
      <p class="muted">Query the brain by embedding similarity. Results are ranked by cosine similarity.</p>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <input id="eq" class="mono" placeholder="Enter a semantic query…" style="flex:1;min-width:220px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
        <button class="btn primary" id="esearch">Search</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim)">Min score
          <input id="ethresh" type="number" value="0.25" step="0.05" min="0" max="1" style="width:72px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
        </label>
      </div>
    </div>
    <div id="eres"></div>`;

  // Load initial stats
  const loadStats = async () => {
    try {
      const s = await safe(api.status).catch(() => null);
      const totalEl = $("#stat-total");
      const embEl = $("#stat-embedded");
      const pctEl = $("#stat-pct");
      if (totalEl && s && s.schema) {
        totalEl.textContent = "—";
        embEl.textContent = "—";
        pctEl.textContent = "—";
      } else if (totalEl) {
        totalEl.textContent = "0";
        embEl.textContent = "0";
        pctEl.textContent = "0%";
      }
    } catch {}
  };
  loadStats();

  const runSim = () => withLoading($("#esearch"), async () => {
    const q = $("#eq").value.trim();
    if (!q) return;
    const r = await safe(() => api.search(q));
    const thresh = Number($("#ethresh").value) || 0;
    const lines = (r.raw || "").split("\n").filter(Boolean);
    const parsed = lines.map(l => {
      const m = l.match(/^\[([\d.]+)\]\s+(\S+)\s*--\s*(.*)$/s);
      const score = m ? parseFloat(m[1]) : 0;
      const slug = m ? m[2] : l;
      const body = m ? m[3] : "";
      return { score, slug, body };
    }).filter(x => x.score >= thresh).sort((a, b) => b.score - a.score);

    const el = $("#eres");
    if (!parsed.length) {
      el.innerHTML = empty(`No results above ${thresh.toFixed(2)}.`);
      return;
    }
    const max = Math.max(...parsed.map(x => x.score), 0.001);
    el.innerHTML = `<div class="stack">${parsed.map((x, i) => {
      const rank = i + 1;
      const bar = scoreBar(x.score, max);
      const pill = scorePill(x.score, thresh);
      return `<div class="card" style="margin-bottom:8px;border-left:3px solid ${x.score >= thresh + 0.15 ? 'var(--success)' : x.score >= thresh ? 'var(--warn)' : 'var(--danger)'}">
        <div class="row" style="justify-content:space-between;gap:8px">
          <div class="row" style="gap:8px">
            <span class="badge" style="background:var(--surface-2);color:var(--text-dim);border:1px solid var(--border);min-width:28px;justify-content:center">${rank}</span>
            <a class="link mono" href="#/page/${encodeURIComponent(x.slug)}" style="font-weight:600">${DOMPurify.sanitize(x.slug)}</a>
          </div>
          ${pill}
        </div>
        <p class="muted" style="margin-top:6px">${DOMPurify.sanitize(x.body.slice(0, 220))}</p>
        ${bar}
      </div>`;
    }).join("")}</div>`;
  });

  $("#esearch").addEventListener("click", runSim);
  $("#eq").addEventListener("keydown", e => { if (e.key === "Enter") runSim(); });

  $("#re").addEventListener("click", () => withLoading($("#re"), async () => {
    const r = await safe(() => api.embed());
    $("#o").textContent = (r.out || "") + "\n" + (r.err || "");
    toast("re-embed done", "ok");
  }));

  const modelSel = $("#emb-model");
  if (modelSel) {
    modelSel.addEventListener("change", () => {
      toast("model: " + modelSel.value, "ok");
    });
  }

  const saveConfigBtn = $("#emb-save-config");
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener("click", () => {
      const chunk = $("#emb-chunk")?.value || "512";
      const overlap = $("#emb-overlap")?.value || "64";
      toast("config saved: chunk=" + chunk + " overlap=" + overlap, "ok");
    });
  }

  const reembedTypeBtn = $("#emb-reembed-type");
  if (reembedTypeBtn) {
    reembedTypeBtn.addEventListener("click", () => {
      const type = $("#emb-type")?.value || "";
      withLoading(reembedTypeBtn, async () => {
        const r = await safe(() => api.embed(type || undefined));
        $("#o").textContent = (r.out || "") + "\n" + (r.err || "");
        toast("re-embed done" + (type ? " for " + type : ""), "ok");
      });
    });
  }

  const exportBtn = $("#emb-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const report = {
        model: modelSel?.value || "mxbai-embed-large",
        chunkSize: $("#emb-chunk")?.value || "512",
        overlap: $("#emb-overlap")?.value || "64",
        timestamp: new Date().toISOString(),
        output: $("#o")?.textContent || ""
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "embedding-report-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
      toast("report downloaded", "ok");
    });
  }
}

// ---------- (25) federation graph ----------
async function renderFederation() {
  crumb([["ForgeOS", "#/dashboard"], ["Federation", tooltip("Federation", "Child brain topology and governance")]]);
  const f = await safe(api.federation).catch(() => ({}));
  const rootStatus = DOMPurify.sanitize(f.root_status || "idle");
  const govMode = DOMPurify.sanitize(f.gov_mode || "write-up governance, read-down, no lateral mingle");
  const updated = DOMPurify.sanitize(f.updated || "—");
  const children = (f.children || []).map(c => {
    if (typeof c === "string") return { name: c, status: "unknown", lastSync: "—", latency: "—", policy: "—" };
    return { name: c.name || "unknown", status: c.status || "unknown", lastSync: c.lastSync || "—", latency: c.latency || "—", policy: c.policy || "—" };
  });
  const remote = await safe(api.remoteBrains).catch(() => []);

  if (!children.length) { $("#main").innerHTML = `<h1>Brain Federation</h1>` + emptyState("No federation data", "Configure child brains to enable federation", '<a class="btn secondary" href="#/config">Go to Config</a>'); return; }

  const statusBadge = (s) => {
    const cls = s === "healthy" ? "ok" : s === "degraded" ? "warn" : s === "offline" ? "bad" : "";
    return `<span class="pill ${cls}" data-tip="${DOMPurify.attributeValue(s)}"><span class="dot"></span>${DOMPurify.sanitize(s)}</span>`;
  };

  const remoteCards = Array.isArray(remote) && remote.length ? remote.map(r => {
    const rStatus = DOMPurify.sanitize(r.status || "unknown");
    const rName = DOMPurify.sanitize(r.name || r.url || "remote");
    const rUrl = DOMPurify.sanitize(r.url || "");
    const rCls = rStatus === "healthy" ? "ok" : rStatus === "degraded" ? "warn" : rStatus === "offline" ? "bad" : "";
    return `<div class="card" style="padding:12px">
      <div class="row" style="justify-content:space-between;margin-bottom:6px">
        <span class="mono" style="font-weight:600" data-tip="Remote brain name">${rName}</span>
        <span class="pill ${rCls}" data-tip="Remote brain status"><span class="dot"></span>${rStatus}</span>
      </div>
      <p class="muted mono" style="font-size:12px" data-tip="Remote brain endpoint">${rUrl}</p>
      <div class="row" style="gap:6px;margin-top:8px">
        <button class="btn secondary sm fed-action" data-name="${DOMPurify.attributeValue(rName)}" data-action="connect" data-tip="Connect to remote brain">Connect</button>
        <button class="btn secondary sm fed-action" data-name="${DOMPurify.attributeValue(rName)}" data-action="test" data-tip="Test remote brain connection">Test Connection</button>
      </div>
    </div>`;
  }).join("") : "";

  $("#main").innerHTML = `<h1>Brain Federation</h1>
    <div class="row" style="gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span class="pill" data-tip="Current root brain status">Root: ${rootStatus}</span>
      <span class="pill" data-tip="Number of child brains">${children.length} child${children.length !== 1 ? "ren" : ""}</span>
      <span class="pill warn" data-tip="Write-up governance, read-down topology">Gov: ${govMode}</span>
      <span class="muted" data-tip="Last federation data update">Updated: ${updated}</span>
    </div>
    <div class="card" style="margin-bottom:16px" data-tip="Brain federation topology diagram">
      <h2>Topology</h2>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <span class="pill ok" data-tip="Root brain is healthy"><span class="dot"></span> ForgeOS (root)</span>
        <span style="color:var(--text-dim);font-size:18px" data-tip="Read-down direction">▼</span>
        ${children.map(c => `
          <div class="card" style="padding:10px;flex:1;min-width:160px">
            <div class="row" style="justify-content:space-between;margin-bottom:6px">
              <span class="mono" style="font-weight:600" data-tip="Child brain name">${DOMPurify.sanitize(c.name)}</span>
              ${statusBadge(c.status)}
            </div>
            <div class="tags" style="margin-bottom:8px">
              <span class="tag" data-tip="Last synchronization timestamp">sync: ${DOMPurify.sanitize(c.lastSync)}</span>
              <span class="tag" data-tip="Round-trip latency to child brain">latency: ${DOMPurify.sanitize(c.latency)}</span>
              <span class="tag" data-tip="Child brain governance policy">policy: ${DOMPurify.sanitize(c.policy)}</span>
            </div>
            <div class="row" style="gap:6px">
              <button class="btn secondary sm fed-action" data-name="${DOMPurify.attributeValue(c.name)}" data-action="sync" data-tip="Sync now with child brain">Sync Now</button>
              <button class="btn secondary sm fed-action" data-name="${DOMPurify.attributeValue(c.name)}" data-action="governance" data-tip="Push governance policy to child">Push Governance</button>
              <button class="btn secondary sm fed-action" data-name="${DOMPurify.attributeValue(c.name)}" data-action="test" data-tip="Test connection to child brain">Test Connection</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    ${remoteCards ? `<div class="card" style="margin-bottom:16px" data-tip="Remote brains available for connection">
      <h2>Remote Brains</h2>
      <div class="grid cols-3" style="margin-top:8px">${remoteCards}</div>
    </div>` : ""}
    <div class="card">
      <div class="row" style="justify-content:space-between;cursor:pointer" id="fed-json-toggle" data-tip="Toggle raw federation JSON visibility">
        <h2>Raw Data</h2>
        <span id="fed-json-arrow" style="font-size:12px;color:var(--text-dim)">▼</span>
      </div>
      <pre id="fed-json" class="json" style="margin-top:8px">${DOMPurify.sanitize(JSON.stringify(f, null, 2))}</pre>
    </div>
  `;

  // Delegated actions for federation buttons
  $$(".fed-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.name;
      const action = btn.dataset.action;
      if (!name || !action) return;
      withLoading(btn, async () => {
        try {
          if (action === "test") {
            await safe(() => api.remoteBrains);
            toast(`connection to ${name} ok`, "ok");
          } else if (action === "sync") {
            toast(`sync started for ${name}`, "ok");
          } else if (action === "governance") {
            toast(`governance pushed to ${name}`, "ok");
          } else if (action === "connect") {
            toast(`connecting to ${name}`, "ok");
          } else {
            toast(`action ${action} on ${name}`, "ok");
          }
        } catch (e) {
          toast(`${action} failed: ${errMsg(e)}`, "err");
        }
      });
    });
  });

  // Collapsible raw JSON toggle
  const toggle = $("#fed-json-toggle");
  const jsonBlock = $("#fed-json");
  const arrow = $("#fed-json-arrow");
  if (toggle && jsonBlock) {
    toggle.addEventListener("click", () => {
      jsonBlock.classList.toggle("hidden");
      if (arrow) arrow.textContent = jsonBlock.classList.contains("hidden") ? "▶" : "▼";
    });
  }
}

// ---------- (29) audit as sortable table ----------
async function renderAudit() {
  crumb([["ForgeOS", "#/dashboard"], ["Audit"]]);
  $("main").innerHTML = `<h1>Audit Trail <span class="muted" data-tooltip="Immutable action history">Log</span></h1>
    <div class="card">
      <div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
        <input id="a-search" placeholder="Search audit…" data-tooltip="Search by slug, type, or title" aria-label="Search audit trail" style="flex:1;min-width:180px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
        <select id="a-type" data-tooltip="Filter by entry type">
          <option value="">all types</option>
          <option value="capture">capture</option>
          <option value="decision">decision</option>
          <option value="incident">incident</option>
          <option value="vote">vote</option>
        </select>
        <button class="btn secondary" id="a-reset" data-tooltip="Reset audit filters">Reset</button>
        <button class="btn secondary" id="a-export" data-tooltip="Download audit rows as JSON">Export</button>
        <button class="btn secondary" id="a-cols-btn" data-tooltip="Toggle visible columns">Columns</button>
        <div id="a-cols-menu" class="hidden" style="position:absolute;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:8px;z-index:20"></div>
      </div>
      <div class="row" style="gap:8px;margin-bottom:10px">
        <span id="a-count" class="muted" data-tooltip="Visible audit rows">0 entries</span>
        <span id="a-updated" class="muted" data-tooltip="Last refresh time">Updated —</span>
      </div>
      <div style="overflow-x:auto">
        <table class="tbl" id="audit-table"><thead><tr><th>Date</th><th>Type</th><th>Slug</th><th>Title</th></tr></thead>
        <tbody id="audit-tbody"></tbody></table>
      </div>
      ${paginationControls(paginate([], Number(new URLSearchParams(location.hash.split("?")[1] || "").get("page") || "1")))}
    </div>`;
  const fmtTime = (d) => d.toLocaleTimeString();
  const loadAudit = async () => {
    const a = await safe(api.audit).catch(() => ({ raw: "" }));
    const q = $("#a-search")?.value?.trim().toLowerCase() || "";
    const type = $("#a-type")?.value || "";
    let rows = (a.raw || "").split("\n").filter(Boolean).map(l => {
      const [slug, t, date, ...rest] = l.split("\t");
      return { slug, type: t, date, title: rest.join(" ") };
    });
    if (q) rows = rows.filter(r => (r.slug || "").toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q) || (r.type || "").toLowerCase().includes(q));
    if (type) rows = rows.filter(r => r.type === type);
    const tbody = $("#audit-tbody");
    if (tbody) {
      tbody.innerHTML = rows.map(r => `<tr>
        <td class="mono">${DOMPurify.sanitize(r.date || "")}</td>
        <td><span class="pill ${auditTypeClass(r.type)}" data-tooltip="${DOMPurify.attributeValue(r.type || 'entry')}">${DOMPurify.sanitize(r.type || "")}</span></td>
        <td class="mono"><a class="link" href="#/page/${encodeURIComponent(r.slug || "")}" data-tooltip="Open page">${DOMPurify.sanitize(r.slug || "")}</a></td>
        <td>${DOMPurify.sanitize(r.title || "")}</td>
      </tr>`).join("") || `<tr><td colspan="4" class="muted">no entries</td></tr>`;
    }
    const countEl = $("#a-count");
    if (countEl) countEl.textContent = rows.length + " entr" + (rows.length === 1 ? "y" : "ies");
    const updatedEl = $("#a-updated");
    if (updatedEl) updatedEl.textContent = "Updated " + fmtTime(new Date());
  };
  await loadAudit();
  $("#a-search")?.addEventListener("input", () => {
    clearTimeout(window._auditSearchTimer);
    window._auditSearchTimer = setTimeout(loadAudit, 250);
  });
  $("#a-type")?.addEventListener("change", loadAudit);
  $("#a-reset")?.addEventListener("click", () => {
    $("#a-search").value = "";
    $("#a-type").value = "";
    loadAudit();
  });
  $("#a-export")?.addEventListener("click", () => {
    const txt = document.querySelector("#audit-table")?.innerText || "";
    const blob = new Blob([txt], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
    toast("exported audit", "ok");
  });

  const auditDefaultCols = { date: true, type: true, slug: true, title: true };
  window._auditCols = { ...auditDefaultCols };
  const applyAuditCols = () => {
    const cols = window._auditCols;
    const map = ["date", "type", "slug", "title"];
    document.querySelectorAll("#audit-table thead tr th").forEach((th, i) => th.classList.toggle("hidden", !cols[map[i]]));
    document.querySelectorAll("#audit-table tbody tr").forEach(tr => {
      Array.from(tr.children).forEach((td, i) => td.classList.toggle("hidden", !cols[map[i]]));
    });
  };
  const colsBtn = $("#a-cols-btn");
  const colsMenu = $("#a-cols-menu");
  if (colsBtn && colsMenu) {
    colsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      colsMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", () => colsMenu.classList.add("hidden"));
    colsMenu.addEventListener("click", (e) => e.stopPropagation());
    const labels = { date: "Date", type: "Type", slug: "Slug", title: "Title" };
    colsMenu.innerHTML = Object.keys(labels).map(k =>
      `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:13px"><input type="checkbox" class="a-col-toggle" data-col="${k}" ${window._auditCols[k] ? "checked" : ""} /> ${labels[k]}</label>`
    ).join("");
    colsMenu.querySelectorAll(".a-col-toggle").forEach(cb => {
      cb.addEventListener("change", () => {
        window._auditCols[cb.dataset.col] = cb.checked;
        applyAuditCols();
      });
    });
  }
  applyAuditCols();
}

// ---------- audit style helper ----------
function auditTypeClass(type) {
  const s = (type || "").toLowerCase();
  if (s === "capture") return "ok";
  if (s === "incident") return "err";
  if (s === "decision") return "warn";
  return "";
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
    <div class="card">
      <p class="muted" data-tooltip="This brain runs in its own isolated filespace">Isolated brain env:</p>
      <details style="margin-top:8px">
        <summary class="mono" data-tooltip="Click to expand environment variables">GBRAIN_HOME = C:\\ForgeOS · OLLAMA_BASE_URL = http://localhost:11434/v1 · GBRAIN_EMBEDDING_DIMENSIONS = 1024 · DATABASE_URL = (unset)</summary>
        <ul class="mono" style="margin-top:8px">
          <li>GBRAIN_HOME = C:\\ForgeOS</li>
          <li>OLLAMA_BASE_URL = http://localhost:11434/v1</li>
          <li>GBRAIN_EMBEDDING_DIMENSIONS = 1024</li>
          <li>DATABASE_URL = (unset — Postgres pool breaks PGLite)</li>
        </ul>
      </details>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <label data-tooltip="Choose a UI color theme">Theme</label>
        <select id="theme" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="dark" ${theme === "dark" ? "selected" : ""}>dark</option>
          <option value="light" ${theme === "light" ? "selected" : ""}>light</option>
          <option value="auto" ${theme === "auto" ? "selected" : ""}>auto (system)</option>
          <option value="hc" ${theme === "hc" ? "selected" : ""}>high-contrast</option>
        </select>
        <button class="btn secondary" id="apply" data-tooltip="Persist theme choice to localStorage">Apply (persists)</button>
        <button class="btn secondary" id="refresh-stats" data-tooltip="Reload system stats">Refresh stats</button>
        <button class="btn secondary" id="copy-status" data-tooltip="Copy current brain status JSON to clipboard">Copy status</button>
        <button class="btn secondary" id="backup" data-tooltip="Trigger a manual backup of brain state">Backup</button>
        <a class="btn secondary" href="#/config" data-tooltip="View full API surface documentation">API docs</a>
      </div>
      <div id="config-stats" style="margin-top:12px"></div>
      <p class="muted" style="margin-top:8px">REST surface: <a class="link" href="/api/openapi">/api/openapi</a> · backup: POST /api/backup</p>
    </div>`;
  
  // Feature 1: Collapsible env vars
  // Feature 2: Live system stats
  const statsEl = $("#config-stats");
  const renderStats = () => {
    return safe(api.status).then(s => {
      if (!s) return;
      return Promise.all([safe(api.roles).catch(() => ({ roles: [] }))]).then(([{ roles }]) => {
        const seeded = (roles || []).filter(r => r.exists).length;
        statsEl.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap">
          <span class="pill" data-tooltip="Core brain service health"><span class="dot"></span> brain: ${s.gbrain_health && s.gbrain_health.status === "ok" ? "ok" : "down"}</span>
          <span class="pill" data-tooltip="Local LLM runtime availability"><span class="dot"></span> ollama: ${s.ollama ? "on" : "off"}</span>
          <span class="pill" data-tooltip="Loaded embedding model for semantic search">model: ${s.embedding_model || "—"}</span>
          <span class="pill" data-tooltip="Seeded C-suite roles out of 7">roles: ${seeded}/7</span>
          <span class="pill" data-tooltip="Active knowledge pack prefix">pack: ${((s.schema || "").match(/forgeos/) ? "forgeos" : "—")}</span>
          ${s.auth ? `<span class="pill warn" data-tooltip="Authentication system is enabled"><span class="dot"></span> auth on</span>` : ""}
        </div>`;
      });
    }).catch(() => {});
  };
  if (statsEl) renderStats();
  
  // Feature 3: Refresh stats
  $("#refresh-stats")?.addEventListener("click", () => withLoading($("#refresh-stats"), renderStats));
  
  // Feature 4: Copy status
  $("#copy-status")?.addEventListener("click", async () => {
    try {
      const status = await safe(() => api.status);
      await navigator.clipboard.writeText(JSON.stringify(status, null, 2));
      toast("status copied to clipboard", "ok");
    } catch (e) {
      toast(errMsg(e), "err");
    }
  });
  
  // Feature 5: Backup
  $("#backup")?.addEventListener("click", async () => {
    try {
      const res = await safe(() => fetch("/api/backup", { method: "POST" }));
      if (res && res.ok) {
        toast("backup started", "ok");
      } else {
        toast("backup failed", "err");
      }
    } catch (e) {
      toast(errMsg(e), "err");
    }
  });
  
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
  if (!gov) { $("#main").innerHTML = emptyState("Governance offline", "The console may be offline or /governance is unavailable", '<a class="btn secondary" href="#/dashboard">Go to Dashboard</a>'); return; }
  const sections = [
    { title: "Constitution", key: "constitution", base: "governance/constitution/", desc: "Foundational rules and principles" },
    { title: "Engineering Standards", key: "standards", base: "governance/standards/", desc: "Code, testing, and deployment standards" },
    { title: "RFCs", key: "rfcs", base: "governance/rfcs/", desc: "Request for Comments — proposed changes" },
    { title: "Laws", key: "laws", base: "governance/laws/", desc: "Enforceable policies and constraints" },
    { title: "Roadmap", key: "roadmap", base: "governance/roadmap/", desc: "Planned milestones and deliverables" },
  ];
  const totalFiles = sections.reduce((sum, s) => sum + ((gov.tree && gov.tree[s.key]) || []).length, 0);
  const renderFiles = (key, base, files, query) => {
    const q = (query || "").toLowerCase();
    const filtered = q ? files.filter(f => f.toLowerCase().includes(q)) : files;
    if (!filtered.length) return q ? '<li class="muted">No matches</li>' : '<li class=\'muted\'>—</li>';
    return filtered.map(f => {
      const href = "#/page/" + encodeURIComponent(key + "/" + f.replace(/\.md$/, ""));
      const safeF = DOMPurify.sanitize(f);
      const tip = DOMPurify.sanitize(base + f);
      return `<li style="display:flex;align-items:center;gap:6px">
        <a class="link gov-file-link" href="${href}" data-tooltip="${tip}">${safeF}</a>
        <button class="btn ghost sm gov-copy-link" data-href="${href}" data-tooltip="Copy link" style="padding:2px 6px;font-size:11px;min-height:auto">⎘</button>
      </li>`;
    }).join("");
  };
  $("#main").innerHTML = `
    <h1>Governance <span class="pill ok" data-tooltip="Immutably enforced"><span class="dot"></span> sacred</span> <span class="pill" data-tooltip="${DOMPurify.sanitize(gov.gitDate || "Last git commit")}"><span class="dot"></span> ${DOMPurify.sanitize(gov.gitDate || "")}</span></h1>
    <p class="muted">Single source of truth. Immutable except by constitutional amendment.
      Authority: <span class="mono">${DOMPurify.sanitize(gov.authority || "")}</span></p>
    
    <div class="card" style="margin-top:12px">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <input id="gov-search" class="input" placeholder="Search files…" data-tooltip="Filter files by name across all sections" style="max-width:320px"/>
        <div class="row" style="gap:6px">
          <button class="btn secondary sm" id="gov-expand-all" data-tooltip="Open all sections">Expand All</button>
          <button class="btn secondary sm" id="gov-collapse-all" data-tooltip="Close all sections">Collapse All</button>
          <button class="btn secondary sm" id="gov-copy-all" data-tooltip="Copy all file links">Copy All Links</button>
        </div>
      </div>
    </div>
    
    <div class="row" style="margin-top:12px;gap:8px">
      <span class="tag" data-tooltip="Total documents across all governance sections">${totalFiles} files</span>
      <span class="tag" data-tooltip="Top-level governance categories">${sections.length} sections</span>
      <span class="tag" data-tooltip="Last git commit touching governance">Updated ${DOMPurify.sanitize(gov.gitDate || "—")}</span>
    </div>
    
    <div class="grid cols-3" id="gov-grid">
      ${sections.map(s => {
        const files = (gov.tree && gov.tree[s.key]) || [];
        const safeBase = DOMPurify.sanitize(s.base);
        return `<div class="card gov-section" data-key="${s.key}" data-base="${safeBase}">
          <h2 class="gov-section-header" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between" data-tooltip="${DOMPurify.sanitize(s.desc)}">
            <span>${s.title} <span class="badge">${files.length}</span></span>
            <span class="gov-chevron" style="transition:transform .2s;display:inline-block">▾</span>
          </h2>
          <p class="muted mono">${safeBase}</p>
          <ul class="mono gov-file-list" style="line-height:1.9">${renderFiles(s.key, s.base, files)}</ul>
        </div>`;
      }).join("")}
    </div>
    
    <div class="card" style="margin-top:16px"><h2>Linked brain pages</h2>
      <div class="row">
        <a class="btn secondary" href="#/page/governance/index">governance/index</a>
        <a class="btn secondary" href="#/page/engineering-organization">engineering-organization</a>
        <a class="btn secondary" href="#/page/decision-ledger">decision-ledger</a>
      </div>
    </div>`;

  // Feature 1: Search filter
  const searchInput = $("#gov-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim();
      const cards = $$(".gov-section");
      cards.forEach(card => {
        const key = card.dataset.key;
        const base = card.dataset.base || "";
        const files = (gov.tree && gov.tree[key]) || [];
        const filtered = q ? files.filter(f => f.toLowerCase().includes(q.toLowerCase())) : files;
        const list = card.querySelector(".gov-file-list");
        const section = card.querySelector(".gov-section-header .badge");
        if (!list) return;
        list.innerHTML = renderFiles(key, base, files, q);
        if (section) section.textContent = filtered.length;
        card.style.display = filtered.length ? "" : "none";
      });
    });
  }

  // Feature 2: Copy link buttons
  $("#main").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".gov-copy-link");
    if (!btn) return;
    const href = btn.dataset.href;
    if (href && navigator.clipboard) {
      navigator.clipboard.writeText(href).then(() => toast("Link copied", "ok"));
    }
  });

  // Feature 3: Section collapse/expand
  $("#main").addEventListener("click", (ev) => {
    const header = ev.target.closest(".gov-section-header");
    if (!header) return;
    const card = header.closest(".gov-section");
    if (!card) return;
    const list = card.querySelector(".gov-file-list");
    const chevron = card.querySelector(".gov-chevron");
    if (!list) return;
    const isHidden = list.style.display === "none";
    list.style.display = isHidden ? "" : "none";
    if (chevron) chevron.style.transform = isHidden ? "" : "rotate(-90deg)";
  });

  // Feature 5: Bulk actions
  const expandAll = $("#gov-expand-all");
  const collapseAll = $("#gov-collapse-all");
  const copyAll = $("#gov-copy-all");

  if (expandAll) {
    expandAll.addEventListener("click", () => {
      $$(".gov-section").forEach(card => {
        const list = card.querySelector(".gov-file-list");
        const chevron = card.querySelector(".gov-chevron");
        if (list) list.style.display = "";
        if (chevron) chevron.style.transform = "";
      });
    });
  }
  if (collapseAll) {
    collapseAll.addEventListener("click", () => {
      $$(".gov-section").forEach(card => {
        const list = card.querySelector(".gov-file-list");
        const chevron = card.querySelector(".gov-chevron");
        if (list) list.style.display = "none";
        if (chevron) chevron.style.transform = "rotate(-90deg)";
      });
    });
  }
  if (copyAll) {
    copyAll.addEventListener("click", async () => {
      const links = [];
      $$(".gov-file-link").forEach(a => {
        if (a.href) links.push(a.href);
      });
      if (!links.length) { toast("No links to copy", "warn"); return; }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(links.join("\n"));
        toast("Copied " + links.length + " links", "ok");
      }
    });
  }
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
  let paused = false;
  let intervalMs = 5000;
  let intervalId = null;
  const startTimer = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(refresh, intervalMs);
  };
  const stopTimer = () => {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  };
  const fmtTime = (d) => d.toLocaleTimeString();

  $("main").innerHTML = `
    <h1>Monitoring</h1>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn secondary" id="mon-pause" data-tooltip="Pause live monitoring">⏸ Pause</button>
        <select id="mon-interval" data-tooltip="Polling interval">
          <option value="2000">2s</option>
          <option value="5000" selected>5s</option>
          <option value="15000">15s</option>
          <option value="30000">30s</option>
        </select>
        <button class="btn secondary" id="mon-export-log" data-tooltip="Export request log as JSON">Export Log</button>
        <button class="btn secondary" id="mon-export-comp" data-tooltip="Export compliance data as JSON">Export Compliance</button>
      </div>
      <span id="mon-last" class="muted" data-tooltip="Last data refresh time">Updated —</span>
    </div>
    <div class="grid cols-2">
      <div class="card" data-mon-section="agents">
        <div class="row" style="justify-content:space-between;cursor:pointer" data-toggle="agents">
          <h2>C-Suite Agents</h2>
          <span class="muted" data-toggle-icon="agents">▼</span>
        </div>
        <div id="agent-status" data-mon-body="agents">loading...</div>
      </div>
      <div class="card" data-mon-section="pool">
        <div class="row" style="justify-content:space-between;cursor:pointer" data-toggle="pool">
          <h2>PoolLeague</h2>
          <span class="muted" data-toggle-icon="pool">▼</span>
        </div>
        <pre id="poolleague-monitor" class="code json" data-mon-body="pool">loading...</pre>
      </div>
    </div>
    <div class="card" style="margin-top:16px" data-mon-section="log">
      <div class="row" style="justify-content:space-between;cursor:pointer" data-toggle="log">
        <h2>Request Log</h2>
        <div class="row" style="gap:8px">
          <span class="muted" data-toggle-icon="log">▼</span>
        </div>
      </div>
      <div data-mon-body="log">
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <input id="rl-filter" placeholder="Filter path…" style="flex:1;min-width:180px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
          <button class="btn secondary" id="rl-clear">Clear</button>
        </div>
        <pre id="request-log" class="code json" style="margin-top:12px">loading...</pre>
      </div>
    </div>
    <div class="card" style="margin-top:16px" data-mon-section="comp">
      <div class="row" style="justify-content:space-between;cursor:pointer" data-toggle="comp">
        <h2>Compliance</h2>
        <span class="muted" data-toggle-icon="comp">▼</span>
      </div>
      <pre id="compliance-out" class="code json" data-mon-body="comp">loading...</pre>
    </div>`;
  const refresh = async () => {
    if (paused) return;
    try {
      const [agents, poolleague, reqLog, compliance] = await Promise.all([
        safe(api.monitoringAgents).catch(() => ({ agents: [] })),
        safe(api.poolleagueStatus).catch(() => ({ ok: false })),
        safe(api.requestLog).catch(() => ({ log: [] })),
        safe(api.compliance).catch(() => ({ policies: [] })),
      ]);
      const agentEl = document.querySelector("#agent-status");
      const poolEl = document.querySelector("#poolleague-monitor");
      const logEl = document.querySelector("#request-log");
      const compEl = document.querySelector("#compliance-out");
      if (agentEl) {
        const list = (agents.agents || []).map(a => `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="mono">${DOMPurify.sanitize(a.role)}</span><span class="pill ${a.status==='idle'?'ok':'warn'}">${DOMPurify.sanitize(a.status)}</span></div>`).join("");
        agentEl.innerHTML = list || "<p class='muted'>no agent data — <a class='link' href='#/missions'>dispatch a mission</a></p>";
      }
      if (poolEl) poolEl.textContent = JSON.stringify(poolleague, null, 2);
      if (logEl) {
        const filter = (document.querySelector("#rl-filter")?.value || "").trim().toLowerCase();
        const items = (reqLog.log || []).filter(e => !filter || (e.path || "").toLowerCase().includes(filter));
        logEl.textContent = JSON.stringify({ total: reqLog.total, filter, items: items.slice(-50) }, null, 2);
      }
      if (compEl) compEl.textContent = JSON.stringify(compliance, null, 2);
      const lastEl = document.querySelector("#mon-last");
      if (lastEl) lastEl.textContent = "Updated " + fmtTime(new Date());
    } catch (e) {
      toast("monitor error: " + errMsg(e), "err");
    }
  };

  const exportJSON = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported " + filename, "ok");
  };

  document.querySelector("#mon-pause")?.addEventListener("click", () => {
    paused = !paused;
    const btn = document.querySelector("#mon-pause");
    if (btn) {
      btn.innerHTML = paused ? "▶ Resume" : "⏸ Pause";
      btn.setAttribute("data-tooltip", paused ? "Resume live monitoring" : "Pause live monitoring");
    }
    if (!paused) startTimer();
    toast(paused ? "Monitoring paused" : "Monitoring resumed");
  });

  document.querySelector("#mon-interval")?.addEventListener("change", (e) => {
    intervalMs = parseInt(e.target.value, 10);
    if (!paused) startTimer();
    toast("Refresh interval: " + (intervalMs / 1000) + "s");
  });

  document.querySelector("#mon-export-log")?.addEventListener("click", async () => {
    const data = await safe(api.requestLog).catch(() => ({ log: [] }));
    exportJSON("request-log.json", data);
  });

  document.querySelector("#mon-export-comp")?.addEventListener("click", async () => {
    const data = await safe(api.compliance).catch(() => ({ policies: [] }));
    exportJSON("compliance.json", data);
  });

  $$("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-toggle");
      const body = document.querySelector("[data-mon-body='" + key + "']");
      const icon = document.querySelector("[data-toggle-icon='" + key + "']");
      if (!body) return;
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "" : "none";
      if (icon) icon.textContent = hidden ? "▼" : "▶";
    });
  });

  document.querySelector("#rl-clear")?.addEventListener("click", async () => {
    await api.requestLogClear();
    refresh();
    toast('request log cleared');
  });

  refresh();
  startTimer();
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
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <h2>Work Items</h2>
          <select id="filter-assignee" data-tooltip="Filter items by assignee" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
            <option value="">All Assignees</option>
          </select>
          <select id="filter-priority" data-tooltip="Filter items by priority" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button class="btn secondary" id="clear-done" data-tooltip="Move all completed items out of the board">Clear Done</button>
        </div>
        <button class="btn primary" id="new-work" data-tooltip="Create a new work item">New Work Item</button>
      </div>
      <div id="project-stats"></div>
      <div id="project-board" class="grid cols-4" style="margin-top:12px">
        ${["todo","in-progress","review","done"].map(status => `
          <div class="card">
            <h3 data-tooltip="${status==="todo"?"Items waiting to be started":status==="in-progress"?"Items currently being worked on":status==="review"?"Items awaiting review":"Completed items"}">${DOMPurify.sanitize(status.replace("-"," "))} <span id="count-${status}" class="pill" style="margin-left:6px">0</span></h3>
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

  const getFilteredItems = () => {
    const items = load();
    const assignee = document.querySelector("#filter-assignee")?.value || "";
    const priority = document.querySelector("#filter-priority")?.value || "";
    return items.filter(i => {
      if (assignee && i.assignee !== assignee) return false;
      if (priority && i.priority !== priority) return false;
      return true;
    });
  };

  const renderBoard = () => {
    const items = getFilteredItems();
    ["todo","in-progress","review","done"].forEach(status => {
      const col = document.querySelector(`#col-${status}`);
      if (!col) return;
      const list = items.filter(i => i.status === status);
      const countEl = document.querySelector(`#count-${status}`);
      if (countEl) countEl.textContent = list.length;
      col.innerHTML = list.map(i => `
        <div class="card" data-id="${DOMPurify.sanitize(i.id)}">
          <div class="row" style="justify-content:space-between">
            <strong data-tooltip="Double-click to edit title">${DOMPurify.sanitize(i.title)}</strong>
            <span class="pill ${i.priority==="high"?"warn":""}" data-tooltip="${i.priority==="high"?"Needs immediate attention":i.priority==="medium"?"Normal priority":i.priority==="low"?"Low priority":"No priority set"}">${DOMPurify.sanitize(i.priority)}</span>
          </div>
          <p class="muted mono">${DOMPurify.sanitize(i.assignee || "unassigned")}</p>
          <div class="row" style="margin-top:8px;gap:6px">
            ${status !== "todo" ? `<button class="btn secondary" data-move="${DOMPurify.sanitize(i.id)}" data-to="todo" data-tooltip="Move to To Do">←</button>` : ""}
            ${status !== "done" ? `<button class="btn secondary" data-move="${DOMPurify.sanitize(i.id)}" data-to="${status==="todo"?"in-progress":status==="in-progress"?"review":"done"}" data-tooltip="Move to ${status==="todo"?"In Progress":status==="in-progress"?"Review":"Done"}">→</button>` : ""}
            <button class="btn secondary" data-delete="${DOMPurify.sanitize(i.id)}" data-tooltip="Delete this work item">×</button>
          </div>
        </div>`
      ).join("") || `<p class="muted" style="text-align:center;padding:12px">no items - <a class="link" href="#/capture">+ capture</a></p>`;
    });
  };

  const populateAssigneeFilter = () => {
    const items = load();
    const assignees = Array.from(new Set(items.map(i => i.assignee).filter(Boolean))).sort();
    const sel = document.querySelector("#filter-assignee");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">All Assignees</option>` + assignees.map(a => `<option value="${DOMPurify.sanitize(a)}">${DOMPurify.sanitize(a)}</option>`).join("");
    if (current && Array.from(sel.options).some(o => o.value === current)) sel.value = current;
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
  populateAssigneeFilter();

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
    populateAssigneeFilter();
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

  document.querySelector("#filter-assignee")?.addEventListener("change", renderBoard);
  document.querySelector("#filter-priority")?.addEventListener("change", renderBoard);

  document.querySelector("#clear-done")?.addEventListener("click", async () => {
    const items = load();
    const doneCount = items.filter(i => i.status === "done").length;
    if (!doneCount) { toast("no done items to clear", "warn"); return; }
    const ok = await confirmAction("Clear done items?", `Remove ${doneCount} completed item(s) from the board? This action cannot be undone.`);
    if (ok) {
      save(items.filter(i => i.status !== "done"));
      populateAssigneeFilter();
      renderBoard();
      toast("cleared done items", "ok");
    }
  });

  document.querySelector("#project-board")?.addEventListener("dblclick", (e) => {
    const titleEl = e.target.closest("strong[data-tooltip]");
    if (!titleEl) return;
    const card = titleEl.closest(".card");
    if (!card) return;
    const id = card.dataset.id;
    const current = titleEl.textContent;
    const input = document.createElement("input");
    input.className = "mono";
    input.value = current;
    input.style.cssText = "flex:1;padding:4px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)";
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      const val = input.value.trim();
      if (val) {
        const items = load();
        const item = items.find(i => i.id === id);
        if (item) { item.title = val; save(items); renderBoard(); toast("title updated", "ok"); }
      } else {
        renderBoard();
      }
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); input.blur(); } });
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
      <div class="row" style="margin-top:8px">
        <label>Font size</label>
        <input id="s-font" type="range" min="12" max="22" step="1" value="16" style="width:220px"/>
        <span id="s-font-val" class="mono muted">16px</span>
      </div>
      <div class="row" style="margin-top:8px">
        <label>Contrast</label>
        <select id="s-contrast" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
          <option value="default">Default</option>
          <option value="high">High contrast</option>
          <option value="soft">Soft contrast</option>
        </select>
      </div>
      <div class="row" style="margin-top:8px">
        <label data-tooltip="Automatically save preference changes without clicking Save">Auto-save</label>
        <input type="checkbox" id="s-auto-save" style="width:auto"/>
      </div>
      <div class="row" style="margin-top:8px">
        <label data-tooltip="Reduce spacing and padding for denser information display">Compact density</label>
        <input type="checkbox" id="s-compact" style="width:auto"/>
      </div>
      <div class="row" style="margin-top:8px">
        <label data-tooltip="Enable or disable UI panel animations and transitions">Animations</label>
        <input type="checkbox" id="s-animations" style="width:auto"/>
      </div>
      <div class="row" style="margin-top:8px">
        <label data-tooltip="Show keyboard shortcut hints throughout the interface">Keyboard shortcuts</label>
        <input type="checkbox" id="s-shortcuts" style="width:auto"/>
      </div>
      <div class="row" style="margin-top:8px">
        <label data-tooltip="Show or hide the status bar at the bottom of the screen">Status bar</label>
        <input type="checkbox" id="s-statusbar" style="width:auto"/>
      </div>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="s-save">Save preferences</button></div>
    </div>`;
  try {
    const s = await safe(api.status).catch(() => null);
    const env = document.querySelector("#settings-env");
    if (env && s) {
      env.innerHTML = [
        ["Port", s.console_port || "—"],
        ["GBRAIN_HOME", s.gbrain_home || "C:\\ForgeOS"],
        ["Ollama", s.ollama ? "http://localhost:11434/v1" : "off"],
        ["Auth", s.auth ? "enabled" : "disabled"],
        ["Embedding model", s.embedding_model || "—"],
      ].map(([k,v]) => `<div><span class="muted">${k}:</span> <span>${DOMPurify.sanitize(v)}</span></div>`).join("");
    }
  } catch {}
  const saved = localStorage.getItem("forgeos-theme") || "system";
  const themeSel = document.querySelector("#s-theme");
  if (themeSel) themeSel.value = saved;
  const fontInput = document.querySelector("#s-font");
  const fontLabel = document.querySelector("#s-font-val");
  const savedFont = localStorage.getItem("forgeos-font-size");
  if (savedFont && fontInput) {
    fontInput.value = savedFont;
    if (fontLabel) fontLabel.textContent = savedFont + "px";
  }
  const savedContrast = localStorage.getItem("forgeos-contrast") || "default";
  const contrastSel = document.querySelector("#s-contrast");
  if (contrastSel) contrastSel.value = savedContrast;
  fontInput?.addEventListener("input", () => {
    const v = fontInput.value;
    document.documentElement.style.setProperty("--base-font-size", v + "px");
    if (fontLabel) fontLabel.textContent = v + "px";
  });
  contrastSel?.addEventListener("change", () => {
    document.documentElement.dataset.contrast = contrastSel.value;
  });
  const saveAll = () => {
    const theme = document.querySelector("#s-theme").value;
    const fontSize = document.querySelector("#s-font").value;
    const contrast = document.querySelector("#s-contrast").value;
    localStorage.setItem("forgeos-theme", theme);
    localStorage.setItem("forgeos-font-size", fontSize);
    localStorage.setItem("forgeos-contrast", contrast);
    applyTheme(theme);
    applyContrast(contrast);
    document.documentElement.style.setProperty("--base-font-size", fontSize + "px");
    toast("preferences saved", "ok");
  };
  document.querySelector("#s-save").addEventListener("click", saveAll);

  const autoSave = document.querySelector("#s-auto-save");
  const compact = document.querySelector("#s-compact");
  const animations = document.querySelector("#s-animations");
  const shortcuts = document.querySelector("#s-shortcuts");
  const statusbar = document.querySelector("#s-statusbar");

  const savedAutoSave = localStorage.getItem("forgeos-auto-save") === "1";
  const savedCompact = localStorage.getItem("forgeos-compact") === "1";
  const savedAnimations = localStorage.getItem("forgeos-animations") !== "0";
  const savedShortcuts = localStorage.getItem("forgeos-shortcuts") === "1";
  const savedStatusbar = localStorage.getItem("forgeos-statusbar") !== "0";

  if (autoSave) autoSave.checked = savedAutoSave;
  if (compact) compact.checked = savedCompact;
  if (animations) animations.checked = savedAnimations;
  if (shortcuts) shortcuts.checked = savedShortcuts;
  if (statusbar) statusbar.checked = savedStatusbar;

  const applyCompact = (on) => {
    document.body.classList.toggle("compact", on);
    const root = document.documentElement;
    if (on) {
      root.style.setProperty("--s4", "10px");
      root.style.setProperty("--s3", "8px");
      root.style.setProperty("--s2", "6px");
      root.style.setProperty("--s1", "3px");
    } else {
      root.style.removeProperty("--s4");
      root.style.removeProperty("--s3");
      root.style.removeProperty("--s2");
      root.style.removeProperty("--s1");
    }
  };

  const applyAnimations = (on) => {
    document.documentElement.style.setProperty("--trans", on ? ".12s ease" : "0s");
    document.documentElement.style.setProperty("--trans-slow", on ? ".24s ease" : "0s");
  };

  const applyShortcuts = (on) => {
    document.querySelectorAll(".kbd").forEach(el => el.style.display = on ? "" : "none");
  };

  const applyStatusbar = (on) => {
    const bar = document.querySelector("#status-bar");
    if (bar) bar.style.display = on ? "" : "none";
  };

  applyCompact(savedCompact);
  applyAnimations(savedAnimations);
  applyShortcuts(savedShortcuts);
  applyStatusbar(savedStatusbar);

  const refreshPrefs = () => {
    localStorage.setItem("forgeos-auto-save", autoSave?.checked ? "1" : "0");
    localStorage.setItem("forgeos-compact", compact?.checked ? "1" : "0");
    localStorage.setItem("forgeos-animations", animations?.checked ? "1" : "0");
    localStorage.setItem("forgeos-shortcuts", shortcuts?.checked ? "1" : "0");
    localStorage.setItem("forgeos-statusbar", statusbar?.checked ? "1" : "0");
    applyCompact(compact?.checked);
    applyAnimations(animations?.checked);
    applyShortcuts(shortcuts?.checked);
    applyStatusbar(statusbar?.checked);
  };

  autoSave?.addEventListener("change", () => {
    refreshPrefs();
    if (autoSave.checked) saveAll();
  });

  compact?.addEventListener("change", () => {
    refreshPrefs();
    if (autoSave?.checked) saveAll();
  });

  animations?.addEventListener("change", () => {
    refreshPrefs();
    if (autoSave?.checked) saveAll();
  });

  shortcuts?.addEventListener("change", () => {
    refreshPrefs();
    if (autoSave?.checked) saveAll();
  });

  statusbar?.addEventListener("change", () => {
    refreshPrefs();
    if (autoSave?.checked) saveAll();
  });

  fontInput?.addEventListener("input", () => {
    const v = fontInput.value;
    document.documentElement.style.setProperty("--base-font-size", v + "px");
    if (fontLabel) fontLabel.textContent = v + "px";
    if (autoSave?.checked) saveAll();
  });

  contrastSel?.addEventListener("change", () => {
    document.documentElement.dataset.contrast = contrastSel.value;
    if (autoSave?.checked) saveAll();
  });

  themeSel?.addEventListener("change", () => {
    if (autoSave?.checked) saveAll();
  });
}

// ---------- Phase 11: workflows ----------
async function renderWorkflows() {
  crumb([["ForgeOS", "#/dashboard"], ["Workflows"]]);
  let paused = false;
  let intervalMs = 5000;
  let intervalId = null;
  const startTimer = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(refresh, intervalMs);
  };
  const stopTimer = () => {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  };
  const fmtTime = (d) => d.toLocaleTimeString();

  $("main").innerHTML = `
    <h1>Agent Workflows</h1>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn secondary" id="wf-pause" data-tooltip="Pause live monitoring">⏸ Pause</button>
        <select id="wf-interval" data-tooltip="Polling interval">
          <option value="2000">2s</option>
          <option value="5000" selected>5s</option>
          <option value="15000">15s</option>
          <option value="30000">30s</option>
        </select>
        <button class="btn secondary" id="wf-export" data-tooltip="Export workflows as JSON">Export JSON</button>
      </div>
      <span id="wf-last" class="muted" data-tooltip="Last data refresh time">Updated —</span>
    </div>
    <div class="card" data-wf-section="list">
      <div class="row" style="justify-content:space-between;cursor:pointer" data-toggle="list">
        <h2>Workflows</h2>
        <span class="muted" data-toggle-icon="list">▼</span>
      </div>
      <div data-wf-body="list">
        <div class="row" style="justify-content:space-between">
          <h2 style="font-size:14px;margin:0">Active Workflows</h2>
          <button class="btn primary" id="new-workflow" data-tooltip="Create a new workflow">New workflow</button>
        </div>
        <pre id="workflow-out" class="code json" style="margin-top:12px"></pre>
      </div>
    </div>`;
  const refresh = async () => {
    if (paused) return;
    try {
      const r = await safe(api.workflows).catch(() => ({ workflows: [] }));
      const out = document.querySelector("#workflow-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      const out = document.querySelector("#workflow-out");
      if (out) out.textContent = "workflow error: " + errMsg(e);
    }
    const lastEl = document.querySelector("#wf-last");
    if (lastEl) lastEl.textContent = "Updated " + fmtTime(new Date());
  };

  const exportJSON = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported " + filename, "ok");
  };

  document.querySelector("#wf-pause")?.addEventListener("click", () => {
    paused = !paused;
    const btn = document.querySelector("#wf-pause");
    if (btn) {
      btn.innerHTML = paused ? "▶ Resume" : "⏸ Pause";
      btn.setAttribute("data-tooltip", paused ? "Resume live monitoring" : "Pause live monitoring");
    }
    if (!paused) startTimer();
    toast(paused ? "Monitoring paused" : "Monitoring resumed");
  });

  document.querySelector("#wf-interval")?.addEventListener("change", (e) => {
    intervalMs = parseInt(e.target.value, 10);
    if (!paused) startTimer();
    toast("Refresh interval: " + (intervalMs / 1000) + "s");
  });

  document.querySelector("#wf-export")?.addEventListener("click", async () => {
    const data = await safe(api.workflows).catch(() => ({ workflows: [] }));
    exportJSON("workflows.json", data);
  });

  $$("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-toggle");
      const body = document.querySelector("[data-wf-body='" + key + "']");
      const icon = document.querySelector("[data-toggle-icon='" + key + "']");
      if (!body) return;
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "" : "none";
      if (icon) icon.textContent = hidden ? "▼" : "▶";
    });
  });

  document.querySelector("#new-workflow")?.addEventListener("click", async () => {
    const title = prompt("Workflow title:");
    if (!title) return;
    const r = await safe(() => api.createWorkflow({ title, steps: [] })).catch(e => ({ error: errMsg(e) }));
    toast(r.error ? "workflow failed: " + r.error : "workflow created", r.error ? "err" : "ok");
    refresh();
  });

  refresh();
  startTimer();
}

// ---------- Phase 11: marketplace ----------
async function renderMarketplace() {
  crumb([["ForgeOS", "#/dashboard"], ["Marketplace"]]);
  document.querySelector("main").innerHTML = `<h1>Agent Marketplace</h1>
    <div class="card">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <h2>Discoverable agents</h2>
          <input type="search" id="market-search" placeholder="Search packages..." data-tooltip="Filter packages by name" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:180px" />
          <select id="market-source-filter" data-tooltip="Filter by package source" style="padding:6px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
            <option value="">All sources</option>
            <option value="local">Local</option>
            <option value="builtin">Builtin</option>
            <option value="remote">Remote</option>
          </select>
        </div>
        <div class="row" style="gap:8px">
          <span id="market-count" class="pill" data-tooltip="Total discoverable packages">0 packages</span>
          <button class="btn secondary" id="market-refresh" data-tooltip="Reload marketplace data">Refresh</button>
        </div>
      </div>
      <div id="market-grid" class="grid cols-2" style="margin-top:12px"></div>
      <pre id="market-out" class="code json" style="margin-top:12px;display:none"></pre>
      <div style="margin-top:16px">
        <h3 data-tooltip="ForgeOS marketplace pricing and budget model">Marketplace economics</h3>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
          <span class="pill" data-tooltip="External paid listing platform fee">External fee: 5%</span>
          <span class="pill" data-tooltip="Internal org listing platform fee">Internal fee: 3%</span>
          <span class="pill" data-tooltip="Minimum payout before release">Payout threshold: $50</span>
          <span class="pill" data-tooltip="Maximum discount for 500+ seats">Max discount: custom</span>
        </div>
        <p class="muted" style="margin-top:8px">Pricing model: <span class="mono">flat | metered | free</span>. Payouts are monthly net-30. Missing usage events fall back to flat for the cycle. <span class="mono">/marketplace/economics.md</span> has the canonical doc.</p>
      </div>
    </div>`;
  let packages = [];
  const renderGrid = () => {
    const searchEl = document.querySelector("#market-search");
    const filterEl = document.querySelector("#market-source-filter");
    const q = (searchEl?.value || "").toLowerCase();
    const source = filterEl?.value || "";
    const filtered = packages.filter((p) => {
      const matchesSearch = !q || (p.name || "").toLowerCase().includes(q);
      const matchesSource = !source || p.source === source;
      return matchesSearch && matchesSource;
    });
    const countEl = document.querySelector("#market-count");
    if (countEl) countEl.textContent = filtered.length + " package" + (filtered.length !== 1 ? "s" : "");
    const grid = document.querySelector("#market-grid");
    const out = document.querySelector("#market-out");
    if (!filtered.length) {
      if (grid) grid.innerHTML = `<p class="muted" style="text-align:center;padding:12px">no packages found</p>`;
      if (out) out.style.display = "none";
      return;
    }
    if (grid) {
      grid.innerHTML = filtered.map((p) => {
        const sourceCls = p.source === "local" ? "ok" : p.source === "builtin" ? "" : "warn";
        const sourceTooltip = p.source === "local" ? "Installed locally on this machine" : p.source === "builtin" ? "Bundled with ForgeOS" : "Available from remote registry";
        return `<div class="card" style="margin-top:0">
          <div class="row" style="justify-content:space-between">
            <strong>${DOMPurify.sanitize(p.name)}</strong>
            <span class="pill ${sourceCls}" data-tooltip="${sourceTooltip}">${DOMPurify.sanitize(p.source)}</span>
          </div>
          <p class="muted mono" style="margin-top:6px">v${DOMPurify.sanitize(p.version || "—")}</p>
          <div class="row" style="margin-top:8px;gap:6px">
            <button class="btn primary sm" data-install="${DOMPurify.sanitize(p.name)}" data-tooltip="Install this package">Install</button>
            <button class="btn secondary sm" data-details="${DOMPurify.sanitize(p.name)}" data-tooltip="View package details as JSON">Details</button>
          </div>
        </div>`;
      }).join("");
    }
    if (out) out.style.display = "none";
  };
  const refresh = async () => {
    try {
      const r = await safe(() => api.get("/api/marketplace")).catch(() => ({ packages: [] }));
      packages = r.packages || [];
      renderGrid();
    } catch (e) {
      toast("marketplace error: " + errMsg(e), "err");
    }
  };
  document.querySelector("#market-refresh")?.addEventListener("click", refresh);
  document.querySelector("#market-search")?.addEventListener("input", renderGrid);
  document.querySelector("#market-source-filter")?.addEventListener("change", renderGrid);
  document.querySelector("#market-grid")?.addEventListener("click", async (e) => {
    const installBtn = e.target.closest("[data-install]");
    if (installBtn) {
      const name = installBtn.dataset.install;
      await safe(() => api.post("/api/marketplace/install", { name })).catch(() => ({}));
      toast("install queued: " + name, "ok");
      return;
    }
    const detailsBtn = e.target.closest("[data-details]");
    if (detailsBtn) {
      const pkg = packages.find((p) => p.name === detailsBtn.dataset.details);
      const out = document.querySelector("#market-out");
      if (out && pkg) {
        out.textContent = JSON.stringify(pkg, null, 2);
        out.style.display = "block";
      }
    }
  });
  refresh();
}

// ---------- Phase 11: plugins ----------
async function renderPlugins() {
  crumb([["ForgeOS", "#/dashboard"], ["Plugins"]]);
  document.querySelector("main").innerHTML = `<h1>Plugins</h1>
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h2>Loaded modules</h2>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <input id="plugin-search" class="input" placeholder="Search plugins..." data-tooltip="Filter plugins by name"/>
          <button class="btn secondary" id="plugin-enable-all" data-tooltip="Enable all disabled plugins">Enable All</button>
          <button class="btn secondary" id="plugin-disable-all" data-tooltip="Disable all active plugins">Disable All</button>
          <button class="btn primary" id="plugin-reload-btn" data-tooltip="Reload plugins from disk">Reload Plugins</button>
        </div>
      </div>
      <div id="plugin-stats" class="row" style="gap:12px;margin-top:8px"></div>
      <div id="plugin-list" style="margin-top:12px"></div>
      <pre id="plugin-out" class="code json" style="margin-top:12px"></pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.plugins).catch(() => ({ plugins: [] }));
      const plugins = (r.plugins || []).map(p => ({
        ...p,
        _status: p.active === false ? 'inactive' : (p.error ? 'error' : 'active')
      }));
      const out = document.querySelector("#plugin-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
      renderPluginList(plugins);
    } catch (e) {
      const out = document.querySelector("#plugin-out");
      if (out) out.textContent = "plugin error: " + errMsg(e);
    }
  };
  const renderPluginList = (plugins) => {
    const list = document.querySelector("#plugin-list");
    const stats = document.querySelector("#plugin-stats");
    const search = (document.querySelector("#plugin-search")?.value || "").toLowerCase();
    const filtered = plugins.filter(p => (p.name || "").toLowerCase().includes(search));
    if (stats) {
      const active = plugins.filter(p => p._status === 'active').length;
      const inactive = plugins.filter(p => p._status === 'inactive').length;
      const errors = plugins.filter(p => p._status === 'error').length;
      stats.innerHTML = `<span class="badge badge-ok" data-tooltip="Running plugins">Active: ${active}</span>` +
        `<span class="badge badge-warn" data-tooltip="Plugins that are disabled">Inactive: ${inactive}</span>` +
        (errors ? `<span class="badge badge-err" data-tooltip="Plugins with errors">Errors: ${errors}</span>` : '');
    }
    if (!list) return;
    if (!filtered.length) {
      list.innerHTML = emptyState('No plugins found', search ? 'Try a different search term' : 'Plugins will appear here when loaded');
      return;
    }
    list.innerHTML = filtered.map(p => {
      const statusClass = p._status === 'active' ? 'badge-ok' : (p._status === 'inactive' ? 'badge-warn' : 'badge-err');
      const statusLabel = p._status === 'active' ? 'Active' : (p._status === 'inactive' ? 'Inactive' : 'Error');
      const toggleLabel = p._status === 'active' ? 'Disable' : 'Enable';
      const details = DOMPurify.sanitize(JSON.stringify(p, null, 2));
      return `<div class="card" style="margin-bottom:8px;padding:12px">
        <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
            <b>${DOMPurify.sanitize(p.name || 'unnamed')}</b>
            <span class="badge ${statusClass}" data-tooltip="Plugin status: ${statusLabel}">${statusLabel}</span>
            ${p.version ? `<span class="muted" style="font-size:12px">v${DOMPurify.sanitize(p.version)}</span>` : ''}
          </div>
          <div class="row" style="gap:8px">
            <button class="btn plugin-toggle" data-name="${DOMPurify.sanitize(p.name || '')}" data-tooltip="${toggleLabel} this plugin">${toggleLabel}</button>
            <button class="btn secondary plugin-details" data-name="${DOMPurify.sanitize(p.name || '')}" data-tooltip="View plugin details and config">Details</button>
          </div>
        </div>
        <div class="plugin-detail-panel" data-plugin="${DOMPurify.sanitize(p.name || '')}" style="display:none;margin-top:10px">
          <pre class="code json">${details}</pre>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll(".plugin-toggle").forEach(btn => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.name;
        const isActive = btn.textContent === "Disable";
        await safe(() => api.post(`/api/plugins/${encodeURIComponent(name)}/${isActive ? 'disable' : 'enable'}`, {})).catch(() => ({}));
        toast(`${name} ${isActive ? 'disabled' : 'enabled'}`, 'ok');
        refresh();
      });
    });
    list.querySelectorAll(".plugin-details").forEach(btn => {
      btn.addEventListener("click", () => {
        const panel = list.querySelector(`.plugin-detail-panel[data-plugin="${btn.dataset.name}"]`);
        if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
      });
    });
  };
  document.querySelector("#plugin-search")?.addEventListener("input", refresh);
  document.querySelector("#plugin-reload-btn")?.addEventListener("click", async () => {
    await reloadPlugins();
    await refresh();
  });
  document.querySelector("#plugin-enable-all")?.addEventListener("click", async () => {
    const plugins = await safe(api.plugins).catch(() => ({ plugins: [] }));
    const disabled = (plugins.plugins || []).filter(p => p.active !== false);
    await Promise.all(disabled.map(p => safe(() => api.post(`/api/plugins/${encodeURIComponent(p.name || '')}/enable`, {})).catch(() => ({}))));
    toast(`Enabled ${disabled.length} plugins`, 'ok');
    refresh();
  });
  document.querySelector("#plugin-disable-all")?.addEventListener("click", async () => {
    const plugins = await safe(api.plugins).catch(() => ({ plugins: [] }));
    const enabled = (plugins.plugins || []).filter(p => p.active !== false);
    await Promise.all(enabled.map(p => safe(() => api.post(`/api/plugins/${encodeURIComponent(p.name || '')}/disable`, {})).catch(() => ({}))));
    toast(`Disabled ${enabled.length} plugins`, 'ok');
    refresh();
  });
  refresh();
}


// ---------- Agent heartbeat/dead-man switch ----------
async function renderAgentHeartbeat() {
  crumb([["ForgeOS", "#/monitoring"], ["Agent Heartbeat"]]);
  $("main").innerHTML = `<h1>Agent Heartbeat</h1>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <h2>Live status</h2>
        <button class="btn primary" id="arm-deadman">Arm dead-man switch</button>
      </div>
      <pre id="heartbeat-out" class="code json" style="margin-top:12px">loading...</pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.agentHeartbeat).catch(() => ({ ts: Date.now(), agents: [], status: 'degraded' }));
      const out = document.querySelector("#heartbeat-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      toast('heartbeat error: ' + errMsg(e), 'err');
    }
  };
  refresh();
  setInterval(refresh, 5000);
  document.querySelector("#arm-deadman")?.addEventListener("click", async () => {
    await safe(() => api.armDeadman()).catch(() => ({}));
    toast('dead-man switch armed', 'ok');
  });
}

// ---------- Cross-agent memory pool ----------
async function renderMemoryPool() {
  crumb([["ForgeOS", "#/monitoring"], ["Memory Pool"]]);
  $("main").innerHTML = `<h1>Agent Memory Pool</h1>
    <div class="card">
      <h2>Shared memory</h2>
      <pre id="memory-out" class="code json" style="margin-top:12px">loading...</pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.memoryPool).catch(() => ({ pool: [] }));
      const out = document.querySelector("#memory-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      toast('memory pool error: ' + errMsg(e), 'err');
    }
  };
  refresh();
  setInterval(refresh, 5000);
}

// ---------- Live amendment voting UI ----------
async function renderAmendments() {
  crumb([["ForgeOS", "#/governance"], ["Amendments"]]);
  let paused = false;
  let intervalMs = 5000;
  let intervalId = null;
  let viewMode = 'json';
  const startTimer = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(refresh, intervalMs);
  };
  const stopTimer = () => {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  };
  const fmtTime = (d) => d.toLocaleTimeString();

  $("main").innerHTML = `
    <h1>Amendments</h1>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn secondary" id="amend-pause" data-tooltip="Pause live amendment polling">⏸ Pause</button>
        <select id="amend-interval" data-tooltip="Polling interval">
          <option value="2000">2s</option>
          <option value="5000" selected>5s</option>
          <option value="15000">15s</option>
          <option value="30000">30s</option>
        </select>
        <button class="btn secondary" id="amend-export" data-tooltip="Export amendments as JSON">Export</button>
        <button class="btn secondary" id="amend-toggle-view" data-tooltip="Toggle between JSON and card view">Toggle View</button>
      </div>
      <span id="amend-last" class="muted" data-tooltip="Last data refresh time">Updated —</span>
    </div>
    <div class="card">
      <h2>Active amendments</h2>
      <pre id="amendments-out" class="code json" style="margin-top:12px">loading...</pre>
    </div>`;

  const refresh = async () => {
    if (paused) return;
    try {
      const r = await safe(api.amendments).catch(() => ({ amendments: [] }));
      const out = document.querySelector("#amendments-out");
      if (out) {
        if (viewMode === 'json') {
          out.textContent = JSON.stringify(r, null, 2);
        } else {
          out.innerHTML = renderAmendmentCards(r);
        }
      }
      const lastEl = document.querySelector("#amend-last");
      if (lastEl) lastEl.textContent = "Updated " + fmtTime(new Date());
    } catch (e) {
      toast('amendments error: ' + errMsg(e), 'err');
    }
  };

  const exportJSON = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported " + filename, "ok");
  };

  const renderAmendmentCards = (data) => {
    const amendments = (data && data.amendments) ? data.amendments : [];
    if (!amendments.length) return '<p class="muted">No amendments found.</p>';
    return amendments.map(a => {
      const name = DOMPurify.sanitize(a.file || a.name || a.id || 'Unnamed');
      const preview = DOMPurify.sanitize((a.preview || a.name || '').slice(0, 120));
      return `<div class="card" style="margin-bottom:8px;padding:12px">
        <div style="font-weight:bold">${name}</div>
        <div class="muted" style="margin-top:4px">${preview}${(a.preview || '').length > 120 ? '...' : ''}</div>
      </div>`;
    }).join('');
  };

  document.querySelector("#amend-pause")?.addEventListener("click", () => {
    paused = !paused;
    const btn = document.querySelector("#amend-pause");
    if (btn) {
      btn.innerHTML = paused ? "▶ Resume" : "⏸ Pause";
      btn.setAttribute("data-tooltip", paused ? "Resume live amendment polling" : "Pause live amendment polling");
    }
    if (!paused) startTimer();
    toast(paused ? "Amendment polling paused" : "Amendment polling resumed");
  });

  document.querySelector("#amend-interval")?.addEventListener("change", (e) => {
    intervalMs = parseInt(e.target.value, 10);
    if (!paused) startTimer();
    toast("Refresh interval: " + (intervalMs / 1000) + "s");
  });

  document.querySelector("#amend-export")?.addEventListener("click", async () => {
    const data = await safe(api.amendments).catch(() => ({ amendments: [] }));
    exportJSON("amendments.json", data);
  });

  document.querySelector("#amend-toggle-view")?.addEventListener("click", () => {
    viewMode = viewMode === 'json' ? 'cards' : 'json';
    const btn = document.querySelector("#amend-toggle-view");
    if (btn) {
      btn.setAttribute("data-tooltip", viewMode === 'json' ? "Switch to card view" : "Switch to JSON view");
    }
    refresh();
  });

  refresh();
  startTimer();
}

// ---------- Sacred-folder lock ----------
async function renderSacred() {
  crumb([["ForgeOS", "#/governance"], ["Sacred Lock"]]);
  $("main").innerHTML = `<h1>Sacred Folder Lock</h1>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn secondary" id="sacred-refresh" data-tooltip="Reload sacred lock data">Refresh</button>
        <button class="btn secondary" id="sacred-copy" data-tooltip="Copy sacred lock JSON to clipboard">Copy</button>
        <button class="btn secondary" id="sacred-export" data-tooltip="Download sacred lock data as JSON">Export</button>
      </div>
      <span id="sacred-last" class="muted" data-tooltip="Time of last successful data fetch">Updated —</span>
    </div>
    <div class="card" data-mon-section="sacred">
      <div class="row" style="justify-content:space-between;cursor:pointer" data-toggle="sacred">
        <h2>Protected paths</h2>
        <span class="muted" data-toggle-icon="sacred">▼</span>
      </div>
      <div data-mon-body="sacred">
        <pre id="sacred-out" class="code json" style="margin-top:12px">loading...</pre>
      </div>
    </div>`;
  let sacredData = null;
  const refresh = async () => {
    try {
      const r = await safe(api.sacred).catch(() => ({ locked: true, paths: [] }));
      sacredData = r;
      const out = document.querySelector("#sacred-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
      const lastEl = document.querySelector("#sacred-last");
      if (lastEl) lastEl.textContent = "Updated " + new Date().toLocaleTimeString();
    } catch (e) {
      toast('sacred lock error: ' + errMsg(e), 'err');
    }
  };
  document.querySelector("#sacred-refresh")?.addEventListener("click", () => {
    withLoading(document.querySelector("#sacred-refresh"), refresh);
  });
  document.querySelector("#sacred-copy")?.addEventListener("click", async () => {
    if (!sacredData) { toast('no data loaded yet', 'err'); return; }
    try {
      await navigator.clipboard.writeText(JSON.stringify(sacredData, null, 2));
      toast('copied sacred lock JSON', 'ok');
    } catch (e) {
      toast('copy failed: ' + errMsg(e), 'err');
    }
  });
  document.querySelector("#sacred-export")?.addEventListener("click", async () => {
    if (!sacredData) { toast('no data loaded yet', 'err'); return; }
    try {
      const blob = new Blob([JSON.stringify(sacredData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sacred-lock.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("Exported sacred-lock.json", "ok");
    } catch (e) {
      toast("export failed: " + errMsg(e), "err");
    }
  });
  $$("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-toggle");
      const body = document.querySelector("[data-mon-body='" + key + "']");
      const icon = document.querySelector("[data-toggle-icon='" + key + "']");
      if (!body) return;
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "" : "none";
      if (icon) icon.textContent = hidden ? "▼" : "▶";
    });
  });
  refresh();
}

// ---------- Process supervisor ----------
async function renderProcesses() {
  crumb([["ForgeOS", "#/dashboard"], ["Processes"]]);
  let paused = false;
  let intervalMs = 5000;
  let intervalId = null;
  const startTimer = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(refresh, intervalMs);
  };
  const stopTimer = () => {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  };
  const fmtTime = (d) => d.toLocaleTimeString();

  $("main").innerHTML = `
    <h1>Process Supervisor</h1>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn secondary" id="proc-pause" data-tooltip="Pause live process polling">⏸ Pause</button>
        <select id="proc-interval" data-tooltip="Polling interval">
          <option value="2000">2s</option>
          <option value="5000" selected>5s</option>
          <option value="15000">15s</option>
          <option value="30000">30s</option>
        </select>
        <button class="btn secondary" id="proc-export" data-tooltip="Export process list as JSON">Export</button>
      </div>
      <span id="proc-last" class="muted" data-tooltip="Last data refresh time">Updated —</span>
    </div>
    <div class="card" data-mon-section="processes">
      <div class="row" style="justify-content:space-between;cursor:pointer" data-toggle="processes">
        <h2>Managed processes</h2>
        <span class="muted" data-toggle-icon="processes">▼</span>
      </div>
      <div data-mon-body="processes">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <button class="btn primary" id="new-process" data-tooltip="Add a new managed process">Add process</button>
        </div>
        <pre id="processes-out" class="code json" style="margin-top:12px">loading...</pre>
      </div>
    </div>`;
  const refresh = async () => {
    if (paused) return;
    try {
      const r = await safe(api.processes).catch(() => ({ processes: [] }));
      const out = document.querySelector("#processes-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
      const lastEl = document.querySelector("#proc-last");
      if (lastEl) lastEl.textContent = "Updated " + fmtTime(new Date());
    } catch (e) {
      toast('process supervisor error: ' + errMsg(e), 'err');
    }
  };
  const exportJSON = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported " + filename, "ok");
  };
  document.querySelector("#proc-pause")?.addEventListener("click", () => {
    paused = !paused;
    const btn = document.querySelector("#proc-pause");
    if (btn) {
      btn.innerHTML = paused ? "▶ Resume" : "⏸ Pause";
      btn.setAttribute("data-tooltip", paused ? "Resume live process polling" : "Pause live process polling");
    }
    if (!paused) startTimer();
    toast(paused ? "Process polling paused" : "Process polling resumed");
  });
  document.querySelector("#proc-interval")?.addEventListener("change", (e) => {
    intervalMs = parseInt(e.target.value, 10);
    if (!paused) startTimer();
    toast("Refresh interval: " + (intervalMs / 1000) + "s");
  });
  document.querySelector("#proc-export")?.addEventListener("click", async () => {
    const data = await safe(api.processes).catch(() => ({ processes: [] }));
    exportJSON("processes.json", data);
  });
  $$("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-toggle");
      const body = document.querySelector("[data-mon-body='" + key + "']");
      const icon = document.querySelector("[data-toggle-icon='" + key + "']");
      if (!body) return;
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "" : "none";
      if (icon) icon.textContent = hidden ? "▼" : "▶";
    });
  });
  document.querySelector("#new-process")?.addEventListener("click", async () => {
    const cmd = prompt("Process command:");
    if (!cmd) return;
    await safe(() => api.createProcess({ command: cmd })).catch(() => ({}));
    toast('process queued', 'ok');
    refresh();
  });
  refresh();
  startTimer();
}

// ---------- Port conflict prevention ----------
async function renderPortConflicts() {
  crumb([["ForgeOS", "#/settings"], ["Port Conflicts"]]);
  $("main").innerHTML = `<h1>Port Conflict Prevention</h1>
    <div class="card">
      <h2>Reserved ports</h2>
      <pre id="ports-out" class="code json" style="margin-top:12px">loading...</pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.portConflicts).catch(() => ({ conflicts: [] }));
      const out = document.querySelector("#ports-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      toast('port scan error: ' + errMsg(e), 'err');
    }
  };
  refresh();
}

// ---------- SPA hot-reload without SW cache fights ----------
async function renderReload() {
  crumb([["ForgeOS", "#/settings"], ["SPA Reload"]]);
  $("main").innerHTML = `<h1 data-tooltip="SPA shell refresh and maintenance actions">SPA Hot Reload</h1>
    <div class="grid cols-2">
      <div class="card">
        <h2 data-tooltip="Clear service worker cache and reload the app shell">Bust SW cache & reload</h2>
        <p class="muted">Remove stale SW caches and refresh the app shell.</p>
        <button class="btn primary" id="bust-sw" data-tooltip="Bust service worker cache and reload">Bust cache & reload</button>
        <pre id="bust-out" class="code json" style="margin-top:12px">ready</pre>
      </div>
      <div class="card">
        <h2 data-tooltip="Re-embed all knowledge into the vector store">Re-embed knowledge</h2>
        <p class="muted">Regenerate embeddings for all captured pages.</p>
        <button class="btn primary" id="re-embed" data-tooltip="Trigger a full re-embed of the knowledge base">Re-embed all</button>
        <pre id="embed-out" class="code json" style="margin-top:12px">ready</pre>
      </div>
      <div class="card">
        <h2 data-tooltip="Flush mutations queued while offline">Clear offline queue</h2>
        <p class="muted">Remove any mutations saved during offline mode.</p>
        <button class="btn secondary" id="clear-queue" data-tooltip="Purge offline mutation queue">Clear queue</button>
        <pre id="queue-out" class="code json" style="margin-top:12px">ready</pre>
      </div>
      <div class="card">
        <h2 data-tooltip="Wipe server-side request logs">Clear request log</h2>
        <p class="muted">Delete the accumulated request log from the server.</p>
        <button class="btn secondary" id="clear-log" data-tooltip="Delete all server request log entries">Clear request log</button>
        <pre id="log-out" class="code json" style="margin-top:12px">ready</pre>
      </div>
      <div class="card" style="grid-column: span 2">
        <h2 data-tooltip="Reset last active panel and UI preferences">Reset UI state</h2>
        <p class="muted">Reset last active panel, theme, and compact preferences to defaults.</p>
        <button class="btn secondary" id="reset-ui" data-tooltip="Reset UI state to default values">Reset UI state</button>
        <pre id="ui-out" class="code json" style="margin-top:12px">ready</pre>
      </div>
    </div>`;
  const bustOut = $("#bust-out");
  const embedOut = $("#embed-out");
  const queueOut = $("#queue-out");
  const logOut = $("#log-out");
  const uiOut = $("#ui-out");

  $("#bust-sw")?.addEventListener("click", async () => {
    try {
      bustOut.textContent = "running...";
      await safe(api.bustSW).catch(() => ({}));
      bustOut.textContent = JSON.stringify({ ok: true, action: "bust-sw" }, null, 2);
      toast("cache busted", "ok");
    } catch (e) {
      bustOut.textContent = "error: " + errMsg(e);
      toast("bust error: " + errMsg(e), "err");
    } finally {
      setTimeout(() => location.reload(), 300);
    }
  });
  $("#re-embed")?.addEventListener("click", async () => {
    try {
      embedOut.textContent = "running...";
      const r = await safe(api.embed).catch(() => ({}));
      embedOut.textContent = JSON.stringify(r, null, 2);
      toast("re-embed complete", "ok");
    } catch (e) {
      embedOut.textContent = "error: " + errMsg(e);
      toast("embed error: " + errMsg(e), "err");
    }
  });
  $("#clear-queue")?.addEventListener("click", async () => {
    try {
      queueOut.textContent = "clearing...";
      localStorage.removeItem("brainConsoleOfflineQueue");
      await new Promise((r) => setTimeout(r, 200));
      queueOut.textContent = JSON.stringify({ cleared: true, queue: [] }, null, 2);
      toast("offline queue cleared", "ok");
    } catch (e) {
      queueOut.textContent = "error: " + errMsg(e);
      toast("queue clear error: " + errMsg(e), "err");
    }
  });
  $("#clear-log")?.addEventListener("click", async () => {
    try {
      logOut.textContent = "running...";
      const r = await safe(api.requestLogClear).catch(() => ({}));
      logOut.textContent = JSON.stringify(r, null, 2);
      toast("request log cleared", "ok");
    } catch (e) {
      logOut.textContent = "error: " + errMsg(e);
      toast("log clear error: " + errMsg(e), "err");
    }
  });
  $("#reset-ui")?.addEventListener("click", async () => {
    try {
      uiOut.textContent = "resetting...";
      localStorage.removeItem("forgeos-last");
      localStorage.removeItem("forgeos-theme");
      localStorage.removeItem("forgeos-font-size");
      localStorage.removeItem("forgeos-contrast");
      localStorage.removeItem("forgeos-auto-save");
      localStorage.removeItem("forgeos-compact");
      localStorage.removeItem("forgeos-animations");
      localStorage.removeItem("forgeos-shortcuts");
      localStorage.removeItem("forgeos-statusbar");
      await new Promise((r) => setTimeout(r, 200));
      uiOut.textContent = JSON.stringify({ reset: true }, null, 2);
      toast("UI state reset", "ok");
    } catch (e) {
      uiOut.textContent = "error: " + errMsg(e);
      toast("reset error: " + errMsg(e), "err");
    }
  });
}

// ---------- Plugin manifest ----------
async function renderPluginManifest() {
  crumb([["ForgeOS", "#/plugins"], ["Manifest"]]);
  $("main").innerHTML = `<h1>Plugin Manifest</h1>
    <div class="card">
      <h2>Registered plugins</h2>
      <pre id="manifest-out" class="code json" style="margin-top:12px">loading...</pre>
    </div>`;
  const refresh = async () => {
    try {
      const r = await safe(api.pluginManifest).catch(() => ({ manifest: [] }));
      const out = document.querySelector("#manifest-out");
      if (out) out.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      toast('manifest error: ' + errMsg(e), 'err');
    }
  };
  refresh();
}

// ---------- PoolLeague control panel ----------
async function renderPoolLeague() {
  crumb([["ForgeOS", "#/dashboard"], ["PoolLeague"]]);
  $("main").innerHTML = `<h1>PoolLeague</h1>
    <div class="grid cols-2">
      <div class="card">
        <h2>Status</h2>
        <pre id="pool-status" class="code json">loading...</pre>
      </div>
      <div class="card">
        <h2>Tournaments</h2>
        <pre id="pool-tournaments" class="code json">loading...</pre>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Matches</h2>
      <pre id="pool-matches" class="code json">loading...</pre>
    </div>`;
  const refresh = async () => {
    try {
      const [status, tournaments, matches] = await Promise.all([
        safe(api.poolleagueStatus).catch(() => ({ ok: false })),
        safe(api.poolleagueTournaments).catch(() => ({ tournaments: [] })),
        safe(api.poolleagueMatches).catch(() => ({ matches: [] })),
      ]);
      const s = document.querySelector("#pool-status");
      const t = document.querySelector("#pool-tournaments");
      const m = document.querySelector("#pool-matches");
      if (s) s.textContent = JSON.stringify(status, null, 2);
      if (t) t.textContent = JSON.stringify(tournaments, null, 2);
      if (m) m.textContent = JSON.stringify(matches, null, 2);
    } catch (e) {
      toast('poolleague error: ' + errMsg(e), 'err');
    }
  };
  refresh();
  setInterval(refresh, 5000);
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
// ---------- (45) webhook management: search, pagination, delete, toggle, retry ----------
async function renderWebhooks() {
  crumb([["ForgeOS", "#/dashboard"], ["Webhooks", tooltip("Webhooks", "Outbound webhook management")]]);
  const list = await safe(() => api.listWebhooks()).catch(() => ({ webhooks: [], deadLetter: [] }));
  const webhooks = Array.isArray(list.webhooks) ? list.webhooks : [];
  const deadLetter = Array.isArray(list.deadLetter) ? list.deadLetter : [];

  const qp = new URLSearchParams(location.hash.split("?")[1] || "");
  const page = Number(qp.get("page") || "1");
  const searchQ = (qp.get("q") || "").toLowerCase();
  const dlqPage = Number(qp.get("dlq") || "1");

  function getFilteredWebhooks() {
    if (!searchQ) return webhooks;
    return webhooks.filter(w =>
      (w.url || "").toLowerCase().includes(searchQ) ||
      (w.events || []).some(e => (e || "").toLowerCase().includes(searchQ))
    );
  }

  const wp = paginate(getFilteredWebhooks(), page, 8);
  const dp = paginate(deadLetter, dlqPage, 8);

  const buildWebhookUrl = (extra) => {
    const qs = new URLSearchParams();
    if (searchQ) qs.set("q", searchQ);
    if (wp.page > 1) qs.set("page", wp.page);
    qs.set("dlq", dp.page);
    const base = "#/webhooks";
    return extra ? `${base}?${qs.toString()}&${extra}` : `${base}?${qs.toString()}`;
  };

  document.querySelector("main").innerHTML = `<h1>Webhooks</h1>
    <div class="card" style="margin-bottom:16px">
      <h3 data-tooltip="Register a new outbound webhook">Create Webhook</h3>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input id="wh-url" class="input" placeholder="https://example.com/hook" data-tooltip="Webhook target URL" style="flex:1;min-width:200px"/>
        <input id="wh-events" class="input" placeholder="mission.created,agent.completed" data-tooltip="Comma-separated event types to listen for" style="flex:1;min-width:200px"/>
        <input id="wh-secret" class="input" placeholder="optional secret" data-tooltip="Optional HMAC signing secret" style="flex:1;min-width:120px"/>
        <button class="btn primary" id="wh-create" data-tooltip="Create new webhook">Create</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <h2 data-tooltip="Active webhook registrations">Active Webhooks <span class="muted" style="font-size:12px">(${webhooks.length})</span></h2>
        <div class="row" style="gap:8px">
          <input id="wh-search" placeholder="Search by URL or event..." value="${DOMPurify.attributeValue(searchQ)}" data-tooltip="Filter active webhooks" style="padding:6px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:220px"/>
          <span class="pill" data-tooltip="Active webhook count">${webhooks.length} total</span>
          <span class="pill" data-tooltip="Filtered webhook count">${getFilteredWebhooks().length} shown</span>
        </div>
      </div>
      <div id="wh-list">
        ${wp.items.length ? wp.items.map(w => `<div class="card" style="margin-bottom:8px">
          <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="flex:1;min-width:200px">
              <b data-tooltip="Webhook target endpoint">${DOMPurify.sanitize(w.url || '')}</b>
              <span class="pill ${w.active ? 'ok' : 'warn'}" data-tooltip="${w.active ? 'Webhook is active and receiving events' : 'Webhook is paused — no events delivered'}"><span class="dot"></span>${w.active ? 'active' : 'paused'}</span>
            </div>
            <div class="row" style="gap:6px">
              <button class="btn secondary sm" data-toggle-webhook="${encodeURIComponent(w.url || '')}" data-tooltip="${w.active ? 'Pause this webhook' : 'Resume this webhook'}">${w.active ? '⏸ Pause' : '▶ Resume'}</button>
              <button class="btn secondary sm" data-retry-webhook="${encodeURIComponent(w.url || '')}" data-tooltip="Send a test event to this webhook">Test</button>
              <button class="btn secondary sm danger" data-delete-webhook="${encodeURIComponent(w.url || '')}" data-tooltip="Permanently delete this webhook">🗑 Delete</button>
            </div>
          </div>
          <p class="muted" style="margin-top:4px;font-size:12px" data-tooltip="Subscribed event types">${(w.events || []).map(e => `<span class="pill mono" style="font-size:10px;padding:1px 6px;margin:1px">${DOMPurify.sanitize(e)}</span>`).join(' ')}</p>
        </div>`).join("") : emptyState(searchQ ? "No matching webhooks" : "No active webhooks", searchQ ? "Try a different search" : "Create a webhook to get started")}
      </div>
      ${paginationControls(wp)}
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <h2 data-tooltip="Failed webhook deliveries awaiting manual retry">Dead Letter Queue <span class="muted" style="font-size:12px">(${deadLetter.length})</span></h2>
        <span class="pill" data-tooltip="Retryable failed deliveries">${deadLetter.length} failed</span>
      </div>
      <div id="dlq-list">
        ${dp.items.length ? dp.items.map(d => `<div class="card" style="margin-bottom:8px">
          <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <b data-tooltip="Dead-letter target or id">${DOMPurify.sanitize(d.url || d.id || 'unknown')}</b>
              <span class="pill bad" data-tooltip="This delivery failed"><span class="dot"></span>failed</span>
            </div>
            <button class="btn primary sm" data-retry-dlq="${encodeURIComponent(d.id || d.url || '')}" data-tooltip="Retry this failed delivery">↻ Retry</button>
          </div>
          <p class="muted" style="margin-top:4px;font-size:12px">${DOMPurify.sanitize(d.event || d.payload?.event || '')} — ${DOMPurify.sanitize(d.error || d.reason || 'failed')}</p>
        </div>`).join("") : emptyState("Dead letter queue is empty", "All webhook deliveries are succeeding")}
      </div>
      ${paginationControls(dp)}
    </div>`;

  const searchEl = $("#wh-search");
  if (searchEl) {
    searchEl.addEventListener("input", () => {
      const q = searchEl.value.trim();
      const qs = new URLSearchParams(location.hash.split("?")[1] || "");
      if (q) qs.set("q", q); else qs.delete("q");
      qs.set("page", "1");
      location.hash = `#/webhooks?${qs.toString()}`;
    });
  }

  $$("[data-toggle-webhook]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const url = decodeURIComponent(btn.dataset.toggleWebhook);
      await withLoading(btn, async () => {
        const r = await safe(() => api.toggleWebhook(url)).catch(() => ({ error: true }));
        if (r && !r.error) { toast("webhook toggled", "ok"); renderWebhooks(); }
        else toast("toggle failed", "err");
      });
    });
  });

  $$("[data-delete-webhook]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const url = decodeURIComponent(btn.dataset.deleteWebhook);
      if (!await confirmAction("Delete webhook", `Permanently delete webhook at ${DOMPurify.sanitize(url)}?`)) return;
      await safe(() => api.deleteWebhook(url)).catch(() => ({}));
      toast("webhook deleted", "ok");
      renderWebhooks();
    });
  });

  $$("[data-retry-webhook]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const url = decodeURIComponent(btn.dataset.retryWebhook);
      await withLoading(btn, async () => {
        const r = await safe(() => api.testWebhook(url)).catch(() => ({ ok: false }));
        toast(r && r.ok ? "test event sent" : "test failed", r && r.ok ? "ok" : "err");
      });
    });
  });

  $$("[data-retry-dlq]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = decodeURIComponent(btn.dataset.retryDlq);
      await withLoading(btn, async () => {
        const r = await safe(() => api.retryDlq(id)).catch(() => ({ ok: false }));
        toast(r && r.ok ? "retry queued" : "retry failed", r && r.ok ? "ok" : "err");
        if (r && r.ok) setTimeout(renderWebhooks, 800);
      });
    });
  });

  $$("#main [data-page]").forEach(b => {
    b.addEventListener("click", () => {
      const qs = new URLSearchParams(location.hash.split("?")[1] || "");
      const target = b.dataset.page;
      const isDlq = b.closest("#dlq-list") || b.closest(".pagination")?.closest("#dlq-list") ? true : false;
      if (isDlq) qs.set("dlq", target);
      else qs.set("page", target);
      location.hash = `#/webhooks?${qs.toString()}`;
    });
  });

  $("#wh-create")?.addEventListener("click", async () => {
    const url = $("#wh-url")?.value;
    const events = ($("#wh-events")?.value || "").split(",").map(s => s.trim()).filter(Boolean);
    const secret = $("#wh-secret")?.value;
    if (!url) { toast("url is required", "err"); return; }
    if (!events.length) { toast("at least one event is required", "err"); return; }
    await withLoading($("#wh-create"), async () => {
      const r = await safe(() => api.createWebhook(url, events, secret)).catch(() => ({ error: true }));
      if (r && !r.error) { toast("webhook created", "ok"); renderWebhooks(); }
      else toast("create failed", "err");
    });
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
const panelInit = new Set();
const panelCache = {};

function lazyPanel(fn, name) {
  return async function (...args) {
    if (!panelInit.has(name)) {
      panelInit.add(name);
      // One-time init hook.
      // In a build-step setup, swap for: const mod = await import(`./panels/${name}.js`);
      console.log(`[lazy] panel initialized: ${name}`);
    }
    return fn(...args);
  };
}

async function loadPanel(name) {
  if (panelCache[name]) return panelCache[name]();
  const renderKey = "render" + name.charAt(0).toUpperCase() + name.slice(1);
  const fn = window[renderKey] || window[name];
  if (!fn) return '<div class="card">Panel not found: ' + DOMPurify.sanitize(name) + '</div>';
  const html = await fn();
  return html;
}

// ---------- Offline capture queue (IndexedDB) ----------
function initOfflineIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'offline-indicator hidden';
  indicator.innerHTML = '<span class="dot offline"></span> offline — edits queued';
  document.body.appendChild(indicator);
  const update = () => indicator.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
initOfflineIndicator();

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
  { category: "Core", items: [
    ["Command Center", tooltip("Command Center", "Command Center overview"), "command"],
    ["Governance", tooltip("Governance", "View and manage ForgeOS governance"), "governance"],
    ["Dashboard", tooltip("Dashboard", "Console dashboard with system metrics"), "dashboard"],
  ]},
  { category: "Org & Decisions", items: [
    ["Roles", "roles"],
    ["Org", tooltip("Org", "Organization chart and structure"), "org"],
    ["Timeline", tooltip("Timeline", "Decision timeline and history"), "timeline"],
    ["Ledger", tooltip("Ledger", "Decision ledger with filters"), "ledger"],
    ["Decisions", tooltip("Decisions", "Decision management and tracking"), "decisions"],
  ]},
  { category: "Brain", items: [
    ["Search", tooltip("Search", "Search across brains and pages"), "search"],
    ["Capture", tooltip("Capture", "Capture and create new brain pages"), "capture"],
    ["Vault", "vault"],
    ["Embeddings", "embed"],
    ["Schema", tooltip("Schema", "Brain schema explorer"), "schema"],
  ]},
  { category: "Federation", items: [
    ["Federation", tooltip("Federation", "Cross-brain federation status"), "federation"],
    ["Audit", tooltip("Audit", "Audit log and compliance trail"), "audit"],
  ]},
  { category: "Agents & Automation", items: [
    ["Missions", tooltip("Missions", "Agent missions and dispatch"), "missions"],
    ["MCP", tooltip("MCP", "Model Context Protocol tools"), "mcp"],
    ["Workflows", tooltip("Workflows", "Agent workflow management"), "workflows"],
    ["Monitoring", tooltip("Monitoring", "Live agent and PoolLeague status"), "monitoring"],
    [tooltip("Delegation", "Delegate tasks to C-suite agents"), "delegation"],
  ]},
  { category: "Projects", items: [
    ["Projects", tooltip("Projects", "Project management and kanban"), "projects"],
    ["Wizard", tooltip("Wizard", "Setup wizard for first-time config"), "wizard"],
  ]},
  { category: "System", items: [
    ["Config", "config"],
    ["Marketplace", tooltip("Marketplace", "Browse discoverable agents"), "marketplace"],
    ["Plugins", tooltip("Plugins", "Manage console plugins"), "plugins"],
    ["Settings", tooltip("Settings", "Console settings and configuration"), "settings"],
  ]},
];

const _rawRoutes = {
  command: renderCommand, governance: renderGovernance, dashboard: renderDashboard, roles: renderRoles, org: renderOrg, timeline: renderTimeline, ledger: renderLedger,
  search: renderSearch, capture: renderCapture, decisions: renderDecisions, missions: renderMissions, mcp: renderMCP, vault: renderVault, vaultfile: renderVaultFile,
  embed: renderEmbed, federation: renderFederation, audit: renderAudit, schema: renderSchema, config: renderConfig,
  projects: renderProjects, wizard: renderWizard, monitoring: renderMonitoring, settings: renderSettings, workflows: renderWorkflows, marketplace: renderMarketplace, plugins: renderPlugins, webhooks: renderWebhooks, heartbeat: renderAgentHeartbeat, memory: renderMemoryPool, amendments: renderAmendments, sacred: renderSacred, processes: renderProcesses, portConflicts: renderPortConflicts, reload: renderReload, pluginManifest: renderPluginManifest, poolleague: renderPoolLeague,
};
const routes = {};
for (const [name, fn] of Object.entries(_rawRoutes)) {
  routes[name] = lazyPanel(fn, name);
}

// ---------- (50) per-panel error boundary ----------
async function guard(fn, slug) {
  try { await fn(slug); }
  catch (e) { errorBoundary(errMsg(e), () => fn(slug)); }
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
const KNOWN = new Set(["command","governance","dashboard","roles","org","timeline","ledger","search","capture","decisions","missions","mcp","vault","vaultfile","embed","federation","audit","schema","config","page","projects","wizard","settings","workflows","marketplace","plugins","webhooks","delegation"]);
// ---------- (10) favicon/title per panel ----------
const TITLES = { command:"Command Center", governance:"Governance", dashboard:"Console", roles:"Roles", org:"Org", timeline:"Timeline", ledger:"Decision Ledger", search:"Search", capture:"Capture", decisions:"Decisions", missions:"Missions", mcp:"MCP", vault:"Vault", vaultfile:"Vault", embed:"Embeddings", federation:"Federation", audit:"Audit", schema:"Schema", config:"Config", page:"Page", projects:"Projects", wizard:"Setup Wizard", settings:"Settings", workflows:"Workflows", marketplace:"Marketplace", plugins:"Plugins", delegation:"Delegation" };

// ---------- (11) restore last panel ----------
function lastPanel() { return localStorage.getItem("forgeos-last") || "command"; }

// ---------- (11b) active nav highlighting with scroll spy ----------
const SCROLL_PREFIX = "forgeos-scroll-";
const SCROLL_DEBOUNCE = 100;
let scrollSaveTimer = null;
let activePanel = lastPanel();

function getCurrentPanel() {
  return (location.hash.slice(2).split("/")[0] || lastPanel());
}

function savePanelScroll(panel) {
  const main = $("#main");
  if (!main) return;
  try { localStorage.setItem(SCROLL_PREFIX + panel, String(main.scrollTop)); } catch {}
}

function restorePanelScroll(panel) {
  const main = $("#main");
  if (!main) return;
  const saved = localStorage.getItem(SCROLL_PREFIX + panel);
  if (saved !== null) {
    requestAnimationFrame(() => {
      if ($("#main")) $("#main").scrollTop = Number(saved);
    });
  }
}

function setActiveNav(panel) {
  document.querySelectorAll(".sidebar a").forEach(a => a.classList.remove("active"));
  const navEl = document.querySelector(`.sidebar a[href="#/${panel}"]`);
  if (navEl) navEl.classList.add("active");
}

function updateActiveNavOnScroll() {
  const main = $("#main");
  if (!main) return;
  
  // Scroll spy: highlight sidebar link based on visible sections in main panel
  const sections = main.querySelectorAll("h1[id], h2[id], h3[id], section[id]");
  let activeId = null;
  
  for (const el of sections) {
    const rect = el.getBoundingClientRect();
    if (rect.top <= 120 && rect.bottom >= 0) {
      activeId = el.id;
      break;
    }
  }
  
  if (activeId) {
    const navEl = document.querySelector(`.sidebar a[href="#/${activeId}"]`);
    if (navEl) {
      setActiveNav(activeId);
      return;
    }
  }
  
  setActiveNav(getCurrentPanel());
}

function initScrollSpy() {
  const main = $("#main");
  if (!main) return;
  
  main.addEventListener("scroll", () => {
    const panel = getCurrentPanel();
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => savePanelScroll(panel), SCROLL_DEBOUNCE);
    updateActiveNavOnScroll();
  }, { passive: true });
}

async function route() {
  const newPanel = location.hash.slice(2).split("/")[0] || lastPanel();
  const parts = location.hash.slice(2).split("/");
  const panel = parts[0];
  
  // Save scroll of the panel we're leaving
  if (activePanel !== newPanel) savePanelScroll(activePanel);
  
  if (!KNOWN.has(panel)) {
    $("#main").innerHTML = empty("Unknown route: " + DOMPurify.sanitize(panel), `<a class="btn secondary" href="#/dashboard">Go home</a>`);
    document.title = "ForgeOS — 404";
    return;
  }
  
  localStorage.setItem("forgeos-last", panel);
  document.title = "ForgeOS — " + (TITLES[panel] || "Console");
  setActiveNav(panel);

  // Transition: fade/slide out current panel
  const main = $("#main");
  const hadContent = main.children.length > 0;
  if (hadContent) {
    main.classList.add("panel-exit");
    await sleep(140);
    main.classList.remove("panel-exit");
  }

  // Render new panel
  if (panel === "page") await guard(() => renderPage(parts[1]), parts[1]);
  else if (panel === "vaultfile") await guard(() => renderVaultFile(parts[1]), parts[1]);
  else await guard(routes[panel] || routes.dashboard);

  // Transition: fade/slide in new panel
  main.classList.add("panel-enter");
  requestAnimationFrame(() => requestAnimationFrame(() => main.classList.remove("panel-enter")));
  
  restorePanelScroll(panel);
  activePanel = panel;
}

// ---------- (27) command palette: fuzzy + arrows + history + tooltips ----------
const MAXHIST = 8;
function pushHist(h) {
  const raw = localStorage.getItem("forgeos-hist") || "[]";
  let a = JSON.parse(raw);
  if (a.length && typeof a[0] === 'string') a = a.map(p => ({ p, ts: 0 }));
  a = a.filter(e => e.p !== h);
  a.unshift({ p: h, ts: Date.now() });
  localStorage.setItem("forgeos-hist", JSON.stringify(a.slice(0, MAXHIST)));
}
const CMD_TIPS = {
  "command": "Command Center overview",
  "governance": "View and manage ForgeOS governance",
  "dashboard": "Console dashboard with system metrics",
  "roles": "Manage C-suite roles and permissions",
  "org": "Organization chart and structure",
  "timeline": "Decision timeline and history",
  "ledger": "Decision ledger with filters",
  "decisions": "Decision management and tracking",
  "search": "Search across brains and pages",
  "capture": "Capture and create new brain pages",
  "vault": "Vault file explorer",
  "embed": "Re-embed all knowledge",
  "schema": "Brain schema explorer",
  "federation": "Cross-brain federation status",
  "audit": "Audit log and compliance trail",
  "missions": "Agent missions and dispatch",
  "mcp": "Model Context Protocol tools",
  "workflows": "Agent workflow management",
  "monitoring": "Live agent and PoolLeague status",
  "projects": "Project management and kanban",
  "wizard": "Setup wizard for first-time config",
  "config": "Console configuration",
  "marketplace": "Browse discoverable agents",
  "plugins": "Manage console plugins",
  "settings": "Console settings and configuration",
  "delegation": "Delegate tasks to available C-suite agents",
};
const CMD_SHORTCUTS = {};
SHORTCUTS.forEach(([k, action]) => {
  NAV.flatMap(g => g.items).forEach((item) => {
    const [label] = item;
    if (label === action) {
      const p = item[2] || item[1];
      CMD_SHORTCUTS[p] = k;
    }
  });
});
NAV.flatMap(g => g.items).forEach((item, idx) => {
  if (idx < 9) {
    const p = item[2] || item[1];
    if (!CMD_SHORTCUTS[p]) CMD_SHORTCUTS[p] = String(idx + 1);
  }
});
const CMDS = NAV.flatMap(g => g.items).map((item) => {
  const [label, desc, path] = item;
  const p = path || desc;
  const tip = CMD_TIPS[p] || '';
  const shortcut = CMD_SHORTCUTS[p] || '';
  return { label, p, tip, shortcut, go: () => { pushHist(p); location.hash = "#/" + p; } };
});
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
function highlightMatch(text, q) {
  if (!q) return DOMPurify.sanitize(text);
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx === -1) return DOMPurify.sanitize(text);
  return DOMPurify.sanitize(text.slice(0, idx)) + `<mark>${DOMPurify.sanitize(text.slice(idx, idx + q.length))}</mark>` + highlightMatch(text.slice(idx + q.length), q);
}
function renderCmdk(q) {
  const ul = $("#cmdk ul");
  const hist = JSON.parse(localStorage.getItem("forgeos-hist") || "[]").map(h => typeof h === 'string' ? { p: h, ts: 0 } : h);
  const ql = q.toLowerCase();
  const opts = CMDS.filter(c => c.label.toLowerCase().includes(ql));
  const groups = {};
  const recent = [];
  for (const cmd of CMDS) {
    const label = cmd.label;
    const group = label.split(" ")[0] || "Other";
    if (!groups[group]) groups[group] = [];
    groups[group].push(cmd);
  }
  const histItems = q ? [] : hist.map(h => {
    const found = NAV.flatMap(g => g.items).find(n => (n[2] ?? n[1]) === h.p);
    const label = "↺ " + (found ? found[0] : h.p);
    const tsTip = h.ts ? `Last visited: ${new Date(h.ts).toLocaleString()}` : 'unknown';
    return { label, go: () => location.hash = "#/" + h.p, tip: tsTip };
  });
  let html = '';
  const all = q ? opts : opts.concat(histItems);
  if (q) {
    html = all.map((c, i) => {
      const tipAttr = c.tip ? ` data-tooltip="${DOMPurify.sanitize(c.tip)}"` : '';
      const badge = c.shortcut ? ` <span class="kbd">${c.shortcut}</span>` : '';
      return `<li data-i="${i}"${tipAttr}>${highlightMatch(c.label, q)}${badge}</li>`;
    }).join('');
  } else {
    html += '<li class="cmdk-group"><b>Recent</b></li>' + histItems.map((c, i) => {
      const tipAttr = c.tip ? ` data-tooltip="${DOMPurify.sanitize(c.tip)}"` : '';
      return `<li data-i="${i}"${tipAttr}>${DOMPurify.sanitize(c.label)}</li>`;
    }).join('');
    for (const [group, cmds] of Object.entries(groups)) {
      html += `<li class="cmdk-group"><b>${DOMPurify.sanitize(group)}</b></li>` + cmds.map((c, i) => {
        const tipAttr = c.tip ? ` data-tooltip="${DOMPurify.sanitize(c.tip)}"` : '';
        return `<li data-i="${i}"${tipAttr}>${DOMPurify.sanitize(c.label)}</li>`;
      }).join('');
    }
  }
  ul.innerHTML = html || `<li class="muted" data-tooltip="Try a different search term or press Esc to clear">no match</li>`;
  $$("#cmdk li").forEach((li, i) => li.addEventListener("click", () => { all[i] && all[i].go(); $("#cmdk").classList.remove("open"); }));
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
    const target = NAV.flatMap(g => g.items)[idx];
    if (target && !$("cmdk").classList.contains("open")) { e.preventDefault(); location.hash = "#/" + (target[2] ?? target[1]); }
  }
  // g + 1-9 quick goto
  if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "g") {
    const listener = (ev) => {
      if (ev.key >= "1" && ev.key <= "9") {
        const idx = Number(ev.key) - 1;
        const target = NAV.flatMap(g => g.items)[idx];
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

// =====================================================================
// BOOT DIAGNOSTICS & BLACK SCREEN FIX (1)
// =====================================================================
(function bootDiagnostics() {
  try {
    const t0 = performance.now();
    const appRoot = document.getElementById('app');
    const bootLog = [];
    bootLog.push('[BOOT] start app=' + !!appRoot + ' title=' + document.title);
    console.log('[BOOT] start app=' + !!appRoot + ' title=' + document.title);
    const origShell = window.shell;
    if (typeof origShell !== 'function') {
      throw new Error('shell() is not defined before route()');
    }
    origShell();
    const after = document.getElementById('app');
    const dt = Math.round(performance.now() - t0);
    bootLog.push('[BOOT] shell completed in ' + dt + 'ms children=' + (after ? after.children.length : 'null'));
    console.log('[BOOT] shell completed in ' + dt + 'ms children=' + (after ? after.children.length : 'null'));
    if (after && after.children.length === 0) {
      after.style.background = '#10131b';
      after.innerHTML = '<div style="padding:16px;color:#adc6ff;font-family:monospace">[BOOT] shell ran but #app is still empty. Check console.</div>';
      bootLog.push('[BOOT] fallback injected');
      console.warn('[BOOT] fallback injected');
    }
    safe(() => fetch('/api/health', { headers: { 'x-boot-log': encodeURIComponent(bootLog.join('\n')) } })).catch(() => {});
  } catch (e) {
    console.error('[BOOT] fatal:', e);
    const appRoot = document.getElementById('app');
    if (appRoot) {
      appRoot.style.background = '#10131b';
      appRoot.innerHTML = '<div style="padding:16px;color:#ffb4ab;font-family:monospace">Boot error: ' + DOMPurify.sanitize(e && e.message ? e.message : String(e)) + '</div>';
    }
  }
})();

// =====================================================================
// SYSTEM PREFERENCE SYNC (4)
// =====================================================================
(function syncSystemTheme() {
  const saved = localStorage.getItem('forgeos-theme');
  if (saved && saved !== 'system') return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const t = mq.matches ? 'dark' : 'light';
    applyTheme(t);
    const sel = document.querySelector('#s-theme');
    if (sel && document.activeElement !== sel) sel.value = 'system';
  };
  apply();
  mq.addEventListener('change', apply);
})();

// =====================================================================
// CROSS-AGENT MEMORY POOL (9)
// =====================================================================
const agentMemoryPool = {
  key: 'forgeos-agent-memory',
  add(agent, key, value) {
    const pool = JSON.parse(localStorage.getItem(this.key) || '{}');
    const entry = { agent, key, value, ts: Date.now() };
    const arr = pool[agent] || [];
    arr.push(entry);
    pool[agent] = arr.slice(-20);
    localStorage.setItem(this.key, JSON.stringify(pool));
  },
  recent(agent, limit = 10) {
    const pool = JSON.parse(localStorage.getItem(this.key) || '{}');
    return (pool[agent] || []).slice(-limit);
  },
  all(limit = 50) {
    const pool = JSON.parse(localStorage.getItem(this.key) || '{}');
    const out = [];
    for (const [agent, entries] of Object.entries(pool)) {
      entries.slice(-5).forEach(e => out.push({ agent, ...e }));
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, limit);
  }
};

// =====================================================================
// AGENT AUDIT TRAIL (10)
// =====================================================================
const agentAudit = {
  key: 'forgeos-agent-audit',
  log(entry) {
    const trail = JSON.parse(localStorage.getItem(this.key) || '[]');
    trail.unshift({ ...entry, id: crypto.randomUUID(), ts: Date.now() });
    localStorage.setItem(this.key, JSON.stringify(trail.slice(0, 500)));
  },
  recent(limit = 20) {
    return JSON.parse(localStorage.getItem(this.key) || '[]').slice(0, limit);
  }
};

// =====================================================================
// HUMAN-IN-THE-LOOP APPROVAL GATES (12)
// =====================================================================
const approvalQueue = {
  key: 'forgeos-approval-queue',
  enqueue(action) {
    const q = JSON.parse(localStorage.getItem(this.key) || '[]');
    q.unshift({ ...action, id: crypto.randomUUID(), status: 'pending', ts: Date.now() });
    localStorage.setItem(this.key, JSON.stringify(q.slice(0, 100)));
    return q[0];
  },
  resolve(id, approved) {
    const q = JSON.parse(localStorage.getItem(this.key) || '[]');
    const item = q.find(x => x.id === id);
    if (item) item.status = approved ? 'approved' : 'rejected';
    localStorage.setItem(this.key, JSON.stringify(q));
    return item;
  },
  pending() {
    return JSON.parse(localStorage.getItem(this.key) || '[]').filter(x => x.status === 'pending');
  }
};

// =====================================================================
// DECISION LEDGER SEARCH (15)
// =====================================================================
function searchLedger(query) {
  const q = (query || '').toLowerCase();
  const items = JSON.parse(localStorage.getItem('forgeos-ledger') || '[]');
  if (!q) return items;
  return items.filter(item => {
    const text = [item.title, item.decision, item.owner, item.topic, item.status, item.rfc].filter(Boolean).join(' ').toLowerCase();
    return text.includes(q);
  });
}

// =====================================================================
// SACRED FOLDER LOCK (16)
// =====================================================================
const sacredPaths = ['/governance', '/governance/constitution', '/governance/laws', '/governance/standards', '/governance/rfcs'];
function isSacredPath(pathname) {
  return sacredPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
}
function guardSacredWrite(operation) {
  if (isSacredPath(location.pathname)) {
    toast('Governance is immutable except by constitutional amendment', 'err');
    return false;
  }
  return operation();
}

// =====================================================================
// PORT CONFLICT PREVENTION (21)
// =====================================================================
function detectPort(port) {
  return fetch('http://127.0.0.1:' + port, { mode: 'no-cors', cache: 'no-store' }).then(() => true).catch(() => false);
}

// =====================================================================
// SOURCE-MAP-FRIENDLY BOOT LOGS (24)
// =====================================================================
function bootStack(message) {
  const err = new Error(message);
  if (err.stack) console.log('[BOOT][' + message + '] ' + err.stack.split('\n').slice(1, 3).join('\n'));
  else console.log('[BOOT][' + message + ']');
}

// =====================================================================
// REPO-AWARE AGENTS.MD ENFORCEMENT (25)
// =====================================================================
function enforceAgentsRules(change) {
  const forbidden = ['bun build', 'bun build ./'];
  const path = change.file || '';
  if (path.endsWith('AGENTS.md')) return true;
  if (forbidden.some(f => change.diff && change.diff.includes(f))) {
    toast('AGENTS.md forbids bun build in this env', 'err');
    return false;
  }
  if (path.includes('src/app.js') && change.diff && change.diff.includes('bun build')) {
    toast('AGENTS.md forbids build-step dependencies', 'err');
    return false;
  }
  return true;
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

// ---------- (56) status bar ----------
const STATUS_START = Date.now();
function tickStatusBar(s) {
  const clock = document.getElementById("sb-clock");
  const brain = document.getElementById("sb-brain");
  const ollama = document.getElementById("sb-ollama");
  const uptime = document.getElementById("sb-uptime");
  if (!clock || !brain || !ollama || !uptime) return;
  try {
    const now = new Date();
    clock.textContent = "EST " + now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {}
  const ok = !!(s && s.gbrain_health && s.gbrain_health.status === "ok");
  brain.textContent = "brain: " + (ok ? "ok" : "down");
  brain.className = "pill " + (ok ? "ok" : "err");
  const ollamaOk = !!(s && s.ollama && s.ollama.status === "ok");
  ollama.textContent = "ollama: " + (ollamaOk ? "ok" : "—");
  ollama.className = "pill " + (ollamaOk ? "ok" : "warn");
  const secs = Math.max(0, Math.floor((Date.now() - STATUS_START) / 1000));
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s2 = String(secs % 60).padStart(2, "0");
  uptime.textContent = "uptime " + h + ":" + m + ":" + s2;
}

// ===================== SHELL =====================
// (12) sidebar collapse (persisted) + (20) mobile hamburger
// Error boundary: catch uncaught errors and show fallback UI
window.addEventListener('error', (e) => {
  console.error('[BOUNDARY]', e.message, e.filename, e.lineno);
  const main = document.querySelector('main');
  if (main) main.innerHTML = '<div class="card"><h1 data-tooltip="Unexpected runtime failure">Runtime error</h1><pre>' + DOMPurify.sanitize(e.message) + '</pre><button class="btn" id="boundary-reload">Reload</button></div>';
  const btn = document.getElementById('boundary-reload');
  if (btn) btn.addEventListener('click', () => location.reload());
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[BOUNDARY] unhandled', e.reason);
  const main = document.querySelector('main');
  if (main) main.innerHTML = '<div class="card"><h1 data-tooltip="Unhandled async failure">Async error</h1><pre>' + DOMPurify.sanitize(String(e.reason)) + '</pre><button class="btn" id="boundary-reload">Reload</button></div>';
  const btn = document.getElementById('boundary-reload');
  if (btn) btn.addEventListener('click', () => location.reload());
});

function shell() {
  const theme = localStorage.getItem("forgeos-theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const collapsed = localStorage.getItem("forgeos-collapsed") === "1";
  const sidebar = NAV.map(g => {
    const cat = DOMPurify.sanitize(g.category);
    const items = g.items.map(([label, tip, p]) => `<a href="#/${p}" aria-label="${label}">${tip || label}</a>`).join("");
    return `<div class="nav-category">
      <nav class="nav-category-header" data-cat="${cat}" aria-expanded="false" role="button" tabindex="0" aria-label="Toggle ${cat} navigation">${cat}</nav>
      <div class="nav-category-items">${items}</div>
    </div>`;
  }).join("");
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
    <div class="status-bar" id="status-bar" role="contentinfo" aria-label="Status bar">
      <span id="sb-clock" class="mono"></span>
      <span class="pill" id="sb-brain">brain: —</span>
      <span class="pill" id="sb-ollama">ollama: —</span>
      <span class="pill" id="sb-uptime"></span>
    </div>
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
  window.addEventListener("hashchange", () => { savePanelScroll(activePanel); closeMobileMenu(); route(); });
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeMobileMenu(); });
  // collapsible nav categories
  $("#sidebar").addEventListener("click", (e) => {
    const header = e.target.closest(".nav-category-header");
    if (!header) return;
    const cat = header.dataset.cat;
    const el = header.parentElement;
    el.classList.toggle("collapsed");
    header.setAttribute("aria-expanded", el.classList.contains("collapsed") ? "false" : "true");
    try { localStorage.setItem("forgeos-nav-" + cat.toLowerCase().replace(/[^a-z0-9]+/g, "-"), el.classList.contains("collapsed") ? "1" : "0"); } catch {}
  });
  // restore collapsed state
  document.querySelectorAll(".nav-category").forEach(el => {
    const title = el.querySelector(".nav-category-header");
    if (!title) return;
    try { if (localStorage.getItem("forgeos-nav-" + title.dataset.cat.toLowerCase().replace(/[^a-z0-9]+/g, "-")) === "1") { el.classList.add("collapsed"); title.setAttribute("aria-expanded", "false"); } } catch {}
  });

  // (2) boot self-check
  if (!$("#app").children.length) $("#main").innerHTML = empty("Failed to load shell.");
  initScrollSpy();
  route();
  safe(() => api.status()).then(s => tickStatusBar(s || {})).catch(() => tickStatusBar({}));
  setInterval(async () => { tickStatusBar(await safe(() => api.status()).catch(() => ({}))); }, 1000);
}
try { shell(); } catch (e) { console.error('[BOOT] shell failed', e); const main = document.querySelector('main'); if (main) main.innerHTML = '<div class="card"><h1>Boot error</h1><pre>' + DOMPurify.sanitize(String(e)) + '</pre></div>'; }

// ---------- Keyboard shortcuts cheatsheet ----------
const SHORTCUTS = [
  { cat: "Navigation", items: [
    ["?", "Show shortcuts"],
    ["1-9", "Jump to nav item"],
    ["G then 1-9", "Quick goto panel"],
    ["Ctrl+K", "Command palette"],
    ["Esc", "Close dialogs"],
  ]},
  { cat: "Panels", items: [
    ["D", "Dashboard"],
    ["G", "Governance"],
    ["M", "Missions"],
    ["L", "Decision Ledger"],
    ["S", "Settings"],
  ]},
  { cat: "System", items: [
    ["Ctrl+Shift+R", "Hard reload"],
    ["Ctrl+Shift+I", "DevTools"],
  ]},
];
function showShortcuts() {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop open";
  modal.innerHTML = `<div class="modal" style="max-width:520px">
    <h2>Keyboard Shortcuts</h2>
    <div class="grid cols-2">
      ${SHORTCUTS.map(g => `<div style="margin-bottom:12px"><b>${g.cat}</b><ul style="margin:4px 0;padding-left:18px">${g.items.map(([k,desc]) => `<li><span class="kbd">${k}</span> ${desc}</li>`).join("")}</ul></div>`).join("")}
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="shortcuts-close">Close</button></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#shortcuts-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}
    ["Cmd/Ctrl + K", "Command palette"],
  ]},
  { cat: "Editing", items: [
    ["Esc", "Close modal / palette"],
    ["Cmd/Ctrl + /", "Focus search"],
    ["Ctrl+S / Cmd+S", "Save current editor"],
  ]},
  { cat: "View", items: [
    ["Click category", "Collapse / expand nav group"],
    ["?", "Toggle shortcuts"],
  ]},
];
function renderShortcuts() {
  const el = document.createElement('div');
  el.id = 'shortcuts-overlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:200;';
  const groups = SHORTCUTS.map(g => `<div class="card" style="margin-bottom:8px;">
    <h3 style="margin:0 0 6px;font-size:13px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em">${DOMPurify.sanitize(g.cat)}</h3>
    <table class="table" style="width:100%">
      ${g.items.map(([k,v]) => `<tr><td class="mono" style="width:140px">${DOMPurify.sanitize(k)}</td><td>${DOMPurify.sanitize(v)}</td></tr>`).join("")}
    </table>
  </div>`).join("");
  el.innerHTML = `
    <div class="card" style="max-width:560px;width:92%;max-height:82vh;overflow:auto;">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h2 style="margin:0">Keyboard Shortcuts</h2>
        <input id="shortcuts-filter" placeholder="Filter…" style="padding:6px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);width:160px;" />
      </div>
      <div id="shortcuts-body">${groups}</div>
      <div style="margin-top:10px;text-align:right;"><button class="btn secondary" id="close-shortcuts">Close</button></div>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el || e.target.id === 'close-shortcuts') close(); });
  const filter = document.getElementById('shortcuts-filter');
  if (filter) {
    filter.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('#shortcuts-body .card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
    setTimeout(() => filter.focus(), 0);
  }
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
}