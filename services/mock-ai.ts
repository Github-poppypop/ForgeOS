/**
 * services/mock-ai.ts
 *
 * Mock AI endpoints: completion, embedding, rerank.
 */

export type MockRequest = { method: string; path: string; query: Record<string, string>; headers: Record<string, string>; body?: unknown };
export type MockResponse = { status: number; body: unknown; headers?: Record<string, string> };

function fakeEmbedding(text: string): number[] {
  const dim = 8;
  const out: number[] = [];
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  for (let i = 0; i < dim; i++) out.push(Number((Math.sin(h + i) + 1) / 2));
  return out;
}

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

registry.register('POST', '/api/ai/complete', (req) => {
  const body = (req.body || {}) as any;
  const prompt = String(body.prompt || '');
  return { status: 200, body: { completion: `mock response for: ${prompt.slice(0, 40)}`, model: 'mock-llama' } };
});

registry.register('POST', '/api/ai/embed', (req) => {
  const body = (req.body || {}) as any;
  const text = String(body.text || body.input || '');
  return { status: 200, body: { embedding: fakeEmbedding(text), dimensions: fakeEmbedding(text).length } };
});

registry.register('POST', '/api/ai/rerank', (req) => {
  const body = (req.body || {}) as any;
  const query = String(body.query || '');
  const docs = Array.isArray(body.documents) ? body.documents : [];
  const scored = docs.map((doc: string, idx: number) => ({ document: doc, score: 1 - idx / (docs.length + 1) }));
  return { status: 200, body: { query, results: scored } };
});
