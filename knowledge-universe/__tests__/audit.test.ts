import { describe, it, expect } from 'bun:test';
import { appendAudit, getAudit } from '../audit';

describe('knowledge-universe/audit', () => {
  it('appends and reads audit entries', async () => {
    await appendAudit({ slug: 'audit-page', action: 'update', user: 'cto', details: 'test' });
    const log = await getAudit('audit-page', 10);
    expect(Array.isArray(log)).toBe(true);
  });
});
