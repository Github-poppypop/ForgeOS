import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx');

describe('App.tsx chart visualizations', () => {
  it('contains chart primitives in source', async () => {
    const source = fs.readFileSync(appPath, 'utf8');
    assert.ok(source.includes('BarChart'), 'BarChart primitive missing');
    assert.ok(source.includes('Sparkline'), 'Sparkline primitive missing');
    assert.ok(source.includes('GaugeChart'), 'GaugeChart primitive missing');
    assert.ok(source.includes('Stepper'), 'Stepper primitive missing');
    assert.ok(source.includes('EmptyState'), 'EmptyState missing');
  });
});
