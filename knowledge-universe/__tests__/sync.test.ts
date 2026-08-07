import { describe, it, expect } from 'bun:test';
import { startWatch, stopWatch, isWatching } from '../sync';

describe('knowledge-universe/sync', () => {
  it('starts and stops watcher', () => {
    const stop = startWatch('.', () => {});
    expect(typeof stop).toBe('function');
    stop();
    expect(isWatching()).toBe(false);
  });
});
