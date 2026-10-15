import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-keyboard-shortcuts.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-keyboard-shortcuts');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(fm.path, '/feature/keyboard-shortcuts');
    assert.equal(fm.label, 'Keyboard Shortcuts');
    assert.equal(fm.category, 'Help');
    assert.equal(typeof fm.component, 'function');
  });
});