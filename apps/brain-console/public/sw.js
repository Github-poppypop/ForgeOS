// public/sw.js — ForgeOS Brain Console service worker
// Caches the app shell and intercepts API responses for offline mode.
const CACHE = "forgeos-shell-v6";
const API_CACHE = "forgeos-api-v6";
const SHELL = [
  "/",
  "/index.html",
  "/src/app.v5.js",
  "/src/styles/design.css",
  "/favicon.ico",
  "/governance-git.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API requests: network-first, fall back to cache, then offline stub
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(API_CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => {
          return caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ offline: true, message: "You are offline. This data is from cache." }), {
              headers: { "content-type": "application/json" },
            });
          });
        })
    );
    return;
  }
  // Navigation / HTML: network-first so index.html stays fresh
  if (e.request.mode === "navigate" || new URL(e.request.url).pathname === "/" || new URL(e.request.url).pathname.endsWith("/index.html")) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then((cached) => cached || new Response("offline", { status: 503 })))
    );
    return;
  }
  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        return caches.match(e.request).then((cached) => cached || new Response("offline", { status: 503 }));
      });
    })
  );
});
