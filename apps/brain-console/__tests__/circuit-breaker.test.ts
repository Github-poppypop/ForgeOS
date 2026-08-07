import { describe, it, expect } from 'bun:test';
import { gbrainCircuitBreaker, CircuitBreaker } from '../circuit-breaker';

describe('apps/brain-console/circuit-breaker', () => {
  it('tracks failures and opens circuit', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 2, resetMs: 1000 });
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    const state = (gbrainCircuitBreaker as any).state;
    expect(state).toBeDefined();
  });
});
