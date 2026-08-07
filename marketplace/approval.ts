/**
 * marketplace/approval.ts
 *
 * Marketplace review/approval workflow.
 * Tracks submissions pending approval, approved, and rejected packages.
 */

export interface ApprovalSubmission {
  id: string;
  name: string;
  version: string;
  author: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface ApprovalResult {
  ok: boolean;
  submission: ApprovalSubmission;
}

export interface ApprovalQuery {
  status?: ApprovalSubmission['status'];
  author?: string;
  limit?: number;
}

const store = new Map<string, ApprovalSubmission>();
let idCounter = 0;

export function submitPackage(name: string, version: string, author: string): ApprovalResult {
  const id = `approval-${++idCounter}`;
  const submission: ApprovalSubmission = {
    id,
    name,
    version,
    author,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
  store.set(id, submission);
  return { ok: true, submission };
}

export function reviewSubmission(id: string, status: 'approved' | 'rejected', note?: string): ApprovalResult {
  const submission = store.get(id);
  if (!submission) return { ok: false, submission: { id, name: '', version: '', author: '', status: 'rejected', submittedAt: new Date().toISOString() } };
  submission.status = status;
  submission.reviewedAt = new Date().toISOString();
  submission.reviewNote = note;
  store.set(id, submission);
  return { ok: true, submission };
}

export function listSubmissions(query: ApprovalQuery = {}): ApprovalResult[] {
  let results = Array.from(store.values());
  if (query.status) results = results.filter(s => s.status === query.status);
  if (query.author) results = results.filter(s => s.author === query.author);
  const limit = query.limit ?? 100;
  return results.slice(0, limit).map(s => ({ ok: true, submission: s }));
}
