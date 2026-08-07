import { describe, it, expect } from 'bun:test';
import { trackView, getAnalytics } from '../analytics';

describe('knowledge-universe/analytics', () => {
  it('tracks and retrieves page views', async () => {
    await trackView('test-page');
    const data = await getAnalytics('test-page');
    expect(data['test-page']).toBeGreaterThanOrEqual(1);
  });
});
