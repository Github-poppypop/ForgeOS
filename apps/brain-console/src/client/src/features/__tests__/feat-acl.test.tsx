import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAcl, ROLES, SENSITIVE_PAGES, type AclMatrix } from '../feat-acl';

test('defaultAcl grants admin everything and viewer nothing', () => {
  const a = defaultAcl();
  assert.equal(
    SENSITIVE_PAGES.every((p) => a.admin[p.path] === true),
    true,
  );
  assert.equal(
    SENSITIVE_PAGES.every((p) => a.viewer[p.path] === false),
    true,
  );
});

test('defaultAcl covers every role and page with booleans', () => {
  const a = defaultAcl();
  for (const r of ROLES) {
    for (const p of SENSITIVE_PAGES) {
      assert.equal(typeof a[r.key][p.path], 'boolean');
    }
  }
});

test('acl matrix is a role->page->boolean map', () => {
  const a: AclMatrix = defaultAcl();
  assert.equal(typeof a, 'object');
  assert.equal(Array.isArray(a), false);
});
