import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-webhooks.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-webhooks');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/webhooks');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Webhooks');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Governance');
    assert.equal(typeof fm.component, 'function');
  });
});
