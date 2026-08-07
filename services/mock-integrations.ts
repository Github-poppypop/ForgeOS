/**
 * services/mock-integrations.ts
 *
 * Mock integrations: fake OAuth flows for Slack/Notion/GitHub.
 */

import { registry, MockRequest } from './mock-service-registry';

type Integration = { id: string; provider: string; connected: boolean; account: string; ts: string };
const integrations: Integration[] = [];

const providerScopes: Record<string, string[]> = {
  slack: ['chat:write', 'channels:read'],
  notion: ['read', 'write'],
  github: ['repo', 'read:user'],
};

registry.register('POST', '/api/integrations/:provider/oauth/start', (req) => {
  const provider = String(req.path.split('/')[3] || '').toLowerCase();
  if (!providerScopes[provider]) return { status: 400, body: { error: 'unsupported provider' } };
  return { status: 200, body: { provider, authUrl: `/mock/oauth/${provider}/authorize`, scopes: providerScopes[provider] } };
});

registry.register('POST', '/api/integrations/:provider/oauth/callback', (req) => {
  const provider = String(req.path.split('/')[3] || '').toLowerCase();
  const body = (req.body || {}) as any;
  const code = String(body.code || '');
  if (!code) return { status: 400, body: { error: 'code required' } };
  const record: Integration = { id: `int-${integrations.length + 1}`, provider, connected: true, account: `${provider}-user`, ts: new Date().toISOString() };
  integrations.push(record);
  return { status: 200, body: { integration: record } };
});

registry.register('GET', '/api/integrations', () => ({
  status: 200,
  body: { integrations },
}));

registry.register('DELETE', '/api/integrations/:id', (req) => {
  const id = String(req.path.split('/').pop() || '');
  const idx = integrations.findIndex((i) => i.id === id);
  if (idx < 0) return { status: 404, body: { error: 'not found' } };
  integrations.splice(idx, 1);
  return { status: 200, body: { ok: true } };
});
