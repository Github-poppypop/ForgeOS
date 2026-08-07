/**
 * services/mock-auth.ts
 *
 * Mock auth service: fake login/registration/token refresh.
 * Replaces real OAuth/SSO without external dependencies.
 */

import { registry, MockRequest } from './mock-service-registry';

const USERS = [
  { id: 'u1', email: 'cto@forgeos.local', role: 'cto', name: 'CTO' },
  { id: 'u2', email: 'ceo@forgeos.local', role: 'ceo', name: 'CEO' },
  { id: 'u3', email: 'coo@forgeos.local', role: 'coo', name: 'COO' },
];

const TOKENS = new Map<string, { userId: string; exp: number }>();

function issueToken(userId: string) {
  const token = `${userId}.${Math.random().toString(36).slice(2)}`;
  TOKENS.set(token, { userId, exp: Date.now() + 1000 * 60 * 60 });
  return token;
}

function authMiddleware(req: MockRequest, next: () => any) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const token = auth.slice('Bearer '.length);
  const record = TOKENS.get(token);
  if (!record || record.exp < Date.now()) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  (req as any).userId = record.userId;
  return next();
}

registry.use(authMiddleware);

registry.register('POST', '/api/auth/login', (req) => {
  const body = (req.body || {}) as any;
  const email = String(body.email || '').toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) {
    return { status: 400, body: { error: 'email and password required' } };
  }
  const user = USERS.find((u) => u.email === email);
  if (!user) {
    return { status: 401, body: { error: 'invalid credentials' } };
  }
  const token = issueToken(user.id);
  return { status: 200, body: { token, user: { id: user.id, email: user.email, role: user.role, name: user.name } } };
});

registry.register('POST', '/api/auth/register', (req) => {
  const body = (req.body || {}) as any;
  const email = String(body.email || '').toLowerCase();
  const name = String(body.name || '').trim();
  const role = String(body.role || 'user').toLowerCase();
  if (!email || !name) {
    return { status: 400, body: { error: 'email and name required' } };
  }
  const exists = USERS.find((u) => u.email === email);
  if (exists) {
    return { status: 409, body: { error: 'already registered' } };
  }
  const id = `u${USERS.length + 1}`;
  USERS.push({ id, email, role, name });
  const token = issueToken(id);
  return { status: 201, body: { token, user: { id, email, role, name } } };
});

registry.register('POST', '/api/auth/refresh', (req) => {
  const auth = String(req.headers['authorization'] || '');
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : auth;
  const record = TOKENS.get(token);
  if (!record) return { status: 401, body: { error: 'unauthorized' } };
  const newToken = issueToken(record.userId);
  return { status: 200, body: { token: newToken } };
});

registry.register('GET', '/api/auth/me', (req) => {
  const userId = (req as any).userId as string;
  const user = USERS.find((u) => u.id === userId);
  if (!user) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { user: { id: user.id, email: user.email, role: user.role, name: user.name } } };
});
