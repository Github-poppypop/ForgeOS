// CSP Enforce feature — conflict-free.
// Moves the app's Content-Security-Policy from report-only behaviour to a fully
// ENFORCED policy (the same functional policy server.ts already emits, with the
// font-CDN allowances preserved) and adds enforcement telemetry: a report-uri /
// report-to sink that captures browser CSP violation reports.
//
// Violation reports are PERSISTED to disk as daily-rotated JSONL so they survive a
// `pm2 restart` (previously the buffer was in-memory only and every restart lost the
// security signal). Files are pruned after CSP_RETENTION_DAYS.
//
// Registered as a server feature: default-exports (router) => void and is auto-loaded
// by features/loader.ts. DOES NOT edit server.ts. The override middleware runs inside
// the runtime router (mounted after the global security-headers middleware), so it
// re-sets the response CSP to the enforced policy for every request.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Router } from 'express';

// Enforced policy mirrors server.ts but appends reporting directives.
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
  "report-to csp-endpoint",
].join('; ');

const CSP_REPORT_TO =
  '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}]}';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/brain-console/logs — overridable so tests can use a temp dir.
const CSP_LOG_DIR =
  process.env.FORGEOS_CSP_LOG_DIR || path.resolve(__dirname, '..', '..', '..', 'logs');
const CSP_RETENTION_DAYS = Number(process.env.FORGEOS_CSP_RETENTION_DAYS || 30);
const CSP_FILE_RE = /^csp-violations-(\d{4}-\d{2}-\d{2})\.jsonl$/;
const MAX_BUFFER = 1000;

type Violation = Record<string, unknown>;

// In-memory violation telemetry (hydrated from disk at boot).
const cspViolations: Violation[] = [];

function dayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function logFileFor(day = dayStamp()): string {
  return path.join(CSP_LOG_DIR, `csp-violations-${day}.jsonl`);
}

function ensureLogDir(): void {
  try {
    fs.mkdirSync(CSP_LOG_DIR, { recursive: true });
  } catch {
    /* best effort */
  }
}

/** Append one violation as a JSONL record. Never throws. */
function persistViolation(entry: Violation): void {
  try {
    ensureLogDir();
    fs.appendFileSync(logFileFor(), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    /* best effort — telemetry must never break the request */
  }
}

/** Delete rotated violation logs older than the retention window. Never throws. */
export function pruneCspLogs(now = Date.now()): number {
  let removed = 0;
  try {
    const cutoff = now - CSP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(CSP_LOG_DIR)) {
      const m = CSP_FILE_RE.exec(name);
      if (!m) continue;
      const stamp = Date.parse(`${m[1]}T00:00:00.000Z`);
      if (Number.isNaN(stamp) || stamp >= cutoff) continue;
      try {
        fs.unlinkSync(path.join(CSP_LOG_DIR, name));
        removed += 1;
      } catch {
        /* ignore individual failures */
      }
    }
  } catch {
    /* dir may not exist yet */
  }
  return removed;
}

/** Read the newest `limit` persisted violations, newest first. Never throws. */
export function readPersistedViolations(limit = 50): Violation[] {
  const out: Violation[] = [];
  try {
    const files = fs
      .readdirSync(CSP_LOG_DIR)
      .filter((f) => CSP_FILE_RE.test(f))
      .sort()
      .reverse();
    for (const f of files) {
      let lines: string[];
      try {
        lines = fs.readFileSync(path.join(CSP_LOG_DIR, f), 'utf8').split('\n');
      } catch {
        continue;
      }
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          out.push(JSON.parse(line) as Violation);
        } catch {
          /* skip malformed line */
        }
        if (out.length >= limit) return out;
      }
    }
  } catch {
    /* dir may not exist yet */
  }
  return out;
}

function countPersisted(): number {
  let total = 0;
  try {
    for (const f of fs.readdirSync(CSP_LOG_DIR)) {
      if (!CSP_FILE_RE.test(f)) continue;
      try {
        const txt = fs.readFileSync(path.join(CSP_LOG_DIR, f), 'utf8');
        total += txt.split('\n').filter((l) => l.trim()).length;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return total;
}

/** Record a violation to memory + disk. Exported for tests/other features. */
export function recordCspViolation(report: Violation): Violation {
  const entry: Violation = { ts: new Date().toISOString(), ...report };
  cspViolations.push(entry);
  if (cspViolations.length > MAX_BUFFER) {
    cspViolations.splice(0, cspViolations.length - MAX_BUFFER);
  }
  persistViolation(entry);
  return entry;
}

export default function registerCspEnforce(router: Router): void {
  // Survive restarts: rehydrate the in-memory buffer from disk, then prune old files.
  try {
    const hydrated = readPersistedViolations(MAX_BUFFER);
    for (let i = hydrated.length - 1; i >= 0; i -= 1) cspViolations.push(hydrated[i]);
    pruneCspLogs();
  } catch {
    /* best effort */
  }

  // Override the response CSP header with the enforced policy on every response.
  router.use((_req, res, next) => {
    res.set('Content-Security-Policy', CSP_POLICY);
    res.set('Report-To', CSP_REPORT_TO);
    next();
  });

  // Current enforced policy, for the client feature to display.
  router.get('/api/security/headers', (_req, res) => {
    res.json({ csp: CSP_POLICY });
  });

  // Violation counts: live buffer + durable on-disk total.
  router.get('/api/csp-report/count', (_req, res) => {
    res.json({
      count: cspViolations.length,
      persisted: countPersisted(),
      retention_days: CSP_RETENTION_DAYS,
    });
  });

  // Newest persisted violations, newest first.
  router.get('/api/csp-report/recent', (req, res) => {
    const raw = Number(req.query.limit);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(1, raw), 200) : 50;
    const violations = readPersistedViolations(limit);
    res.json({ count: violations.length, limit, violations });
  });

  // Violation report sink. Accepts application/csp-report and application/json.
  router.post(
    '/api/csp-report',
    express.json({ type: ['application/json', 'application/csp-report'] }),
    (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const report = (body['csp-report'] as Record<string, unknown>) ?? body;
      recordCspViolation(report);
      console.warn('[csp-enforce] violation report captured:', JSON.stringify(report));
      res.status(204).end();
    }
  );
}
