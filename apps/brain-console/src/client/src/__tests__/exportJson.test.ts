import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToJson } from '../panelkit';

test('rowsToJson serializes rows to a pretty-printed JSON array', () => {
  const rows = [
    { a: 1, b: 'x' },
    { a: 2, b: 'y' },
  ];
  const out = rowsToJson(rows);
  assert.deepEqual(JSON.parse(out), rows);
  // pretty-printed: contains newlines + 2-space indent
  assert.ok(out.includes('\n  '));
});

test('rowsToJson is null/empty safe', () => {
  assert.deepEqual(JSON.parse(rowsToJson([])), []);
  assert.deepEqual(JSON.parse(rowsToJson(null as any)), []);
  assert.deepEqual(JSON.parse(rowsToJson(undefined as any)), []);
});
