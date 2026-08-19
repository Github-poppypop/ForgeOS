// Backbone feature bridge: wires the already-implemented SSE hub (../sse.ts) into the
// runtime router. Self-contained — no edits to runtime.ts. Loaded by features/loader.ts.
import type { Router } from 'express';
import { createSSEHub } from '../sse';

export default function registerSse(router: Router): void {
  const hub = createSSEHub();
  // Live brain-sync stream. Clients open an EventSource here.
  hub.register(router as unknown as Parameters<ReturnType<typeof createSSEHub>['register']>[0], '/api/brain/stream');
  // Broadcast a periodic heartbeat so connected clients see live state.
  setInterval(() => {
    hub.broadcast('tick', { ts: new Date().toISOString() });
  }, 5000).unref();
}
