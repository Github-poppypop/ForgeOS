import { describe, it, expect } from 'bun:test';
import { deadLetterQueue, DeadLetterQueue } from '../agents/dead-letter-queue';

describe('agents/dead-letter-queue', () => {
  it('enqueues and drains dead letters', () => {
    const entry = { id: '1', task: 'test', error: 'fail', ts: new Date().toISOString() };
    deadLetterQueue.enqueue(entry as any);
    const all = deadLetterQueue.drain();
    expect(all.length).toBe(1);
  });
});
