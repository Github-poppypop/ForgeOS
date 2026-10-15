import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('feat-ratelimit-telemetry.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-ratelimit-telemetry');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/ratelimit-telemetry');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Rate-Limit Telemetry');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Observability');
    assert.equal(typeof fm.component, 'function');
  });
});
