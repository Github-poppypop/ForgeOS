import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import type { AddressInfo, Server } from 'node:http';
import { createRuntime } from '../runtime';
import { syncHub } from '../syncHub';

function listenOnFreePort(app: express.Express): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('apps/brain-console/src/server/syncHub', () => {
  it('exports a singleton syncHub with attach/sync/broadcast', () => {
    assert.ok(syncHub, 'syncHub is defined');
    assert.strictEqual(typeof syncHub.attach, 'function');
    assert.strictEqual(typeof syncHub.sync, 'function');
    assert.strictEqual(typeof syncHub.broadcast, 'function');
  });

  it('serves a ws:// endpoint: hello on connect + sync on POST', async () => {
    const app = express();
    app.use(express.json());
    app.use(await createRuntime());
    const server = await listenOnFreePort(app);
    const { port } = server.address() as AddressInfo;
    syncHub.attach(server);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages: any[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (e: any) => reject(e.error ?? new Error('websocket error'));
    });
    ws.onmessage = (ev) => messages.push(JSON.parse(ev.data as string));

    // Allow the immediate handshake `hello` frame to arrive.
    await new Promise((r) => setTimeout(r, 200));

    // Direct broadcast.
    syncHub.sync('test-event', { ok: true });

    // Wired POST endpoints should each emit a `sync` event.
    const cap = await fetch(`http://127.0.0.1:${port}/api/capture`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'sync-hub-test', type: 'note' }),
    });
    assert.ok(cap.status === 201 || cap.status === 200, 'capture POST responded');

    const apps = await fetch(`http://127.0.0.1:${port}/api/apps`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'sync-hub-app', name: 'Sync Hub App' }),
    });
    assert.ok(apps.status === 201 || apps.status === 200, 'apps POST responded');

    await new Promise((r) => setTimeout(r, 200));

    const types = messages.map((m) => m.type);
    assert.ok(types.includes('hello'), 'client received hello frame on connect');
    assert.ok(types.includes('sync'), 'client received a sync frame');
    const syncEvents = messages.filter((m) => m.type === 'sync').map((m) => m.event);
    assert.ok(syncEvents.includes('test-event'), 'direct sync broadcast received');
    assert.ok(syncEvents.includes('capture'), 'capture POST emitted sync event');
    assert.ok(syncEvents.includes('apps'), 'apps POST emitted sync event');

    ws.close();
    server.close();
    // Tear down the shared syncHub singleton (clears its 25s heartbeat
    // interval + client sockets) so the test process can exit cleanly.
    syncHub.stop();
  });
});
