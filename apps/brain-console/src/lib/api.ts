// api.js — data client for the Brain Console backend (plain JS, no build step).
async function req(path, opts) {
  const r = await fetch(path, { headers: { "content-type": "application/json" }, ...opts });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HTTP ${r.status}: ${t}`);
  }
  return r.json();
}
export const api = {
  status: () => req("/api/status"),
  roles: () => req("/api/roles"),
  page: (slug) => req("/api/page/" + encodeURIComponent(slug)),
  search: (q) => req("/api/search?q=" + encodeURIComponent(q)),
  schema: () => req("/api/schema"),
  audit: () => req("/api/audit"),
  federation: () => req("/api/federation"),
  gov: () => req("/api/governance"),
  vault: () => req("/api/vault"),
  missions: () => req("/api/missions"),
  advanceMission: (id, data) =>
    req("/api/missions/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(data) }),
  dispatchAgent: (missionId, agent) =>
    req("/api/agent/dispatch", { method: "POST", body: JSON.stringify({ missionId, agent }) }),
  capture: (slug, type, body) =>
    req("/api/capture", { method: "POST", body: JSON.stringify({ slug, type, body }) }),
  embed: () => req("/api/embed", { method: "POST" }),
  timeline: () => req("/api/timeline"),
  ledger: (params) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") qs.set(k, v);
      }
    }
    const q = qs.toString();
    return req("/api/ledger" + (q ? "?" + q : ""));
  },
  org: () => req("/api/org"),
  // Phase 6 — auth / state / backup / metrics
  login: (username, password) =>
    req("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  state: () => req("/api/state"),
  saveState: (data) =>
    req("/api/state", { method: "POST", body: JSON.stringify(data) }),
  backup: () => req("/api/backup", { method: "POST" }),
  restore: (gzipB64) =>
    req("/api/restore", { method: "POST", body: JSON.stringify({ gzip: gzipB64 }) }),
  metrics: () => req("/api/metrics"),
  // Phase 7 — agent workflows / messaging / marketplace / metrics
  workflows: () => req("/api/agent/workflows"),
  createWorkflow: (data) =>
    req("/api/agent/workflows", { method: "POST", body: JSON.stringify(data) }),
  marketplace: () => req("/api/agent/marketplace"),
  sendMessage: (data) =>
    req("/api/agent/message", { method: "POST", body: JSON.stringify(data) }),
  messages: () => req("/api/agent/messages"),
  agentMetrics: () => req("/api/agent/metrics"),
  // Phase 8 — federation / webhooks / plugins
  remoteBrains: () => req("/api/federation/remote"),
  webhooks: () => req("/api/webhooks"),
  createWebhook: (data) =>
    req("/api/webhooks", { method: "POST", body: JSON.stringify(data) }),
  plugins: () => req("/api/plugins"),
};
