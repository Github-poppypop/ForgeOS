/**
 * services/mock-service-registry.ts
 *
 * Central in-memory registry for mock services.
 * Real services can replace implementations behind the same interfaces later.
 */

export type MockHandler = (req: MockRequest) => MockResponse | Promise<MockResponse>;

export interface MockRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
}

export interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

type RouteEntry = {
  parts: string[];
  keys: string[];
  method: string;
  handler: MockHandler;
};

export class MockServiceRegistry {
  private routes: RouteEntry[] = [];
  private globalMiddleware: Array<(req: MockRequest, next: () => MockResponse | Promise<MockResponse>) => MockResponse | Promise<MockResponse>> = [];

  register(method: string, path: string, handler: MockHandler) {
    const parts = path.split('/').filter(Boolean);
    const keys = parts.filter((p) => p.startsWith(':')).map((p) => p.slice(1));
    const routeParts = parts.map((p) => (p.startsWith(':') ? '*' : p));
    this.routes.push({ parts: routeParts, keys, method: method.toUpperCase(), handler });
  }

  use(middleware: (req: MockRequest, next: () => MockResponse | Promise<MockResponse>) => MockResponse | Promise<MockResponse>) {
    this.globalMiddleware.push(middleware);
  }

  async handle(req: MockRequest): Promise<MockResponse> {
    const run = async (index: number): Promise<MockResponse> => {
      if (index >= this.globalMiddleware.length) {
        const match = this.match(req.path);
        if (!match) return { status: 404, body: { error: 'not found', path: req.path } };
        req.params = match.params;
        return match.handler(req);
      }
      const mw = this.globalMiddleware[index];
      return mw(req, () => run(index + 1));
    };
    return run(0);
  }

  private match(path: string): { handler: MockHandler; params: Record<string, string> } | undefined {
    const pathParts = path.split('/').filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== 'GET' && route.method !== 'POST' && route.method !== 'DELETE' && route.method !== 'PATCH') continue;
      if (route.parts.length !== pathParts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < route.parts.length; i++) {
        const expected = route.parts[i];
        const actual = pathParts[i];
        if (expected === '*') {
          params[route.keys[route.keys.length - 1]] = actual;
        } else if (expected !== actual) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const named: Record<string, string> = {};
      route.keys.forEach((k, idx) => (named[k] = params[k] || ''));
      return { handler: route.handler, params: named };
    }
    return undefined;
  }
}

export const registry = new MockServiceRegistry();
