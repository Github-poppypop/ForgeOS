# feat-auditstore (client)

> Client feature — `src/client/src/features/feat-auditstore.tsx`

**Mounts at:** `/feature/audit-store` · **Label:** Audit Store · **Category:** Features

Durable Audit Store viewer — conflict-free. Auto-appears in the sidebar / command palette with NO edits to App.tsx or server.ts. Shows store meta (size / generations / current line count) and a recent-entries table pulled from the in-memory mirror (GET /api/audit/store). The durable rotation + append endpoints are served by feat-auditstore.ts on the server; the existing audit export is untouched. Note: this project uses the automatic JSX runtime, so you do NOT import React.

## API calls

- `/api/audit/store`
- `/api/audit/store/meta`

---

_Auto-generated from source. Edit the module to change behaviour._
