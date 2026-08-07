import { describe, it, expect } from 'bun:test';
import { trackEvent, getPublisherStats, getTopPublishers, __resetForTests } from '../analytics';

describe('marketplace/analytics', () => {
  it('tracks events', () => {
    __resetForTests();
    const event = trackEvent('pub-1', 'pkg-1', 'download');
    expect(event.eventType).toBe('download');
    expect(event.publisher).toBe('pub-1');
  });

  it('computes publisher stats', () => {
    __resetForTests();
    trackEvent('pub-1', 'pkg-1', 'download');
    trackEvent('pub-1', 'pkg-1', 'install');
    const stats = getPublisherStats('pub-1');
    expect(stats.downloads).toBe(1);
    expect(stats.installs).toBe(1);
  });

  it('returns top publishers', () => {
    __resetForTests();
    const top = getTopPublishers(5);
    expect(Array.isArray(top)).toBe(true);
  });
});
