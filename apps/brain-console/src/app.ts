// app.ts — ForgeOS Brain Console SPA
// Implements Part 2 (general app improvements) over /api/*.
import { api } from "./lib/api.ts";

type Panel = "dashboard" | "roles" | "org" | "search" | "capture" | "decisions" | "mcp" | "vault" | "embed" | "federation" | "audit" | "schema" | "config";

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const app = $("#app");

// ---------- toast (16) ----------
function toast(msg: string, kind: "ok" | "err" | "" = "") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------- loading btn (4) ----------
function withLoading(btn: HTMLButtonElement, fn: () => Promise<void>) {
  btn.disabled = true; btn.classList.add("loading");
  fn().catch(e => toast(String(e.message ?? e), "err"))
    .finally(() => { btn.disabled = false; btn.classList.remove("loading"); });
}

// ---------- breadcrumb (28) ----------
function crumb(items: [string, string?][]) {
  $("#crumb").innerHTML = items.map(([t, href]) =>
    href ? `<a href="${href}">${t}</a>` : `<span>${t}</span>`).join(" › ");
}

// ---------- empty state (15) ----------
const empty = (msg: string) => `<div class="empty">${msg}</div>`;

// ---------- panels ----------
async function renderDashboard() {
  crumb([["ForgeOS", "#/dashboard"], ["Console"]]);
  const s = await api.status().catch(() => null);
  const roles = await api.roles().catch(() => ({ roles: [] }));
  const healthPill = s?.gbrain_health?.status === "ok"
    ? `<span class="pill ok"><span class="dot"></span> brain ok</span>`
    : `<span class="pill bad"><span class="dot"></span> brain down</span>`;
  const ollamaPill = s?.ollama
    ? `<span class="pill ok"><span class="dot"></span> ollama</span>`
    : `<span class="pill bad"><span class="dot"></span> ollama off</span>`;
  $("#main").innerHTML = `
    <h1>Brain Console</h1>
    <div class="row" style="margin-bottom:24px">
      ${healthPill} ${ollamaPill}
      <span class="pill"><span class="dot"></span> ${s?.embedding_model ?? "—"}</span>
      <span class="pill">pack ${((s?.schema ?? "").match(/forgeos/) ? "forgeos" : "—")}</span>
    </div>
    <div class="grid cols-3">
      <div class="card"><h2>Isolation</h2><p class="muted mono">${s?.isolation ?? "—"}</p></div>
      <div class="card"><h2>Roles seeded</h2><p style="font-size:32px;font-weight:800">${roles.roles.filter((r:any)=>r.exists).length}/7</p></div>
      <div class="card"><h2>Console port</h2><p class="mono">${s?.console_port ?? "—"}</p><p class="muted">gbrain MCP :${s?.gbrain_internal_port}</p></div>
    </div>`;
}

async function renderRoles() {
  crumb([["ForgeOS", "#/dashboard"], ["Roles"]]);
  const { roles } = await api.roles();
  $("#main").innerHTML = `<h1>C-Suite Roles</h1>
    <div class="grid cols-2">
      ${roles.map(r => `
        <div class="card">
          <div class="row" style="justify-content:space-between">
            <h2>${r.role ?? r.slug}</h2>
            <span class="pill ${r.exists ? "ok" : "bad"}"><span class="dot"></span>${r.exists ? "seeded" : "missing"}</span>
          </div>
          <p class="muted mono">${r.slug}</p>
          <p class="muted">reports_to: ${r.reports_to ?? "—"}</p>
          <button class="btn secondary" data-role="${r.slug}">View page</button>
        </div>`).join("")}
    </div>`;
  $("#main").querySelectorAll("[data-role]").forEach(b =>
    b.addEventListener("click", () => location.hash = "#/page/" + encodeURIComponent((b as HTMLElement).dataset.role!)));
}

