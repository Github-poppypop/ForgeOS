import { describe, it, expect } from 'bun:test';
import { deadLetterQueue } from '../dead-letter-queue';

describe('agents/dead-letter-queue', () => {
  it('enqueues and lists dead letters', () => {
    const entry = deadLetterQueue.enqueue({ agentId: 'a1', role: 'cto', action: 'run', error: 'boom' });
    expect(entry.id).toBeDefined();
    const all = deadLetterQueue.list();
    expect(all.some(e => e.id === entry.id)).toBe(true);
  });
});
