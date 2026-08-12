import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'DebugErrorBoundary.tsx');

describe('DebugErrorBoundary.tsx', () => {
  it('exists and exports the debug boundary', async () => {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.ok(source.includes('export class DebugErrorBoundary'), 'DebugErrorBoundary export missing');
    assert.ok(source.includes('componentDidCatch'), 'componentDidCatch handler missing');
    assert.ok(source.includes('Rendered crash'), 'fallback UI marker missing');
  });
});