async function renderPage(slug: string) {
  crumb([["ForgeOS", "#/dashboard"], ["Roles", "#/roles"], [slug]]);
  const p = await api.page(slug).catch(() => null);
  if (!p) { $("#main").innerHTML = empty("Page not found in brain."); return; }
  $("#main").innerHTML = `<h1 class="mono">${slug}</h1>
    <pre class="code json">${escapeHtml(p.body)}</pre>`;
}

async function renderOrg() {
  crumb([["ForgeOS", "#/dashboard"], ["Org chart"]]);
  const { roles } = await api.roles();
  const node = (r: any) => `<div class="card" style="margin:8px 0"><b>${r.role ?? r.slug}</b><br><span class="muted mono">${r.slug}</span><br><span class="muted">↑ ${r.reports_to ?? "—"}</span></div>`;
  const ceo = roles.find((r:any)=>r.slug==="exec/ceo");
  $("#main").innerHTML = `<h1>Org Chart (from reports_to)</h1>
    <div style="max-width:480px">
      ${node(roles.find((r:any)=>r.slug==="board/board"))}
      ${node(ceo)}
      <div class="grid cols-2">${roles.filter((r:any)=>r.slug!=="board/board"&&r.slug!=="exec/ceo").map(node).join("")}</div>
    </div>`;
}

async function renderSearch() {
  crumb([["ForgeOS", "#/dashboard"], ["Search"]]);
  $("#main").innerHTML = `<h1>Semantic Search</h1>
    <div class="row">
      <input id="q" class="mono" style="flex:1;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/>
      <button class="btn primary" id="go">Search</button>
    </div>
    <div id="res" style="margin-top:16px"></div>`;
  const run = () => withLoading($("#go") as HTMLButtonElement, async () => {
    const q = ($("#q") as HTMLInputElement).value.trim();
    if (!q) return;
    const r = await api.search(q);
    $("#res").innerHTML = `<pre class="code json">${escapeHtml(JSON.stringify(r, null, 2))}</pre>`;
  });
  $("#go").addEventListener("click", run);
  ($("#q") as HTMLInputElement).addEventListener("keydown", e => { if (e.key === "Enter") run(); });
}

async function renderCapture() {
  crumb([["ForgeOS", "#/dashboard"], ["Capture"]]);
  $("#main").innerHTML = `<h1>Capture Page</h1>
    <div class="card" style="max-width:640px">
      <div class="row"><label>slug</label><input id="slug" class="mono" value="decisions/demo" style="flex:1;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      <div class="row" style="margin-top:8px"><label>type</label><input id="type" value="note" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)"/></div>
      <textarea id="body" rows="8" style="width:100%;margin-top:8px;padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono)"># Demo\nWrite something for the brain.</textarea>
      <button class="btn primary" id="cap" style="margin-top:8px">Capture</button>
    </div>`;
  ($("#cap") as HTMLButtonElement).addEventListener("click", () => withLoading($("#cap") as HTMLButtonElement, async () => {
    const r = await api.capture(($("#slug") as HTMLInputElement).value, ($("#type") as HTMLInputElement).value, ($("#body") as HTMLTextAreaElement).value);
    toast(r.err ? "capture failed" : "captured " + ($("#slug") as HTMLInputElement).value, r.err ? "err" : "ok");
  }));
}

async function renderDecisions() {
  crumb([["ForgeOS", "#/dashboard"], ["Decisions / Incidents"]]);
  $("#main").innerHTML = `<h1>Decisions & Incidents</h1>
    <div class="card"><p class="muted">Use <b>Capture</b> with slug <span class="mono">decisions/…</span> or <span class="mono">incidents/…</span>. Each opens an <span class="mono">incident</span> page before remediation per COO policy.</p>
    <a class="link" href="#/capture">Go to Capture →</a></div>`;
}

