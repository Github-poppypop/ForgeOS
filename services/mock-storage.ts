/**
 * services/mock-storage.ts
 *
 * Mock file storage: upload, list, delete, signed URL.
 */

export type MockRequest = { method: string; path: string; query: Record<string, string>; headers: Record<string, string>; body?: unknown };
export type MockResponse = { status: number; body: unknown; headers?: Record<string, string> };

type FileRecord = { id: string; name: string; contentType: string; size: number; ts: string };

const files = new Map<string, FileRecord>();

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

registry.register('POST', '/api/storage/upload', async (req) => {
  const body = (req.body || {}) as any;
  const name = String(body.name || 'file.bin');
  const contentType = String(body.contentType || 'application/octet-stream');
  const size = Number(body.size || 0);
  if (size > 50 * 1024 * 1024) return { status: 413, body: { error: 'file too large' } };
  const id = `file-${files.size + 1}`;
  files.set(id, { id, name, contentType, size, ts: new Date().toISOString() });
  return { status: 201, body: { id, name, url: `/api/storage/${id}` } };
});

registry.register('GET', '/api/storage', () => {
  const rows = Array.from(files.values()).sort((a, b) => b.ts.localeCompare(a.ts));
  return { status: 200, body: { files: rows } };
});

registry.register('GET', '/api/storage/:id', (req) => {
  const id = String(req.path.split('/').pop() || '');
  const file = files.get(id);
  if (!file) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { file } };
});

registry.register('DELETE', '/api/storage/:id', (req) => {
  const id = String(req.path.split('/').pop() || '');
  const existed = files.delete(id);
  return { status: existed ? 200 : 404, body: { ok: existed } };
});
