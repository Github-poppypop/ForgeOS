/**
 * services/mock-notifications.ts
 *
 * Mock notifications: feed, read/unread, mark-all-read.
 */

import { registry, MockRequest } from './mock-service-registry';

type Notification = { id: string; userId: string; title: string; body: string; read: boolean; ts: string };
const store: Notification[] = [];

function userId(req: MockRequest) {
  return String((req as any).userId || '');
}

registry.register('GET', '/api/notifications', (req) => {
  const uid = userId(req);
  const rows = store.filter((n) => n.userId === uid);
  return { status: 200, body: { notifications: rows, unread: rows.filter((n) => !n.read).length } };
});

registry.register('POST', '/api/notifications', (req) => {
  const body = (req.body || {}) as any;
  const uid = userId(req);
  const note: Notification = { id: `n-${store.length + 1}`, userId: uid, title: String(body.title || 'Notification'), body: String(body.body || ''), read: false, ts: new Date().toISOString() };
  store.push(note);
  return { status: 201, body: { notification: note } };
});

registry.register('PATCH', '/api/notifications/:id/read', (req) => {
  const path = String(req.path || '');
  const id = path.split('/').pop() || '';
  const note = store.find((n) => n.id === id && n.userId === userId(req));
  if (!note) return { status: 404, body: { error: 'not found' } };
  note.read = true;
  return { status: 200, body: { notification: note } };
});

registry.register('POST', '/api/notifications/read-all', (req) => {
  const uid = userId(req);
  for (const n of store) if (n.userId === uid) n.read = true;
  return { status: 200, body: { ok: true } };
});
