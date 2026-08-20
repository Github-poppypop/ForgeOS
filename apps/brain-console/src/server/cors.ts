/**
 * src/server/cors.ts — Real, dependency-free CORS origin restriction.
 *
 * The brain-console previously set no CORS headers at all (fully open
 * cross-origin per SECURITY-GAPS.md #2). This module restricts
 * Access-Control-Allow-Origin to an explicit allowlist sourced from
 * CORS_ALLOWED_ORIGINS (comma-separated). Unknown origins get NO allow-origin
 * header (browsers then block cross-origin reads) — there is no "*" wildcard
 * unless the operator explicitly opts in. Pre-flight (OPTIONS) requests are
 * answered with the allowed methods/headers.
 */
export interface CorsOptions {
  /** Comma-separated allowed origins. Use "*" to allow any (not recommended). */
  allowedOrigins?: string;
  /** Allowed methods for pre-flight. */
  methods?: string[];
  /** Allowed request headers for pre-flight. */
  allowedHeaders?: string[];
  /** Whether credentials are allowed. */
  credentials?: boolean;
  /** Header name (usually Access-Control-Allow-Origin). */
  originHeader?: string;
}

export function resolveAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Determine the value to put in Access-Control-Allow-Origin for a request, or
 * null if the origin is not allowed (caller then sends nothing).
 */
export function corsOriginFor(
  requestOrigin: string | undefined,
  allowed: string[],
  allowWildcard: boolean
): string | null {
  if (!requestOrigin) return null;
  if (allowWildcard) return "*";
  if (allowed.length === 0) return null; // closed by default
  const normalized = requestOrigin.trim();
  if (allowed.includes(normalized)) return normalized;
  // Support Origin "*" entries meaning "reflect any" — but only when explicitly listed.
  if (allowed.includes("*")) return normalized;
  return null;
}

export function createCorsMiddleware(options: CorsOptions = {}) {
  const envOrigins = options.allowedOrigins ?? process.env.CORS_ALLOWED_ORIGINS;
  const allowed = resolveAllowedOrigins(envOrigins);
  const allowWildcard = allowed.includes("*");
  const methods = (options.methods ?? ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]).join(", ");
  const headers = (
    options.allowedHeaders ??
    ["content-type", "authorization", "x-trace-id", "idempotency-key"]
  ).join(", ");
  const credentials = options.credentials ?? false;
  const header = options.originHeader ?? "access-control-allow-origin";

  return (req: any, res: any, next: () => void): void => {
    const requestOrigin = req.headers?.origin as string | undefined;
    const allow = corsOriginFor(requestOrigin, allowed, allowWildcard);
    if (allow) {
      res.setHeader(header, allow);
      if (credentials) res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("access-control-allow-methods", methods);
      res.setHeader("access-control-allow-headers", headers);
      res.setHeader("vary", "origin");
    }
    // Answer pre-flights directly.
    if ((req.method ?? "").toUpperCase() === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}
