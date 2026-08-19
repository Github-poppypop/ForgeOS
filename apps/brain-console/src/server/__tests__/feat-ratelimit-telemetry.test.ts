import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import registerRateLimitTelemetry from '../features/feat-ratelimit-telemetry';

// Verifies the observe-only 429 telemetry feature.
// Downstream handlers are registered AFTER the feature -- mirroring createRuntime(), where
// loadServerFeatures() runs before rateLimit()/routes -- so the observer sits ahead of them.
// ratelimit.ts self-disables under NODE_ENV=test, so a stub handler emits the 429 here; the
// feature only cares about res.statusCode, not who set it.

describe('features/feat-ratelimit-telemetry per-route 429 telemetry', () => {
  let server: http.Server;
  let port = 0;

  before(async () => {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerRateLimitTelemetry(router);
    router.post('/api/probe-limited', (_req, res) => {
      res.setHeader('Retry-After', '30');
      res.status(429).json({ ok: false, error: 'rate_limited', retryAfter: 30 });
    });
    router.get('/api/probe-ok', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    port = (server.address() as AddressInfo).port;
  });

  after(() => {
    server.close();
  });

  const request = (
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; body: Record<string, unknown> }> =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: { 'content-type': 'application/json' },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += String(chunk)));
          res.on('end', () => {
            let parsed: Record<string, unknown> = {};
            try {
              parsed = data ? (JSON.parse(data) as Record<string, unknown>) : {};
            } catch {
              parsed = { raw: data };
            }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        }
      );
      req.on('error', reject);
      if (body !== undefined) req.write(JSON.stringify(body));
      req.end();
    });

  type Snapshot = {
    ok: boolean;
    perRoute: Record<string, { count429: number; lastAt: string }>;
    total429: number;
    trackedRoutes: number;
    lastEventAt: string | null;
    updatedAt: string;
  };

  const telemetry = async (): Promise<Snapshot> => {
    const { status, body } = await request('GET', '/api/rate-limit/telemetry');
    assert.strictEqual(status, 200);
    return body as unknown as Snapshot;
  };

  it('starts with an empty per-route map and a valid updatedAt', async () => {
    const snap = await telemetry();
    assert.strictEqual(snap.ok, true);
    assert.deepStrictEqual(snap.perRoute, {});
    assert.strictEqual(snap.total429, 0);
    assert.strictEqual(snap.lastEventAt, null);
    assert.ok(Number.isFinite(Date.parse(snap.updatedAt)));
  });

  it('does not break the limited route: 429 still reaches the client intact', async () => {
    const { status, body } = await request('POST', '/api/probe-limited', { a: 1 });
    assert.strictEqual(status, 429);
    assert.strictEqual(body.error, 'rate_limited');
  });

  it('counts each 429 per request path with a lastAt timestamp', async () => {
    await request('POST', '/api/probe-limited', {});
    await request('POST', '/api/probe-limited', {});
    const snap = await telemetry();
    const entry = snap.perRoute['/api/probe-limited'];
    assert.ok(entry, 'expected /api/probe-limited in perRoute');
    assert.strictEqual(entry.count429, 3, 'three 429s were emitted');
    assert.ok(Number.isFinite(Date.parse(entry.lastAt)));
    assert.strictEqual(snap.total429, 3);
    assert.strictEqual(snap.trackedRoutes, 1);
    assert.ok(snap.lastEventAt && Number.isFinite(Date.parse(snap.lastEventAt)));
  });

  it('ignores non-429 responses', async () => {
    const { status } = await request('GET', '/api/probe-ok');
    assert.strictEqual(status, 200);
    const snap = await telemetry();
    assert.strictEqual(snap.perRoute['/api/probe-ok'], undefined);
    assert.strictEqual(snap.trackedRoutes, 1);
  });

  it('strips query strings so one route is one counter row', async () => {
    await request('POST', '/api/probe-limited?burst=1', {});
    const snap = await telemetry();
    assert.strictEqual(snap.trackedRoutes, 1);
    assert.strictEqual(snap.perRoute['/api/probe-limited'].count429, 4);
  });
});