async function renderMCP() {
  crumb([["ForgeOS", "#/dashboard"], ["MCP"]]);
  $("#main").innerHTML = `<h1>MCP / Agent Tools</h1>
    <div class="card"><p class="muted">The brain exposes an MCP endpoint at <span class="mono">/mcp</span> (POST), proxied from internal gbrain port. Agent runtimes connect here.</p>
    <button class="btn secondary" id="probe">Probe /health</button><pre id="h" class="code json" style="margin-top:12px"></pre></div>`;
  ($("#probe") as HTMLButtonElement).addEventListener("click", () => withLoading($("#probe") as HTMLButtonElement, async () => {
    const r = await fetch("/health").then(r => r.json());
    $("#h").textContent = JSON.stringify(r, null, 2);
  }));
}

async function renderVault() {
  crumb([["ForgeOS", "#/dashboard"], ["Vault"]]);
  const v = await api.vault().catch(() => ({ files: [], git: "—" }));
  $("#main").innerHTML = `<h1>Obsidian Vault Sync</h1>
    <div class="card"><p class="muted">Mirror at <span class="mono">C:\\ForgeOS\\vault</span> — git: ${v.git}</p>
    <ul>${v.files.map((f:string)=>`<li class="mono">${f}</li>`).join("") || "<li class='muted'>no files</li>"}</ul></div>`;
}

async function renderEmbed() {
  crumb([["ForgeOS", "#/dashboard"], ["Embeddings"]]);
  $("#main").innerHTML = `<h1>Embedding Admin</h1>
    <div class="card"><p class="muted">Local Ollama <span class="mono">mxbai-embed-large</span> (1024d). Re-embed after captures.</p>
    <button class="btn primary" id="re">Re-embed all</button><pre id="o" class="code json" style="margin-top:12px"></pre></div>`;
  ($("#re") as HTMLButtonElement).addEventListener("click", () => withLoading($("#re") as HTMLButtonElement, async () => {
    const r = await api.embed();
    $("#o").textContent = r.out + "\n" + r.err;
    toast("re-embed done", "ok");
  }));
}

async function renderFederation() {
  crumb([["ForgeOS", "#/dashboard"], ["Federation"]]);
  const f = await api.federation();
  $("#main").innerHTML = `<h1>Brain Federation</h1><pre class="json">${escapeHtml(JSON.stringify(f, null, 2))}</pre>`;
}

async function renderAudit() {
  crumb([["ForgeOS", "#/dashboard"], ["Audit"]]);
  const a = await api.audit().catch(() => ({ raw: "" }));
  $("#main").innerHTML = `<h1>Audit Trail</h1><pre class="json">${escapeHtml(a.raw || "—")}</pre>`;
}

async function renderSchema() {
  crumb([["ForgeOS", "#/dashboard"], ["Schema"]]);
  const s = await api.schema().catch(() => ({ active: "", types: "" }));
  $("#main").innerHTML = `<h1>Schema Pack</h1>
    <h2>Active</h2><pre class="json">${escapeHtml(s.active)}</pre>
    <h2>Types</h2><pre class="json">${escapeHtml(s.types || "—")}</pre>`;
}

function renderConfig() {
  crumb([["ForgeOS", "#/dashboard"], ["Config"]]);
  const theme = localStorage.getItem("forgeos-theme") ?? "dark";
  $("#main").innerHTML = `<h1>Environment</h1>
    <div class="card"><p class="muted">Isolated brain env (set in <span class="mono">C:\\ForgeOS\\serve.sh</span>):</p>
    <ul class="mono">
      <li>GBRAIN_HOME = C:\\ForgeOS</li>
      <li>OLLAMA_BASE_URL = http://localhost:11434/v1</li>
      <li>GBRAIN_EMBEDDING_DIMENSIONS = 1024</li>
      <li>DATABASE_URL = (unset — Postgres pool breaks PGLite)</li>
    </ul>
    <div class="row" style="margin-top:12px"><label>Theme</label>
      <select id="theme" style="padding:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text)">
        <option value="dark" ${theme==="dark"?"selected":""}>dark</option>
        <option value="light" ${theme==="light"?"selected":""}>light</option>
      </select>
      <button class="btn secondary" id="apply">Apply (persists)</button>
    </div></div>`;
  ($("#apply") as HTMLButtonElement).addEventListener("click", () => {
    const t = ($("#theme") as HTMLSelectElement).value;
    localStorage.setItem("forgeos-theme", t); // (24/theme persistence)
    document.documentElement.setAttribute("data-theme", t);
    toast("theme saved", "ok");
  });
}

