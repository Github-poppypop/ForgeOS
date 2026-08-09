import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

describe('server.bun-era.ts smoke', () => {
  it('archived Bun server source exists', () => {
    const content = fs.readFileSync('.archive/server.bun-era.ts', 'utf8');
    assert.ok(content.includes('bun'));
  });
});
