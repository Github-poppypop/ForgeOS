import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-missionsched-exec.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-missionsched-exec');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(fm.path, '/feature/mission-scheduler-exec');
    assert.equal(fm.label, 'Scheduler Executions');
    assert.equal(fm.category, 'Features');
    assert.equal(typeof fm.component, 'function');
  });
});
