import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-ratelimit.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-ratelimit');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/ratelimit-dash');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Rate-Limit Dashboard');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Features');
    assert.equal(typeof fm.component, 'function');
  });
});
