// api.ts — data client for the Brain Console backend.
async function req(path: string, opts?: RequestInit) {
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
  page: (slug: string) => req("/api/page/" + encodeURIComponent(slug)),
  search: (q: string) => req("/api/search?q=" + encodeURIComponent(q)),
  schema: () => req("/api/schema"),
  audit: () => req("/api/audit"),
  federation: () => req("/api/federation"),
  vault: () => req("/api/vault"),
  capture: (slug: string, type: string, body: string) =>
    req("/api/capture", { method: "POST", body: JSON.stringify({ slug, type, body }) }),
  embed: () => req("/api/embed", { method: "POST" }),
};
