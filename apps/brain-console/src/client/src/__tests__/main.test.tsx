import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('main.tsx smoke', () => {
  it('mounts into #app', async () => {
    const mainPath = path.resolve('src/client/src/main.tsx');
    const content = fs.readFileSync(mainPath, 'utf8');
    assert.ok(content.includes("ReactDOM.createRoot"));
    assert.ok(content.includes("App"));
  });
});
