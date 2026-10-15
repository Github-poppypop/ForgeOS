import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-graphql-guard.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-graphql-guard');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(fm.path, '/feature/graphql-guard');
    assert.equal(fm.label, 'GraphQL Guard');
    assert.equal(fm.category, 'Features');
    assert.equal(typeof fm.component, 'function');
  });
});
