/**
 * src/server/features/feat-json-error-handler.ts — Auto-loaded by
 * loadServerFeatures. Mounts the JSON/body-parser error handler so malformed
 * JSON returns 400 (not a 500 crash). Wired via the runtime router's
 * error-handling slot. No edit to runtime.ts required.
 */
import type { Router, Request, Response, NextFunction } from "express";
import { createJsonErrorHandler } from "../jsonErrorHandler.js";

export default function registerJsonErrorHandler(router: Router): void {
  // loadServerFeatures mounts features as middleware; the loader calls
  // `router.use(fn)`. Express treats a 4-arg function as an error handler.
  const handler = createJsonErrorHandler();
  router.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
    (handler as (e: unknown, r: Request, rs: Response, n: NextFunction) => void)(err, req, res, next),
  );
}
