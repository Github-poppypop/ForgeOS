/**
 * src/server/authGate.ts — Real, dependency-free API token-auth gate.
 *
 * SECURITY-GAPS.md #1: the API is open without CONSOLE_TOKEN / JWT_SECRET.
 * This module gated by env:
 *   - If CONSOLE_TOKEN is set, bearer tokens must equal it (simple shared
 *     secret). Additionally, tokens issued by /api/auth/login (HMAC-signed,
 *     short-lived) are accepted when JWT_SECRET is configured.
 *   - When disabled (no CONSOLE_TOKEN and no JWT_SECRET), the gate is a no-op
 *     so the existing open dev server keeps working.
 *   - Public paths (health, login, SSE stream, static assets) are always open.
 *
 * Uses Node crypto for HMAC verification (constant-time). No external deps.
 */
import crypto from "node:crypto";

export const AUTH_HEADER = "authorization";

export interface AuthGateOptions {
  consoleToken?: string;
  jwtSecret?: string;
  /** Token TTL in seconds for login-issued tokens. */
  tokenTtlSec?: number;
  /** Paths always allowed without a token (prefix match). */
  publicPaths?: string[];
  disabled?: boolean;
}

export function createAuthGate(options: AuthGateOptions = {}) {
  const consoleToken = options.consoleToken ?? process.env.CONSOLE_TOKEN;
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET;
  const ttlSec = options.tokenTtlSec ?? 3600;
  const publicPaths = options.publicPaths ?? [
    "/api/health",
    "/api/auth/login",
    "/api/stream",
    "/api/csrf/token",
  ];
  const disabled = options.disabled ?? (typeof consoleToken !== "string" && typeof jwtSecret !== "string");

  function parseBearer(header: string | undefined): string | null {
    if (typeof header !== "string") return null;
    const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return m ? m[1] : null;
  }

  function verifySignedToken(token: string): boolean {
    if (!jwtSecret) return false;
    // Format: base64url(payload).base64url(hmac)  (our own compact scheme)
    const dot = token.indexOf(".");
    if (dot === -1) return false;
    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const expected = crypto
      .createHmac("sha256", jwtSecret)
      .update(payloadB64)
      .digest("base64url");
    const a = Buffer.from(sigB64);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    if (!crypto.timingSafeEqual(a, b)) return false;
    try {
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
        exp?: number;
      };
      if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) return false;
      return true;
    } catch {
      return false;
    }
  }

  /** Build a signed login token (used by /api/auth/login handler). */
  function issueToken(subject = "user"): string {
    const payload = Buffer.from(
      JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + ttlSec })
    ).toString("base64url");
    const sig = crypto.createHmac("sha256", jwtSecret ?? "unsigned").update(payload).digest("base64url");
    return `${payload}.${sig}`;
  }

  function isPublic(req: any): boolean {
    const url = (req.originalUrl || req.url || "/").split("?")[0];
    return publicPaths.some((p) => url === p || url.startsWith(p + "/")) ||
      !url.startsWith("/api/");
  }

  return {
    issueToken,
    isEnabled: () => !disabled,
    middleware: (req: any, res: any, next: () => void): void => {
      if (disabled) return next();
      if (isPublic(req)) return next();
      const token = parseBearer(req.headers?.authorization);
      if (!token) {
        res.status(401).json({ error: "unauthorized", message: "Missing bearer token" });
        return;
      }
      if (typeof consoleToken === "string" && token === consoleToken) return next();
      if (verifySignedToken(token)) return next();
      res.status(401).json({ error: "unauthorized", message: "Invalid bearer token" });
    },
  };
}
