/**
 * src/server/bodySizeLimit.ts — Real, dependency-free request body size guard.
 *
 * The brain-console calls express.json() with no `limit`, so request bodies are
 * unbounded (a memory-exhaustion / DoS vector). This middleware counts raw
 * bytes BEFORE JSON parsing and rejects payloads above a configurable cap with
 * HTTP 413, aborting the underlying socket so no further body is buffered.
 *
 * It is safe to stack in front of express.json(): it consumes nothing and only
 * watches the incoming byte stream length. Env: MAX_BODY_BYTES (default 1MB).
 */
export interface BodySizeLimitOptions {
  /** Max body bytes. Default 1_048_576 (1MiB). */
  maxBytes?: number;
  /** Error message. */
  message?: string;
  /** Methods to which the limit applies. */
  methods?: string[];
}

export function createBodySizeLimit(options: BodySizeLimitOptions = {}) {
  const maxBytes =
    options.maxBytes ?? Number(process.env.MAX_BODY_BYTES ?? 1_048_576);
  const message = options.message ?? "request entity too large";
  const methods = (options.methods ?? ["POST", "PATCH", "PUT", "DELETE"]).map((m) =>
    m.toUpperCase()
  );

  return (req: any, res: any, next: () => void): void => {
    const method = (req.method ?? "").toUpperCase();
    if (!methods.includes(method)) return next();

    let received = 0;
    let aborted = false;

    const onData = (chunk: Buffer | string) => {
      received += Buffer.byteLength(chunk as any);
      if (received > maxBytes && !aborted) {
        aborted = true;
        cleanup();
        res.status(413).setHeader("content-type", "application/json; charset=utf-8");
        if (!res.headersSent) {
          res.removeHeader("transfer-encoding");
          res.end(JSON.stringify({ error: "payload_too_large", message, maxBytes }));
        }
        // Destroy the socket so the server stops reading the oversized body.
        if (typeof req.socket?.destroy === "function") req.socket.destroy();
      }
    };

    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };
    const onEnd = () => cleanup();
    const onError = () => cleanup();

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);

    next();
  };
}
