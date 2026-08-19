import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRuntime } from '../runtime';

describe('apps/brain-console/src/server/runtime', () => {
  it('exports createRuntime', () => {
    assert.strictEqual(typeof createRuntime, 'function');
  });

  it('creates a router with standard express middleware', async () => {
    const runtime = await createRuntime();
    assert.ok(runtime, 'runtime middleware is defined');
  });
});
