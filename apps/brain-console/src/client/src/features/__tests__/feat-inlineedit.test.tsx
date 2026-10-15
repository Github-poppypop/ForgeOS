import { describe, it } from 'node:test';
import assert from 'node:assert';

import { validateDecision, STATUSES, type Decision } from '../feat-inlineedit';

describe('feat-inlineedit.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-inlineedit');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(fm.path, '/feature/inline-edit');
    assert.equal(fm.label, 'Decisions Inline Editor');
    assert.equal(fm.category, 'Data');
    assert.equal(typeof fm.component, 'function');
  });

  it('validateDecision returns empty for valid input', () => {
    const d: Decision = { id: 'x', title: 'Test', owner: 'me', status: 'approved', rationale: 'ok' };
    assert.deepEqual(validateDecision(d), []);
  });

  it('validateDecision catches missing title', () => {
    const d: Decision = { id: 'x', title: '', owner: 'me', status: 'approved', rationale: 'ok' };
    assert.ok(validateDecision(d).includes('Title is required'));
  });

  it('STATUSES includes all four decision statuses', () => {
    assert.deepEqual(STATUSES, ['proposed', 'approved', 'rejected', 'superseded']);
  });
});