// ---------- router ----------
const routes: Record<Panel, () => Promise<void>> = {
  dashboard: renderDashboard, roles: renderRoles, org: renderOrg, search: renderSearch,
  capture: renderCapture, decisions: renderDecisions, mcp: renderMCP, vault: renderVault,
  embed: renderEmbed, federation: renderFederation, audit: renderAudit, schema: renderSchema, config: renderConfig,
};

const NAV: [string, Panel][] = [
  ["Dashboard", "dashboard"], ["Roles", "roles"], ["Org chart", "org"], ["Search", "search"],
  ["Capture", "capture"], ["Decisions", "decisions"], ["MCP", "mcp"], ["Vault", "vault"],
  ["Embeddings", "embed"], ["Federation", "federation"], ["Audit", "audit"], ["Schema", "schema"], ["Config", "config"],
];

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

async function route() {
  const hash = location.hash.slice(2) || "dashboard";
  const [panel, arg] = hash.split("/");
  // active nav
  document.querySelectorAll(".sidebar a").forEach(a => a.classList.remove("active"));
  const navEl = document.querySelector(`.sidebar a[href="#/${panel}"]`);
  navEl?.classList.add("active");
  try {
    if (panel === "page" && arg) return await renderPage(decodeURIComponent(arg));
    const fn = routes[panel as Panel] ?? routes.dashboard;
    await fn();
  } catch (e: any) {
    // (26) error boundary
    $("#main").innerHTML = `<div class="card"><h2>Error</h2><pre class="json">${escapeHtml(String(e.message ?? e))}</pre></div>`;
  }
}

// ---------- command palette (27) ----------
const CMDS = NAV.map(([label, p]) => ({ label, go: () => location.hash = "#/" + p }));
function openCmdk() {
  const el = $("#cmdk"); el.classList.add("open");
  const inp = el.querySelector("input") as HTMLInputElement; inp.value = ""; inp.focus();
  const ul = el.querySelector("ul")!; ul.innerHTML = CMDS.map(c => `<li>${c.label}</li>`).join("");
  ul.querySelectorAll("li").forEach((li, i) => li.addEventListener("click", () => { CMDS[i].go(); el.classList.remove("open"); }));
}
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openCmdk(); }
  if (e.key === "Escape") { $("#cmdk").classList.remove("open"); }
});

// ---------- sidebar + shell ----------
function shell() {
  const theme = localStorage.getItem("forgeos-theme") ?? "dark";
  document.documentElement.setAttribute("data-theme", theme); // (24)
  const sidebar = NAV.map(([label, p]) => `<a href="#/${p}">${label}</a>`).join("");
  $("#app").innerHTML = `
    <div class="navbar">
      <span class="wordmark">Forge<span class="os">OS</span> Console</span>
      <button class="btn secondary tip" data-tip="Command palette (⌘K)" id="cmdkbtn">⌘K</button>
      <span class="spacer"></span>
      <span class="pill ok"><span class="dot"></span> brain: owned</span>
    </div>
    <div class="layout">
      <aside class="sidebar">${sidebar}</aside>
      <main class="main" id="main"></main>
    </div>
    <div class="breadcrumb" id="crumb"></div>
    <div class="toasts" id="toasts"></div>
    <div class="cmdk" id="cmdk"><input placeholder="Jump to…"/><ul></ul></div>`;
  $("#cmdkbtn").addEventListener("click", openCmdk);
  window.addEventListener("hashchange", route);
  route();
}
shell();
