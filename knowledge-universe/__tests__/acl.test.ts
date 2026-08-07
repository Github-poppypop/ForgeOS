import { describe, it, expect } from 'bun:test';
import { loadACLs, checkAccess, setACL, deleteACL, bulkMove, MoveResult } from '../acl';

describe('knowledge-universe/acl', () => {
  it('loads ACLs', async () => {
    const store = await loadACLs();
    expect(typeof store).toBe('object');
  });

  it('sets and checks access', async () => {
    await setACL('page-acl-1', 'cto', true);
    const ok = await checkAccess('page-acl-1', 'cto');
    expect(ok).toBe(true);
  });

  it('moves pages in bulk', async () => {
    const result: MoveResult = await bulkMove([], '.', '.');
    expect(Array.isArray(result.moved)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
  });
});
