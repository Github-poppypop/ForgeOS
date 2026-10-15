import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-auditstore.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-auditstore');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/audit-store');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Audit Store');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Features');
    assert.equal(typeof fm.component, 'function');
  });
});
