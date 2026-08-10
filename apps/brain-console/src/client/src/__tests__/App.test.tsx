import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('App.tsx smoke', () => {
  it('exports a module', async () => {
    const mod = await import('../App');
    assert.ok(mod.default);
  });
});
