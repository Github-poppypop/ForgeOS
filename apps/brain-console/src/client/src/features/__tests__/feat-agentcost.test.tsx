import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mirrors the established client-test convention (see feat-health.test.tsx):
// Node's built-in test runner via `tsx --test` — no vitest/testing-library required.
// We assert the module's public shape only (calling the component would invoke React
// hooks outside a renderer and throw). Importing the module must not start any fetch
// or timers, so this stays hermetic and never hangs.
describe('feat-agentcost.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-agentcost');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/agent-cost');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Agent Cost Accounting');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Observability');
    assert.equal(typeof fm.component, 'function');
  });
});
