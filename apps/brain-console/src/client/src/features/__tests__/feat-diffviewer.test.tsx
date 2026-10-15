import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-diffviewer.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-diffviewer');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(fm.path, '/feature/diff-viewer');
    assert.equal(fm.label, 'Page Diff Viewer');
    assert.equal(fm.category, 'Knowledge');
    assert.equal(typeof fm.component, 'function');
  });
});
