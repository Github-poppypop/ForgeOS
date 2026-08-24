import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mirrors the established client-test convention (see src/client/src/__tests__/App.test.tsx):
// Node's built-in test runner via `tsx --test` — no vitest/testing-library required.
// We assert the module's public shape only (calling the component would invoke React
// hooks outside a renderer and throw).
describe('feat-releasenotes.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-releasenotes');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/release-notes');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Release Notes');
    assert.equal(typeof fm.category, 'string');
    assert.equal(typeof fm.component, 'function');
  });
});
