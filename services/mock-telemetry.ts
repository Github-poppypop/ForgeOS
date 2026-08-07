/**
 * services/mock-telemetry.ts
 *
 * Mock telemetry: events + metrics stream.
 */

export type MockRequest = { method: string; path: string; query: Record<string, string>; headers: Record<string, string>; body?: unknown };
export type MockResponse = { status: number; body: unknown; headers?: Record<string, string> };

type Metric = { name: string; value: number; ts: string };
type Event = { id: string; name: string; properties: Record<string, unknown>; ts: string };

const metrics: Metric[] = [];
const events: Event[] = [];

const routes = new Map<string, (req: MockRequest) => MockResponse | Promise<MockResponse>>();
export const registry = {
  register(method: string, path: string, handler: (req: MockRequest) => MockResponse | Promise<MockResponse>) {
    routes.set(`${method.toUpperCase()} ${path}`, handler);
  },
  async handle(req: MockRequest): Promise<MockResponse> {
    const key = `${req.method.toUpperCase()} ${req.path}`;
    const handler = routes.get(key);
    if (!handler) return { status: 404, body: { error: 'not found', path: req.path } };
    return handler(req);
  },
};

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
