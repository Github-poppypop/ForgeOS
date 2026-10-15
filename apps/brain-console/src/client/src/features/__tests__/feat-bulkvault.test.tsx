import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-bulkvault.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-bulkvault');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/bulk-vault');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Bulk Vault');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Knowledge');
    assert.equal(typeof fm.component, 'function');
  });
});