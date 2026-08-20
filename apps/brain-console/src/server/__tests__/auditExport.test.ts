import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAuditLog, toCsv, toJson, toSql, exportAudit } from '../auditExport';
import { createRuntime } from '../runtime';

function makeTempLogDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeos-audit-'));
  const line = JSON.stringify({
    ts: '2026-01-01T00:00:00.000Z',
    level: 'info',
    event: 'request',
    method: 'GET',
    path: '/api/health',
    status: 200,
    ms: 5,
    ip: '127.0.0.1',
  });
  fs.writeFileSync(path.join(dir, 'forgeos-2026-01-01.log'), `${line}\n`);
  return dir;
}

describe('auditExport helpers', () => {
  it('reads forgeos-<date>.log structured request logs', async () => {
    const dir = makeTempLogDir();
    try {
      const entries = await readAuditLog(dir);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].method, 'GET');
      assert.strictEqual(entries[0].path, '/api/health');
      assert.strictEqual(entries[0].status, 200);
      assert.strictEqual(entries[0].ms, 5);
      assert.strictEqual(entries[0].ip, '127.0.0.1');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns [] when the log dir does not exist', async () => {
    const entries = await readAuditLog(path.join(os.tmpdir(), 'does-not-exist-xyz'));
    assert.deepStrictEqual(entries, []);
  });

  it('toCsv emits a header row and one row per entry', async () => {
    const dir = makeTempLogDir();
    try {
      const entries = await readAuditLog(dir);
      const csv = toCsv(entries);
      const lines = csv.trim().split('\n');
      assert.strictEqual(lines[0], 'ts,method,path,status,ms,ip');
      assert.ok(lines[1].startsWith('2026-01-01T00:00:00.000Z,GET,/api/health,200,5,127.0.0.1'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('toCsv quotes fields containing commas', () => {
    const csv = toCsv([{ ts: 't', method: 'G,E,T', path: 'p', status: 1, ms: 2, ip: 'i' }]);
    assert.ok(csv.includes('"G,E,T"'));
  });

  it('toJson returns a JSON array', async () => {
    const dir = makeTempLogDir();
    try {
      const entries = await readAuditLog(dir);
      const parsed = JSON.parse(toJson(entries));
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].method, 'GET');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('toSql emits CREATE TABLE and INSERT statements', async () => {
    const dir = makeTempLogDir();
    try {
      const entries = await readAuditLog(dir);
      const sql = toSql(entries);
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS audit_log'));
      assert.ok(sql.includes("INSERT INTO audit_log VALUES ('2026-01-01T00:00:00.000Z', 'GET', '/api/health', 200, 5, '127.0.0.1');"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exportAudit supports csv|json|sql', async () => {
    const dir = makeTempLogDir();
    try {
      assert.ok((await exportAudit('csv', dir)).startsWith('ts,method'));
      assert.ok((await exportAudit('json', dir)).trim().startsWith('['));
      assert.ok((await exportAudit('sql', dir)).includes('CREATE TABLE'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/audit/export (runtime router)', () => {
  async function startServer(): Promise<{ server: http.Server; port: number; close: () => Promise<void> }> {
    const app = express();
    const router = await createRuntime();
    app.use(router);
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    return {
      server,
      port,
      close: () => new Promise<void>((res) => server.close(() => res())),
    };
  }

  it('returns csv/json/sql with content-disposition for each format', async () => {
    const dir = makeTempLogDir();
    process.env.FORGEOS_AUDIT_LOG_DIR = dir;
    const { server, port, close } = await startServer();
    try {
      for (const fmt of ['csv', 'json', 'sql'] as const) {
        const res = await fetch(`http://127.0.0.1:${port}/api/audit/export?format=${fmt}`);
        assert.strictEqual(res.status, 200, `format ${fmt} should be 200`);
        const disp = res.headers.get('content-disposition') ?? '';
        assert.ok(disp.includes('attachment'), `format ${fmt} should attach`);
        assert.ok(disp.includes(`audit-export.${fmt}`), `format ${fmt} filename`);
        const body = await res.text();
        if (fmt === 'csv') assert.ok(body.startsWith('ts,method'));
        if (fmt === 'json') assert.ok(body.trim().startsWith('['));
        if (fmt === 'sql') assert.ok(body.includes('CREATE TABLE'));
      }
    } finally {
      delete process.env.FORGEOS_AUDIT_LOG_DIR;
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects an invalid format with 400', async () => {
    const dir = makeTempLogDir();
    process.env.FORGEOS_AUDIT_LOG_DIR = dir;
    const { server, port, close } = await startServer();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/audit/export?format=xml`);
      assert.strictEqual(res.status, 400);
    } finally {
      delete process.env.FORGEOS_AUDIT_LOG_DIR;
      await close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
