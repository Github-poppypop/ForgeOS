import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-deadletter.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-deadletter');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/dead-letter');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Dead-Letter Queue');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Features');
    assert.equal(typeof fm.component, 'function');
  });
});