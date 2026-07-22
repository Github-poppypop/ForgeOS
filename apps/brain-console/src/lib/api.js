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
  capture: (slug, type, body) =>
    req("/api/capture", { method: "POST", body: JSON.stringify({ slug, type, body }) }),
  embed: () => req("/api/embed", { method: "POST" }),
};
