import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-csp-enforce.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-csp-enforce');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/csp-enforce');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'CSP Enforce');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Security');
    assert.equal(typeof fm.component, 'function');
  });
});