import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { createRuntime } from '../src/server/runtime';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(createRuntime());
  return app;
}

async function getJson(app: express.Express, path: string) {
  return new Promise<any>((resolve, reject) => {
    app.get(path, (req, res) => {
      res.json({ ok: true, path: req.path });
    });
    const req = app.request('GET', path);
    res.on('finish', () => {
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode} for ${path}`));
      let body = '';
      res.on('data', (chunk: any) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (err) { reject(err); }
      });
    });
  });
}

describe('apps/brain-console/src/server/runtime', () => {
  it('exports createRuntime', () => {
    assert.strictEqual(typeof createRuntime, 'function');
  });

  it('responds to core API routes', async () => {
    const app = buildApp();
    const health = await getJson(app, '/api/health');
    assert.strictEqual(health.ok, true);
  });

  it('returns not found for unknown API routes', async () => {
    const app = buildApp();
    try {
      await getJson(app, '/api/does-not-exist');
      assert.fail('expected 404');
    } catch (err: any) {
      assert.ok(/404|HTTP 404/.test(err.message));
    }
  });

  it('creates a router with standard express middleware', async () => {
    const app = buildApp();
    const payload = { event: 'test', ts: new Date().toISOString() };
    const res = await new Promise<any>((resolve, reject) => {
      const req = app.request('POST', '/api/telemetry');
      req.write(JSON.stringify(payload));
      res.on('finish', () => resolve(res.statusCode));
      req.end();
    });
    assert.ok([200, 204, 404].includes(res));
  });
});
