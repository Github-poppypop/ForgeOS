import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';

// Isolate persistence to a temp dir BEFORE importing the feature module.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'forgeos-csp-'));
process.env.FORGEOS_CSP_LOG_DIR = TMP;

const express = (await import('express')).default;
const mod = await import('../src/server/features/feat-csp-enforce.ts');
const registerCspEnforce = mod.default as (r: unknown) => void;
const { readPersistedViolations, pruneCspLogs, recordCspViolation } = mod as unknown as {
  readPersistedViolations: (n?: number) => Array<Record<string, unknown>>;
  pruneCspLogs: (now?: number) => number;
  recordCspViolation: (r: Record<string, unknown>) => Record<string, unknown>;
};

let base = '';
let server: ReturnType<ReturnType<typeof express>['listen']>;

describe('apps/brain-console/feat-csp-enforce.ts', () => {
  before(async () => {
    const app = express();
    const router = express.Router();
    registerCspEnforce(router);
    app.use(router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    base = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(TMP, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('enforces the CSP header with reporting directives', async () => {
    const res = await fetch(`${base}/api/security/headers`);
    assert.strictEqual(res.status, 200);
    const csp = res.headers.get('content-security-policy') ?? '';
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /report-uri \/api\/csp-report/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.ok(res.headers.get('report-to')?.includes('csp-endpoint'));
  });

  it('accepts a violation report and persists it to disk', async () => {
    const post = await fetch(`${base}/api/csp-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report' },
      body: JSON.stringify({
        'csp-report': { 'blocked-uri': 'https://evil.test/x.js', 'violated-directive': 'script-src' },
      }),
    });
    assert.strictEqual(post.status, 204);

    const files = fs.readdirSync(TMP).filter((f) => /^csp-violations-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
    assert.strictEqual(files.length, 1, 'one daily JSONL file should exist');

    const countRes = await fetch(`${base}/api/csp-report/count`);
    const counts = (await countRes.json()) as { count: number; persisted: number };
    assert.ok(counts.count >= 1);
    assert.ok(counts.persisted >= 1, 'persisted count reads from disk');
  });

  it('returns recent persisted violations newest-first', async () => {
    recordCspViolation({ 'blocked-uri': 'https://second.test/y.js' });
    const res = await fetch(`${base}/api/csp-report/recent?limit=5`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as {
      count: number;
      violations: Array<Record<string, unknown>>;
    };
    assert.ok(body.count >= 2);
    assert.strictEqual(body.violations[0]['blocked-uri'], 'https://second.test/y.js');
    assert.ok(body.violations.every((v) => typeof v.ts === 'string'));
  });

  it('clamps the recent limit to a sane range', async () => {
    const res = await fetch(`${base}/api/csp-report/recent?limit=99999`);
    const body = (await res.json()) as { limit: number };
    assert.strictEqual(body.limit, 200);
  });

  it('prunes violation logs older than the retention window', async () => {
    const stale = path.join(TMP, 'csp-violations-2000-01-01.jsonl');
    fs.writeFileSync(stale, `${JSON.stringify({ ts: '2000-01-01T00:00:00.000Z' })}\n`, 'utf8');
    assert.ok(fs.existsSync(stale));
    const removed = pruneCspLogs();
    assert.ok(removed >= 1, 'stale file removed');
    assert.strictEqual(fs.existsSync(stale), false);
    // Today's file must survive pruning.
    assert.ok(readPersistedViolations(5).length >= 1);
  });
});
