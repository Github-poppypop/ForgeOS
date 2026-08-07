/**
 * services/mock-billing.ts
 *
 * Mock billing service: invoices, plans, usage events.
 */

import { registry, MockRequest } from './mock-service-registry';

type Plan = { id: string; name: string; price: number; currency: string; quota: { requests: number; seats: number } };
type Invoice = { id: string; userId: string; planId: string; amount: number; status: string; ts: string };
type UsageEvent = { id: string; userId: string; metric: string; value: number; ts: string };

const plans: Plan[] = [
  { id: 'free', name: 'Free', price: 0, currency: 'USD', quota: { requests: 1000, seats: 1 } },
  { id: 'team', name: 'Team', price: 49, currency: 'USD', quota: { requests: 50000, seats: 10 } },
  { id: 'org', name: 'Org', price: 199, currency: 'USD', quota: { requests: 500000, seats: 999 } },
];

const invoices: Invoice[] = [];
const usage: UsageEvent[] = [];

registry.register('GET', '/api/billing/plans', () => ({
  status: 200,
  body: { plans },
}));

registry.register('GET', '/api/billing/invoices', (req) => {
  const userId = String((req as any).userId || '');
  const rows = userId ? invoices.filter((i) => i.userId === userId) : invoices;
  return { status: 200, body: { invoices: rows } };
});

registry.register('POST', '/api/billing/invoices', (req) => {
  const body = (req.body || {}) as any;
  const userId = String((req as any).userId || '');
  const planId = String(body.planId || '').trim();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return { status: 400, body: { error: 'invalid planId' } };
  const invoice: Invoice = { id: `inv-${invoices.length + 1}`, userId, planId: plan.id, amount: plan.price, status: 'paid', ts: new Date().toISOString() };
  invoices.push(invoice);
  return { status: 201, body: { invoice } };
});

registry.register('POST', '/api/billing/usage', (req) => {
  const body = (req.body || {}) as any;
  const userId = String((req as any).userId || '');
  const metric = String(body.metric || 'requests');
  const value = Number(body.value || 1);
  const event: UsageEvent = { id: `ue-${usage.length + 1}`, userId, metric, value, ts: new Date().toISOString() };
  usage.push(event);
  return { status: 202, body: { accepted: true, event } };
});

registry.register('GET', '/api/billing/usage', (req) => {
  const userId = String((req as any).userId || '');
  const rows = userId ? usage.filter((u) => u.userId === userId) : usage;
  return { status: 200, body: { usage: rows.slice(-200) } };
});
