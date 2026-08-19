# feat-csp-enforce (client)

> Client feature — `src/client/src/features/feat-csp-enforce.tsx`

**Mounts at:** `/feature/csp-enforce` · **Label:** CSP Enforce · **Category:** Security

CSP Enforce feature — conflict-free. Shows the currently ENFORCED Content-Security-Policy and the live count of captured CSP violation reports. No edits to App.tsx / server.ts; auto-discovered by features/registry.ts. Automatic JSX runtime: do not import React.

## API calls

- `/api/csp-report/count`
- `/api/security/headers`

---

_Auto-generated from source. Edit the module to change behaviour._
