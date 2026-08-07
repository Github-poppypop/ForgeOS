import { describe, it, expect } from 'bun:test';
import { recordCost, getCostByRole } from './cost-accounting';

describe('agents/cost-accounting', () => {
  it('records and retrieves cost by role', () => {
    recordCost({ role: 'cto', tokensIn: 10, tokensOut: 20, cost: 0.01 });
    const r = getCostByRole('cto');
    expect(r.role).toBe('cto');
    expect(r.tokensIn).toBe(10);
    expect(r.tokensOut).toBe(20);
  });
});
