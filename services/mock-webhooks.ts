/**
 * services/mock-webhooks.ts
 *
 * Mock webhooks: inbound receiver + delivery log.
 */

export type MockRequest = { method: string; path: string; query: Record<string, string>; headers: Record<string, string>; body?: unknown };
export type MockResponse = { status: number; body: unknown; headers?: Record<string, string> };

type Delivery = { id: string; url: string; event: string; status: string; ts: string };
const deliveries: Delivery[] = [];

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
