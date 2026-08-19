# feat-alert-status (client)

> Client feature — `src/client/src/features/feat-alert-status.tsx`

**Mounts at:** `/feature/alert-status` · **Label:** Alerting Status · **Category:** Observability

Alerting Status feature — conflict-free. Auto-appears in the sidebar / command palette with NO edits to App.tsx or server.ts. Surfaces whether error alerts reach Sentry or an alert webhook, and lets an operator fire a manual self-test. Note: this project uses the automatic JSX runtime, so you do NOT import React.

## API calls

- `/api/alerting/status`
- `/api/alerting/test`

---

_Auto-generated from source. Edit the module to change behaviour._
