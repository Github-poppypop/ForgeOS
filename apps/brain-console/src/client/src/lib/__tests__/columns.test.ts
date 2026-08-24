import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reorderColumns, loadColumnOrder, saveColumnOrder } from '../columns';

// Minimal in-memory localStorage so persistence helpers are testable under node.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
  key(i: number): string | null {
    return Array.from(this.m.keys())[i] ?? null;
  }
  get length(): number {
    return this.m.size;
  }
}
(globalThis as any).localStorage = new MemStorage();

test('reorderColumns moves an item without mutating input', () => {
  const cols = ['a', 'b', 'c', 'd'];
  const out = reorderColumns(cols, 0, 2);
  assert.deepEqual(out, ['b', 'c', 'a', 'd']);
  assert.deepEqual(cols, ['a', 'b', 'c', 'd'], 'input must not be mutated');
});

test('reorderColumns swaps to the front and back', () => {
  assert.deepEqual(reorderColumns(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(reorderColumns(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
});

test('reorderColumns clamps out-of-range indices (no-op)', () => {
  const cols = ['a', 'b', 'c'];
  assert.deepEqual(reorderColumns(cols, 5, 1), ['a', 'b', 'c']);
  assert.deepEqual(reorderColumns(cols, 1, 99), ['a', 'b', 'c']);
  assert.deepEqual(reorderColumns(cols, -1, 1), ['a', 'b', 'c']);
});

test('loadColumnOrder falls back to defaults when storage is empty', () => {
  assert.deepEqual(loadColumnOrder(['x', 'y', 'z']), ['x', 'y', 'z']);
});

test('save + load round-trips and reconciles against defaults', () => {
  const defaults = ['x', 'y', 'z'];
  saveColumnOrder(['z', 'x', 'y']);
  assert.deepEqual(loadColumnOrder(defaults), ['z', 'x', 'y']);
  // unknown stored column is dropped, missing default is appended
  saveColumnOrder(['y', 'zzz', 'x'] as string[]);
  assert.deepEqual(loadColumnOrder(defaults), ['y', 'x', 'z']);
});
