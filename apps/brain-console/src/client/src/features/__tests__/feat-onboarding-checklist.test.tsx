import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mirrors the established client-test convention (see feat-readinglist.test.tsx):
// Node's built-in test runner via `tsx --test` — no vitest/testing-library required.
// We assert the module's public shape only (calling the component would invoke React
// hooks outside a renderer and throw).
describe('feat-onboarding-checklist.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-onboarding-checklist');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/onboarding-checklist');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Onboarding Checklist');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Onboarding');
    assert.equal(typeof fm.component, 'function');
  });
});
