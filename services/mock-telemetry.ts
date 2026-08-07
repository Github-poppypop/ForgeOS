/**
 * services/mock-telemetry.ts
 *
 * Mock telemetry: events + metrics stream.
 */

import { registry, MockRequest } from './mock-service-registry';

type Metric = { name: string; value: number; ts: string };
type Event = { id: string; name: string; properties: Record<string, unknown>; ts: string };

const metrics: Metric[] = [];
const events: Event[] = [];

registry.register('POST', '/api/telemetry/metric', (req) => {
  const body = (req.body || {}) as any;
  const metric: Metric = { name: String(body.name || 'metric'), value: Number(body.value ?? 0), ts: new Date().toISOString() };
  metrics.push(metric);
  return { status: 202, body: { ok: true, metric } };
});

registry.register('POST', '/api/telemetry/event', (req) => {
  const body = (req.body || {}) as any;
  const event: Event = { id: `ev-${events.length + 1}`, name: String(body.name || 'event'), properties: (body.properties || {}) as Record<string, unknown>, ts: new Date().toISOString() };
  events.push(event);
  return { status: 202, body: { ok: true, event } };
});

registry.register('GET', '/api/telemetry/metrics', () => ({
  status: 200,
  body: { metrics: metrics.slice(-200) },
}));

registry.register('GET', '/api/telemetry/events', () => ({
  status: 200,
  body: { events: events.slice(-200) },
}));
