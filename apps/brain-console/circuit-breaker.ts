/**
 * apps/brain-console/circuit-breaker.ts — Circuit breaker for gbrain CLI spawns
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxProbes?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private probeCount = 0;
  private nextAttempt = 0;

  constructor(private readonly name: string, private readonly opts: CircuitBreakerOptions) {}

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`[${this.name}] circuit open, retry after ${this.nextAttempt - Date.now()}ms`);
      }
      // half-open probe
      this.state = 'half-open';
      this.probeCount = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.probeCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.probeCount++;
      // Re-open if probe fails
      this.state = 'open';
      this.nextAttempt = Date.now() + this.opts.resetTimeoutMs;
      return;
    }

    if (this.failureCount >= this.opts.failureThreshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.opts.resetTimeoutMs;
    }
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.probeCount = 0;
    this.lastFailureTime = 0;
  }
}

export const gbrainCircuitBreaker = new CircuitBreaker('gbrain-cli', {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxProbes: 1,
});
