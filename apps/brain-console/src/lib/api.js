// api.js — data client for the Brain Console backend (plain JS, no build step).

const DEFAULT_TIMEOUT_MS = 10000; // 10s
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;
const OFFLINE_QUEUE_KEY = 'brainConsoleOfflineQueue';
const MAX_QUEUE_SIZE = 50;

function getOfflineQueue() {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setOfflineQueue(queue) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function enqueueMutation(method, path, body) {
  const queue = getOfflineQueue();
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift(); // drop oldest when full
  }
  queue.push({
    id: generateId(),
    method,
    path,
    body,
    timestamp: Date.now(),
  });
  setOfflineQueue(queue);
}

export async function replayOfflineQueue() {
  const queue = getOfflineQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      await req(item.path, { method: item.method, body: item.body });
    } catch {
      remaining.push(item);
    }
  }
  setOfflineQueue(remaining);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    replayOfflineQueue().catch(() => {});
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function req(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Queue mutations when offline
  if (isMutation && typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueueMutation(method, path, opts.body);
    return { _queued: true };
  }

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const r = await fetch(path, {
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        ...opts,
      });

      clearTimeout(timeoutId);

      if (!r.ok) {
        const text = await r.text();
        const err = new Error(`HTTP ${r.status}: ${text}`);
        err.status = r.status;
        if (r.status >= 500 && attempt < MAX_RETRIES) {
          lastErr = err;
          await delay(Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS));
          continue;
        }
        throw err;
      }
      return r.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        err = new Error(`Request timeout after ${DEFAULT_TIMEOUT_MS}ms`);
      }
      const shouldRetry = attempt < MAX_RETRIES && (err.status >= 500 || err.name === 'AbortError' || err.message?.includes('fetch failed'));
      if (shouldRetry) {
        lastErr = err;
        await delay(Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS));
        continue;
      }
      throw lastErr || err;
    }
  }
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
  deletePage: (slug) =>
    req("/api/page/" + encodeURIComponent(slug), { method: "DELETE" }),
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
  ledgerSearch: (q) => req("/api/ledger/search?q=" + encodeURIComponent(q)),
  requestLog: (params) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") qs.set(k, v);
      }
    }
    const q = qs.toString();
    return req("/api/request-log" + (q ? "?" + q : ""));
  },
  requestLogClear: () => req("/api/request-log-clear", { method: "POST" }),
  compliance: () => req("/api/compliance"),
  plugins: () => req("/api/plugins"),
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
  listWebhooks: () => req("/api/webhooks"),
  createWebhook: (data) =>
    req("/api/webhooks", { method: "POST", body: JSON.stringify(data) }),
  get: (path) => req(path),
  post: (path, body, opts = {}) => req(path, { method: "POST", body: JSON.stringify(body), ...opts }),
  plugins: () => req("/api/plugins"),
  poollenueStatus: () => req("/api/poolleague/status"),
  poollenueTournaments: () => req("/api/poolleague/tournaments"),
  poollenueMatches: () => req("/api/poolleague/matches"),
  monitoringAgents: () => req("/api/agents"),
  requestLog: () => req("/api/request-log"),
  replayOfflineQueue,
};
