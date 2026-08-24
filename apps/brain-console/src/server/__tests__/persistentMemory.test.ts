/**
 * src/server/__tests__/persistentMemory.test.ts — Real tests for the disk-backed
 * agent memory store, including survival across a simulated process restart.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPersistentMemoryStore } from "../persistentMemory.js";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forgeos-mem-"));
}

test("set/get round-trips a value", () => {
  const dir = tmpDir();
  const store = createPersistentMemoryStore({ dir });
  store.set("agent:goal", { target: "ship" });
  assert.deepEqual(store.get("agent:goal"), { target: "ship" });
});

test("missing key returns undefined", () => {
  const dir = tmpDir();
  const store = createPersistentMemoryStore({ dir });
  assert.equal(store.get("nope"), undefined);
  assert.equal(store.has("nope"), false);
});

test("persists to disk and survives a new store instance (restart)", () => {
  const dir = tmpDir();
  const a = createPersistentMemoryStore({ dir });
  a.set("agent:lastRun", { ts: 123 });
  a.set("agent:state", { running: true });
  // Simulate restart: brand-new store pointed at the same file.
  const b = createPersistentMemoryStore({ dir });
  assert.deepEqual(b.get("agent:lastRun"), { ts: 123 });
  assert.deepEqual(b.get("agent:state"), { running: true });
  assert.equal(b.size(), 2);
});

test("delete removes the key and updates disk", () => {
  const dir = tmpDir();
  const a = createPersistentMemoryStore({ dir });
  a.set("k", 1);
  assert.equal(a.delete("k"), true);
  const b = createPersistentMemoryStore({ dir });
  assert.equal(b.get("k"), undefined);
});

test("expired entries are lazily skipped", () => {
  const dir = tmpDir();
  const store = createPersistentMemoryStore({ dir });
  store.set("short", "x", 10); // 10ms ttl
  assert.equal(store.has("short"), true);
  // Wait past TTL, then confirm it is gone.
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(store.has("short"), false);
      assert.equal(store.get("short"), undefined);
      resolve();
    }, 40);
  });
});

test("clear empties the store on disk", () => {
  const dir = tmpDir();
  const a = createPersistentMemoryStore({ dir });
  a.set("one", 1);
  a.set("two", 2);
  a.clear();
  const b = createPersistentMemoryStore({ dir });
  assert.equal(b.size(), 0);
});
