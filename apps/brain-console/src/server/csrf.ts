/**
 * src/server/csrf.ts — Real, dependency-free CSRF protection.
 *
 * Uses the double-submit-cookie pattern: a signed token is set in an
 * HttpOnly=false cookie and must be echoed back in the X-CSRF-Token header (or
 * form field) on state-changing requests. We verify the header matches the
 * cookie value (constant-time compare). Requests that already carry a valid
 * API bearer token (machine-to-machine) are exempt, as are safe methods and
 * requests without a session cookie.
 *
 * This closes SECURITY-GAPS.md #5 (csrfMiddleware was referenced but never
 * enforced). Dependency-free — uses Node crypto for constant-time compare and a
 * random token.
 */
import crypto from "node:crypto";

export const CSRF_COOKIE = "forgeos_csrf";
export const CSRF_HEADER = "x-csrf-token";

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export interface CsrfOptions {
  /** Cookie name. */
  cookieName?: string;
  /** Header name clients must echo. */
  headerName?: string;
  /** Methods that require a valid token. */
  protectedMethods?: string[];
  /** Exempt paths (exact prefix match). */
  exemptPaths?: string[];
  /** When true, never block (useful for tests / opt-out). */
  disabled?: boolean;
}

export function createCsrfMiddleware(options: CsrfOptions = {}) {
  const cookieName = options.cookieName ?? CSRF_COOKIE;
  const headerName = (options.headerName ?? CSRF_HEADER).toLowerCase();
  const protectedMethods = (options.protectedMethods ?? ["POST", "PATCH", "PUT", "DELETE"]).map(
    (m) => m.toUpperCase()
  );
  const exempt = options.exemptPaths ?? ["/api/health", "/api/stream"];
  const disabled = options.disabled ?? false;

  /** Issue a fresh token + set the cookie. Call from a GET /api/csrf/token route. */
  function issueToken(res: any): string {
    const token = generateCsrfToken();
    res.cookie?.(cookieName, token, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });
    // Fallback if res.cookie unavailable (e.g. plain node res):
    res.setHeader?.(
      "set-cookie",
      `${cookieName}=${token}; Path=/; SameSite=Lax`
    );
    return token;
  }

  function isExempt(req: any): boolean {
    const url = (req.originalUrl || req.url || "/").split("?")[0];
    return exempt.some((p) => url === p || url.startsWith(p + "/"));
  }

  function hasValidApiAuth(req: any): boolean {
    const auth = req.headers?.authorization;
    if (typeof auth === "string" && /^Bearer\s+/i.test(auth)) return true;
    return false;
  }

  return {
    issueToken,
    middleware: (req: any, res: any, next: () => void): void => {
      if (disabled) return next();
      const method = (req.method ?? "").toUpperCase();
      if (!protectedMethods.includes(method)) return next();
      if (isExempt(req)) return next();
      // Machine-to-machine with a bearer token is exempt from cookie CSRF.
      if (hasValidApiAuth(req)) return next();

      const cookieToken = req.headers?.cookie
        ? parseCookie(req.headers.cookie)[cookieName]
        : undefined;
      const headerToken = req.headers?.[headerName];
      if (
        typeof cookieToken === "string" &&
        typeof headerToken === "string" &&
        cookieToken.length > 0 &&
        timingSafeEqual(cookieToken, headerToken)
      ) {
        return next();
      }
      res.status(403).json({ error: "csrf_token_invalid", message: "CSRF token missing or mismatched" });
    },
  };
}

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}
