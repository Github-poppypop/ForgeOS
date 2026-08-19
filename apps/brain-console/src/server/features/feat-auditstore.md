# feat-auditstore

> Server feature — `src/server/features/feat-auditstore.ts`

Durable audit-log store with size-based rotation.  This is ADDITIVE and conflict-free: it does NOT touch feat-auditexport.ts or runtime.ts. The existing audit export (GET /api/audit/export) remains as-is. What this adds: * Durable append-only persistence to logs/audit.jsonl * SIZE-BASED rotation: when the current file exceeds ~5MB it is rotated to audit.N.jsonl, keeping up to 5 generations (audit.1..audit.5.jsonl). * A fast in-memory ring buffer mirror (cap 500) for quick reads.  Endpoints (all under the shared feature router): POST /api/audit/append              body = audit entry object -> durable append GET  /api/audit/store               recent entries (ring buffer, newest first) GET  /api/audit/store?format=jsonl  stream the current audit.jsonl GET  /api/audit/store/meta          { bytes, generations, lines }  The audit entry shape follows auditExport.ts's AuditEntry (ts/method/path/status/ms/ip) but is intentionally permissive: any JSON object is accepted and stored as-is, with a server-stamped `ts` when missing.

## Endpoints

| Method | Path |
|--------|------|
| POST | `/api/audit/append` |
| GET | `/api/audit/store` |
| GET | `/api/audit/store/meta` |

---

_Auto-generated from source. Edit the module to change behaviour._
