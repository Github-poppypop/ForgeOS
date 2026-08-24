import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mirrors the established client-test convention (feat-agentcost.test.tsx):
// Node's built-in test runner via `tsx --test` — no vitest/testing-library required.
// We assert the module's public shape (calling the component would invoke React
// hooks outside a renderer and throw). The pure rollback helpers (validateDecision /
// persistDecision) are exercised directly since they don't need React.
describe('feat-inlineedit.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-inlineedit');
    const fm = mod.default as { path: string; label: string; category?: string; component: unknown };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/inline-edit');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Decisions Inline Editor');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Data');
    assert.equal(typeof fm.component, 'function');
  });

  it('validateDecision rejects empty title/owner and bad status', async () => {
    const { validateDecision, STATUSES } = await import('../feat-inlineedit');
    assert.ok(
      validateDecision({ id: 'X', title: '   ', owner: 'o', status: 'proposed', rationale: 'r' }).includes(
        'Title is required',
      ),
    );
    assert.ok(
      validateDecision({ id: 'X', title: 't', owner: '', status: 'proposed', rationale: 'r' }).includes(
        'Owner is required',
      ),
    );
    assert.equal(validateDecision({ id: 'X', title: 't', owner: 'o', status: 'proposed', rationale: 'r' }).length, 0);
    assert.ok(
      validateDecision({ id: 'X', title: 't', owner: 'o', status: 'nope' as never, rationale: 'r' }).includes(
        'Unknown status',
      ),
    );
    assert.equal(STATUSES.length, 4);
  });

  it('persistDecision resolves on success and rejects on failure (drives rollback)', async () => {
    const { persistDecision } = await import('../feat-inlineedit');
    const good = await persistDecision({ id: 'X', title: 'Ship it', owner: 'o', status: 'proposed', rationale: 'r' });
    assert.equal(good.title, 'Ship it');
    await assert.rejects(() =>
      persistDecision({ id: 'X', title: 'please fail now', owner: 'o', status: 'proposed', rationale: 'r' }),
    );
    await assert.rejects(() =>
      persistDecision({ id: 'X', title: 'ok', owner: 'o', status: 'proposed', rationale: 'r' }, { forceFail: true }),
    );
  });
});
