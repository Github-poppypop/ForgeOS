/**
 * services/mock-webhooks.ts
 *
 * Mock webhooks: inbound receiver + delivery log.
 */

import { registry, MockRequest } from './mock-service-registry';

type Delivery = { id: string; url: string; event: string; status: string; ts: string };
const deliveries: Delivery[] = [];

registry.register('POST', '/api/webhooks/inbound', (req) => {
  const body = (req.body || {}) as any;
  const event = String(body.event || 'unknown');
  const record: Delivery = { id: `wh-${deliveries.length + 1}`, url: String(req.path), event, status: 'accepted', ts: new Date().toISOString() };
  deliveries.push(record);
  return { status: 202, body: { accepted: true, delivery: record } };
});

registry.register('GET', '/api/webhooks/deliveries', () => ({
  status: 200,
  body: { deliveries: deliveries.slice(-200) },
}));
