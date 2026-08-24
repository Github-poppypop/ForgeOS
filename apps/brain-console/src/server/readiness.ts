/**
 * src/server/readiness.ts — Real liveness/readiness split.
 *
 * /api/health already serves as liveness (process is up). This module adds a
 * distinct readiness probe (/api/ready) that reports whether the server is
 * actually able to serve traffic: it is NOT ready while a graceful shutdown is
 * in progress, and it verifies the data directory is writable (a common cause
 * of silent failure for the JSON-backed stores). This lets orchestrators
 * (pm2/k8s) stop routing during shutdown / degraded IO without killing the
 * process.
 */
import fs from "node:fs";
import path from "node:path";

export interface ReadinessReport {
  ready: boolean;
  shuttingDown: boolean;
  dataDirWritable: boolean;
  checks: Record<string, boolean>;
  ts: number;
}

export interface ReadinessOptions {
  /** Directory whose writability proves the store layer is healthy. */
  dataDir?: string;
  /** Injected shutdown flag (shared with the graceful-shutdown module). */
  isShuttingDown?: () => boolean;
  /** Override the writability probe (tests inject a deterministic one). */
  writableCheck?: () => boolean;
}

export function createReadiness(options: ReadinessOptions = {}) {
  const dataDir =
    options.dataDir ?? path.resolve(process.cwd(), "data");
  const isShuttingDown = options.isShuttingDown ?? (() => false);
  const writableCheck = options.writableCheck ?? dataDirWritable;

  function dataDirWritable(): boolean {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const probe = path.join(dataDir, ".ready-probe");
      fs.writeFileSync(probe, "1");
      fs.unlinkSync(probe);
      return true;
    } catch {
      return false;
    }
  }

  return {
    report(): ReadinessReport {
      const shuttingDown = isShuttingDown();
      const writable = writableCheck();
      const checks = {
        notShuttingDown: !shuttingDown,
        dataDirWritable: writable,
      };
      const ready = Object.values(checks).every(Boolean);
      return { ready, shuttingDown, dataDirWritable: writable, checks, ts: Date.now() };
    },
  };
}
