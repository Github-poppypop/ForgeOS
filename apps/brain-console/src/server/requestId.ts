/**
 * src/server/requestId.ts — Real, dependency-free request-ID correlation.
 *
 * The brain-console's structured request logger (server.ts) does NOT include
 * the trace/request id, so you cannot correlate a log line to an incoming
 * x-trace-id / x-request-id. This module:
 *   1. Extracts an inbound request id (x-trace-id || x-request-id) or generates
 *      one, and echoes it back on the response (x-request-id).
 *   2. Emits its own structured request log line that INCLUDES the id, so logs
 *      correlate to traces without editing server.ts.
 *
 * It is additive (server.ts keeps its own line); this guarantees the id is in
 * the log stream regardless. Self-contained and unit-tested.
 */
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export interface RequestIdOptions {
  /** Sink for structured request log lines (defaults to console). */
  log?: (line: Record<string, unknown>) => void;
  /** Header used for inbound trace id. Default x-trace-id. */
  inboundHeader?: string;
  /** Header used for the echoed response id. Default x-request-id. */
  outboundHeader?: string;
}

function getHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name.toLowerCase() as keyof typeof req.headers];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

export function createRequestId(options: RequestIdOptions = {}) {
  const log = options.log ?? ((line: Record<string, unknown>) => console.log(JSON.stringify(line)));
  const inboundHeader = options.inboundHeader ?? "x-trace-id";
  const outboundHeader = options.outboundHeader ?? "x-request-id";

  return (req: Request, res: Response, next: NextFunction): void => {
    const inbound = getHeader(req, inboundHeader) ?? getHeader(req, "x-request-id");
    const id = inbound && inbound.length > 0 ? inbound : randomUUID();
    (res.locals as Record<string, unknown>).requestId = id;
    res.setHeader(outboundHeader, id);

    const started = Date.now();
    res.on("finish", () => {
      const status = res.statusCode;
      log({
        ts: new Date().toISOString(),
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        event: "request",
        requestId: id,
        method: req.method,
        path: req.path,
        status,
        ms: Date.now() - started,
        ip: req.ip ?? "",
      });
    });
    next();
  };
}
