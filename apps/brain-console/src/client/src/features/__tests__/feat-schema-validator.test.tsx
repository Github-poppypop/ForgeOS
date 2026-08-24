import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validate, SCHEMAS } from '../feat-schema-validator';

// Mirrors the established client-test convention (see feat-readinglist.test.tsx):
// Node's built-in test runner via `tsx --test` — no vitest/testing-library required.
// We assert the module's public shape AND exercise the exported `validate` logic,
// since calling the component would invoke React hooks outside a renderer and throw.
describe('feat-schema-validator.tsx', () => {
  it('default-exports a valid FeatureModule', async () => {
    const mod = await import('../feat-schema-validator');
    const fm = mod.default as {
      path: string;
      label: string;
      category?: string;
      component: unknown;
    };
    assert.equal(typeof fm, 'object');
    assert.equal(typeof fm.path, 'string');
    assert.equal(fm.path, '/feature/schema-validator');
    assert.equal(typeof fm.label, 'string');
    assert.equal(fm.label, 'Output Schema Validator');
    assert.equal(typeof fm.category, 'string');
    assert.equal(fm.category, 'Agent Runtime');
    assert.equal(typeof fm.component, 'function');
  });

  it('passes a well-formed Agent Task Result', () => {
    const schema = SCHEMAS.find((s) => s.id === 'task-result')!;
    const ok = {
      id: 't1',
      agent: 'researcher',
      status: 'completed',
      output: 'summary',
      timestamp: '2026-08-20T12:00:00Z',
    };
    assert.deepStrictEqual(validate(ok, schema), []);
  });

  it('flags missing required fields', () => {
    const schema = SCHEMAS.find((s) => s.id === 'task-result')!;
    const issues = validate({ id: 't1' }, schema);
    assert.ok(issues.length >= 1);
    assert.ok(
      issues.some((i) => i.field === 'agent' && /Missing required field/.test(i.message))
    );
    assert.ok(issues.some((i) => i.field === 'status'));
  });

  it('flags type mismatches', () => {
    const schema = SCHEMAS.find((s) => s.id === 'task-result')!;
    const issues = validate(
      { id: 123, agent: 'a', status: 's', output: 'o', timestamp: 't' },
      schema
    );
    assert.ok(
      issues.some((i) => i.field === 'id' && /should be type string/.test(i.message))
    );
  });

  it('rejects non-object roots', () => {
    const schema = SCHEMAS.find((s) => s.id === 'task-result')!;
    const issues = validate([1, 2, 3], schema);
    assert.ok(issues.some((i) => i.field === '(root)'));
  });
});
