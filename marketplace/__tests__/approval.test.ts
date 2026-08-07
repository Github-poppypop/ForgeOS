import { describe, it, expect } from 'bun:test';
import { submitPackage, reviewSubmission, listSubmissions } from '../approval';

describe('marketplace/approval', () => {
  it('submits a package for approval', () => {
    const result = submitPackage('test-pkg', '1.0.0', 'test-author');
    expect(result.ok).toBe(true);
    expect(result.submission.status).toBe('pending');
  });

  it('reviews a submission', () => {
    const submitted = submitPackage('test-pkg-2', '2.0.0', 'author-2');
    const reviewed = reviewSubmission(submitted.submission.id, 'approved', 'Looks good');
    expect(reviewed.ok).toBe(true);
    expect(reviewed.submission.status).toBe('approved');
  });

  it('lists submissions by status', () => {
    const list = listSubmissions({ status: 'pending' });
    expect(Array.isArray(list)).toBe(true);
  });
});
