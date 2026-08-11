import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('App.tsx chart visualizations', () => {
  it('renders chart primitives without crashing', async () => {
    const mod = await import('../App');
    const App = mod.default;
    assert.ok(App);
    const html = (await import('react-dom/server')).renderToString(App());
    assert.ok(html.includes('class="chart"'), 'chart primitive missing');
    assert.ok(html.includes('class="donut-legend"'), 'donut chart missing');
    assert.ok(html.includes('class="stepper"'), 'stepper missing');
    assert.ok(html.includes('class="heatmap"'), 'heatmap missing');
    assert.ok(html.includes('class="skeleton"'), 'skeleton loader missing');
    assert.ok(html.includes('EmptyState'), 'empty state missing');
  });
});
