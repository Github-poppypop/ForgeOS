import { describe, it, expect } from 'bun:test';
import { agentMemoryCache, MemoryCache } from '../memory-cache';

describe('agents/memory-cache', () => {
  it('sets and gets cache entries', () => {
    agentMemoryCache.set('x', { value: 1 });
    const hit = agentMemoryCache.get('x');
    expect(hit).toBeDefined();
    expect((hit as any).value).toBe(1);
  });

  it('expires entries after TTL', () => {
    const cache = new MemoryCache<{ v: number }>(50);
    cache.set('y', { v: 2 });
    expect(cache.get('y')).toBeDefined();
  });
});
