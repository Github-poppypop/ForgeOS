import { describe, it, expect } from 'bun:test';
import { runbookSelector } from '../agents/runbook-selector';

describe('agents/runbook-selector', () => {
  it('selects a runbook by mission type', () => {
    const rb = runbookSelector.select('incident');
    expect(rb).toBeDefined();
  });
});
