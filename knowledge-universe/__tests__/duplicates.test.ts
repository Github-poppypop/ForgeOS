import { describe, it, expect } from 'bun:test';
import { findDuplicates } from '../duplicates';

describe('knowledge-universe/duplicates', () => {
  it('scans repo for duplicates', () => {
    const dups = findDuplicates('.');
    expect(Array.isArray(dups)).toBe(true);
  });
});
