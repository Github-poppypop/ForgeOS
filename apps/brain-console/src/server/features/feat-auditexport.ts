// Backbone feature bridge: exposes audit-log export (SQL/JSON) built on ../auditExport.ts.
// Self-contained — no edits to runtime.ts. Loaded by features/loader.ts.
import type { Router } from 'express';
import { exportAudit } from '../auditExport';

export default function registerAuditExport(router: Router): void {
  router.get('/api/audit/export', (req, res) => {
    const format = req.query.format === 'sql' ? 'sql' : 'json';
    exportAudit(format, 'logs')
      .then((body) => {
        const ct = format === 'sql' ? 'application/sql' : 'application/json';
        res.setHeader('Content-Type', `${ct}; charset=utf-8`);
        res.setHeader('Content-Disposition', `attachment; filename="audit.${format}"`);
        res.status(200).send(body);
      })
      .catch((err) => {
        res.status(500).json({ error: String(err?.message ?? err) });
      });
  });
}
