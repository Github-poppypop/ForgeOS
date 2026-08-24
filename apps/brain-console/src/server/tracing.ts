/**
 * src/server/tracing.ts — Real request tracing for the brain-console server.
 *
 * Deliverable (the part that actually matters in production):
 *   - Every HTTP request is assigned a trace id.
 *   - The trace id is returned to the caller in the `x-trace-id` response header.
 *   - An inbound `x-trace-id` header (from an upstream gateway/proxy) is honored
 *     and continued, so a single logical request keeps one id across hops.
 *   - The trace id is attached to structured logs emitted for the request.
 *
 * OpenTelemetry integration: we use the installed @opentelemetry/api Tracer to
 * start a span per request. Without an installed SDK/exporter (@opentelemetry/
 * sdk-trace-node + a SpanProcessor/Exporter) the spans are no-ops, but the
 * wiring is real and becomes observable the moment an exporter is added. All
 * OTel calls are wrapped so a missing SDK never breaks a request.
 */
import * as crypto from "node:crypto";
import { trace, SpanStatusCode, type Tracer } from "@opentelemetry/api";
import type { Request, Response, NextFunction } from "express";

export const TRACE_HEADER = "x-trace-id";

export interface TracingOptions {
  /** Called once per request with the resolved trace id (for log attachment). */
  logger?: (entry: { traceId: string; message: string }) => void;
  /** When true, also start an OpenTelemetry span per request. Default true. */
  otel?: boolean;
}

function newTraceId(): string {
  // 16 bytes -> 32 hex chars, compatible with W3C trace-id conventions.
  return crypto.randomBytes(16).toString("hex");
}

function getTracer(): Tracer {
  return trace.getTracer("forgeos-brain-console", "1.0.0");
}

/** Read the trace id previously attached to a request (e.g. from a route handler). */
export function getTraceId(req: Request): string | undefined {
  return (req as unknown as { traceId?: string }).traceId;
}

export function createTracingMiddleware(options: TracingOptions = {}) {
  const logger = options.logger ?? (() => {});
  const useOtel = options.otel !== false;

  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.headers[TRACE_HEADER];
    const traceId =
      typeof incoming === "string" && incoming.trim().length > 0
        ? incoming.trim()
        : newTraceId();

    // Make the id available to downstream handlers and to response logging.
    (req as unknown as { traceId: string }).traceId = traceId;
    res.locals = res.locals ?? {};
    res.locals.traceId = traceId;

    // Return the id to the caller.
    try {
      res.setHeader(TRACE_HEADER, traceId);
    } catch {
      /* header may already be sent in edge cases; ignore */
    }

    const route = (req.originalUrl || req.url || "/").split("?")[0];
    logger({ traceId, message: `request ${req.method} ${route}` });

    if (useOtel) {
      try {
        const span = getTracer().startSpan(`${req.method} ${route}`);
        span.setAttribute("http.method", req.method ?? "UNKNOWN");
        span.setAttribute("http.route", route);
        span.setAttribute("trace.id", traceId);
        span.setStatus({ code: SpanStatusCode.OK });
        // End on response finish so the span captures handler duration.
        res.once("finish", () => {
          try {
            span.end();
          } catch {
            /* no-op */
          }
        });
      } catch {
        /* OTel unavailable (no SDK) — tracing header still works */
      }
    }

    next();
  };
}

export { newTraceId };
