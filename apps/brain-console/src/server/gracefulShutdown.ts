/**
 * src/server/gracefulShutdown.ts — Real, dependency-free graceful shutdown.
 *
 * The brain-console's server.ts called app.listen() without capturing the
 * server or installing signal handlers, so pm2 restarts hard-cut in-flight
 * requests. This module installs SIGTERM/SIGINT handlers that:
 *   1. stop accepting new connections,
 *   2. broadcast a shutdown notice over SSE (if a hub is provided),
 *   3. wait up to a grace period for in-flight requests to finish,
 *   4. force-close and exit 0.
 *
 * The core decision logic (buildShutdownPlan) is pure and unit tested;
 * installGracefulShutdown wires the process signals.
 */
import type { Server } from "node:http";

export interface GracefulShutdownOptions {
  server: Server;
  /** Called to notify connected clients (e.g. SSE hub broadcast). */
  onShutdown?: (reason: string) => void;
  /** Grace period in ms before force-close. Default 10000. */
  graceMs?: number;
  /** Override process.exit (tests inject a spy). */
  exit?: (code: number) => void;
  /** Log function. */
  log?: (msg: string) => void;
}

export interface ShutdownPlan {
  reason: string;
  graceMs: number;
  hasServer: boolean;
}

export function buildShutdownPlan(signal: string, options: GracefulShutdownOptions): ShutdownPlan {
  return {
    reason: signal,
    graceMs: options.graceMs ?? 10_000,
    hasServer: !!options.server,
  };
}

/**
 * Install SIGTERM/SIGINT handlers. Returns a function that, when called,
 * performs the shutdown (also used by tests to trigger deterministically).
 */
export function installGracefulShutdown(options: GracefulShutdownOptions): (signal: string) => void {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? ((m: string) => console.log(`[graceful-shutdown] ${m}`));
  const graceMs = options.graceMs ?? 10_000;
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const plan = buildShutdownPlan(signal, options);
    log(`received ${plan.reason}; grace period ${plan.graceMs}ms`);
    try {
      options.onShutdown?.(plan.reason);
    } catch {
      /* ignore broadcaster errors */
    }
    try {
      options.server.close((err?: Error) => {
        if (err) log(`server.close error: ${err.message}`);
        exit(0);
      });
    } catch (err) {
      log(`server.close threw: ${(err as Error)?.message ?? err}`);
      exit(0);
    }
    const timer = setTimeout(() => {
      log("grace period elapsed; forcing exit");
      exit(0);
    }, graceMs);
    if (typeof timer.unref === "function") timer.unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return shutdown;
}
