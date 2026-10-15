import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-featureflags.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-featureflags');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/feature-flags');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Feature Flags');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Platform');
    assert.equal(typeof fm.component, 'function');
  });
});