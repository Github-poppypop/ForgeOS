/**
 * src/server/__tests__/csp-enforce.test.ts — Real tests for the CSP-enforcement
 * violation telemetry (capture + persistence + retention pruning). Uses a temp
 * log dir via FORGEOS_CSP_LOG_DIR so it never touches the real logs/. The env
 * must be set BEFORE the module loads (it reads CSP_LOG_DIR at import time),
 * so we import dynamically after setting it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let mod: typeof import("../features/feat-csp-enforce.js");
let importSeq = 0;

function freshTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "csp-test-"));
  process.env.FORGEOS_CSP_LOG_DIR = dir;
  return dir;
}

// The module captures CSP_LOG_DIR at import time, so each test needs a FRESH
// module instance pointed at its own temp dir. Cache-bust with a unique query.
async function loadModule(): Promise<typeof import("../features/feat-csp-enforce.js")> {
  importSeq += 1;
  return (await import(`../features/feat-csp-enforce.js?v=${importSeq}`)) as typeof import("../features/feat-csp-enforce.js");
}

test("recordCspViolation persists and is readable", async () => {
  const dir = freshTmpDir();
  mod = await loadModule();
  try {
    const v = mod.recordCspViolation({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "evil.com" } });
    assert.ok(v.ts, "entry is stamped with ts");
    const recent = mod.readPersistedViolations();
    assert.equal(recent.length, 1);
    const report = (recent[0] as any)["csp-report"];
    assert.equal(report["blocked-uri"] ?? report.blockedURI, "evil.com");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.FORGEOS_CSP_LOG_DIR;
  }
});

test("readPersistedViolations returns newest first, capped by limit", async () => {
  const dir = freshTmpDir();
  mod = await loadModule();
  try {
    for (let i = 0; i < 5; i++) mod.recordCspViolation({ n: i });
    const all = mod.readPersistedViolations(50);
    assert.equal(all.length, 5);
    // newest first: the last recorded (n=4) should be first.
    assert.equal((all[0] as any).n, 4);
    const capped = mod.readPersistedViolations(2);
    assert.equal(capped.length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.FORGEOS_CSP_LOG_DIR;
  }
});

test("pruneCspLogs removes files older than the retention window", async () => {
  const dir = freshTmpDir();
  mod = await loadModule();
  try {
    const oldDay = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    fs.writeFileSync(path.join(dir, `csp-violations-${oldDay}.jsonl`), `${JSON.stringify({ stale: true })}\n`);
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(dir, `csp-violations-${today}.jsonl`), `${JSON.stringify({ fresh: true })}\n`);

    const removed = mod.pruneCspLogs();
    assert.equal(removed, 1);
    assert.ok(!fs.existsSync(path.join(dir, `csp-violations-${oldDay}.jsonl`)), "stale file removed");
    assert.ok(fs.existsSync(path.join(dir, `csp-violations-${today}.jsonl`)), "fresh file kept");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.FORGEOS_CSP_LOG_DIR;
  }
});
