/**
 * src/lib/__tests__/api-offline-queue.test.ts — Real tests for the client data
 * layer's offline-queue durability (src/lib/api.ts): replaying queued mutations
 * drains the queue on success and keeps failures for next time.
 *
 * No network: fetch is stubbed and a minimal localStorage polyfill stands in
 * for the browser global, so this exercises the real queue logic offline.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage polyfill (browser global absent under tsx/Node).
class MemStorage {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? (this.store.get(k) as string) : null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

let fetchCalls: any[] = [];
function installGlobals() {
  (globalThis as any).localStorage = new MemStorage();
  fetchCalls = [];
  (globalThis as any).fetch = async (path: string, opts: any) => {
    fetchCalls.push({ path, opts });
    // default: success with empty JSON
    return { ok: true, status: 200, json: async () => ({}) } as any;
  };
}

async function loadApi() {
  return (await import("../api.ts")) as typeof import("../api.ts");
}

function seedQueue(items: any[]) {
  (globalThis as any).localStorage.setItem("brainConsoleOfflineQueue", JSON.stringify(items));
}

test("replayOfflineQueue drains the queue when every mutation succeeds", async () => {
  installGlobals();
  seedQueue([
    { id: "a", method: "POST", path: "/api/x", body: { v: 1 }, timestamp: 1 },
    { id: "b", method: "PUT", path: "/api/y", body: { v: 2 }, timestamp: 2 },
  ]);
  const { replayOfflineQueue } = await loadApi();
  await replayOfflineQueue();
  assert.equal(fetchCalls.length, 2, "both mutations replayed");
  const remaining = JSON.parse((globalThis as any).localStorage.getItem("brainConsoleOfflineQueue") || "[]");
  assert.equal(remaining.length, 0, "queue emptied after success");
});

test("replayOfflineQueue keeps mutations whose request fails", async () => {
  installGlobals();
  // Make the second mutation fail.
  (globalThis as any).fetch = async (path: string) => {
    if (path === "/api/y") throw new Error("network down");
    return { ok: true, status: 200, json: async () => ({}) } as any;
  };
  seedQueue([
    { id: "a", method: "POST", path: "/api/x", body: {}, timestamp: 1 },
    { id: "b", method: "PUT", path: "/api/y", body: {}, timestamp: 2 },
  ]);
  const { replayOfflineQueue } = await loadApi();
  await replayOfflineQueue();
  const remaining = JSON.parse((globalThis as any).localStorage.getItem("brainConsoleOfflineQueue") || "[]");
  assert.equal(remaining.length, 1, "failed mutation retained");
  assert.equal(remaining[0].id, "b", "the failed one is kept");
});

test("replayOfflineQueue is a no-op on an empty queue", async () => {
  installGlobals();
  seedQueue([]);
  const { replayOfflineQueue } = await loadApi();
  await replayOfflineQueue();
  assert.equal(fetchCalls.length, 0, "nothing fetched for empty queue");
});
