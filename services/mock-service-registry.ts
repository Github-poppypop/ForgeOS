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
}

export interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export class MockServiceRegistry {
  private handlers = new Map<string, MockHandler>();
  private globalMiddleware: Array<(req: MockRequest, next: () => MockResponse | Promise<MockResponse>) => MockResponse | Promise<MockResponse>> = [];

  register(method: string, path: string, handler: MockHandler) {
    const key = `${method.toUpperCase()} ${path}`;
    this.handlers.set(key, handler);
  }

  use(middleware: (req: MockRequest, next: () => MockResponse | Promise<MockResponse>) => MockResponse | Promise<MockResponse>) {
    this.globalMiddleware.push(middleware);
  }

  async handle(req: MockRequest): Promise<MockResponse> {
    const key = `${req.method.toUpperCase()} ${req.path}`;
    const handler = this.handlers.get(key);

    const run = async (index: number): Promise<MockResponse> => {
      if (index >= this.globalMiddleware.length) {
        if (!handler) return { status: 404, body: { error: 'not found', path: req.path } };
        return handler(req);
      }
      const mw = this.globalMiddleware[index];
      return mw(req, () => run(index + 1));
    };

    return run(0);
  }
}

export const registry = new MockServiceRegistry();
