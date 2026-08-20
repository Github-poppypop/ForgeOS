/**
 * src/server/__tests__/auditExport.test.ts — Real tests for the audit export
 * module (auditExport.ts): SQL/JSON serialization, SQL quote escaping, and
 * reading a real audit log dir.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toSql, toJson, readAuditLog, exportAudit, type AuditEntry } from "../auditExport.js";

const sample: AuditEntry[] = [
  { ts: "2026-01-01T00:00:00Z", method: "GET", path: "/api/health", status: 200, ms: 3, ip: "1.2.3.4" },
  { ts: "2026-01-01T00:00:01Z", method: "POST", path: "/api/x'y", status: 500, ms: 12, ip: "5.6.7.8" },
];

test("toSql emits CREATE TABLE and one INSERT per entry, escaping quotes", () => {
  const sql = toSql(sample);
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS audit_log"), "has header");
  assert.ok(sql.includes("INSERT INTO audit_log VALUES"), "has inserts");
  assert.ok(sql.includes("/api/x''y"), "single quote escaped as ''");
  assert.ok(!sql.includes("/api/x'y"), "raw unescaped quote not present");
  assert.ok(sql.includes("200"), "status serialized");
});

test("toSql with empty input returns only the header", () => {
  assert.equal(toSql([]), "CREATE TABLE IF NOT EXISTS audit_log(ts TEXT, method TEXT, path TEXT, status INTEGER, ms INTEGER, ip TEXT);\n");
});

test("toJson round-trips entries", () => {
  const json = toJson(sample);
  const back = JSON.parse(json) as AuditEntry[];
  assert.equal(back.length, 2);
  assert.equal(back[1].path, "/api/x'y");
});

test("readAuditLog parses a real .jsonl file in a temp dir", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
  try {
    fs.writeFileSync(
      path.join(dir, "audit.jsonl"),
      `${JSON.stringify({ ts: "t1", method: "GET", path: "/a", status: 200, ms: 1, ip: "9.9.9.9" })}\n` +
      `${JSON.stringify({ ts: "t2", method: "POST", path: "/b", status: 201, ms: 2, ip: "8.8.8.8" })}\n`
    );
    const entries = await readAuditLog(dir);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].ip, "9.9.9.9");
    assert.equal(entries[1].status, 201);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readAuditLog returns [] for a missing dir", async () => {
  const entries = await readAuditLog(path.join(os.tmpdir(), "does-not-exist-audit-" + Date.now()));
  assert.deepEqual(entries, []);
});

test("exportAudit dispatches sql vs json", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-test2-"));
  try {
    fs.writeFileSync(
      path.join(dir, "audit.jsonl"),
      `${JSON.stringify({ ts: "t1", method: "GET", path: "/a", status: 200, ms: 1, ip: "1.1.1.1" })}\n`
    );
    const sql = await exportAudit("sql", dir);
    const json = await exportAudit("json", dir);
    assert.ok(sql.includes("CREATE TABLE"), "sql format");
    assert.ok(json.includes('"ip": "1.1.1.1"'), "json format");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
