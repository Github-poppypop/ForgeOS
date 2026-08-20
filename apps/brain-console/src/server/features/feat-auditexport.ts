// Backbone feature bridge: exposes audit-log export (CSV/JSON/SQL) built on ../auditExport.ts.
// Self-contained — no edits to runtime.ts. Loaded by features/loader.ts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Router } from 'express';
import { exportAudit, type AuditFormat } from '../auditExport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Daily-rotated structured request logs written by server.ts (forgeos-<date>.log).
const LOG_DIR = path.resolve(__dirname, '..', '..', '..', 'logs');

const CONTENT_TYPES: Record<AuditFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  sql: 'application/sql',
};

export default function registerAuditExport(router: Router): void {
  router.get('/api/audit/export', async (req, res) => {
    const formatRaw = String(req.query.format ?? 'json');
    if (!['csv', 'json', 'sql'].includes(formatRaw)) {
      return res.status(400).json({ error: 'format must be csv|json|sql' });
    }
    const format = formatRaw as AuditFormat;
    const logDir = process.env.FORGEOS_AUDIT_LOG_DIR
      ? path.resolve(process.env.FORGEOS_AUDIT_LOG_DIR)
      : LOG_DIR;
    try {
      const body = await exportAudit(format, logDir);
      res.setHeader('Content-Type', `${CONTENT_TYPES[format]}; charset=utf-8`);
      res.setHeader('Content-Disposition', `attachment; filename="audit-export.${format}"`);
      res.status(200).send(body);
    } catch (err) {
      res.status(500).json({ error: String((err as Error)?.message ?? err) });
    }
  });
}
