# feat-ratelimit-telemetry (client)

> Client feature — `src/client/src/features/feat-ratelimit-telemetry.tsx`

**Mounts at:** `/feature/ratelimit-telemetry` · **Label:** hot · **Category:** Observability

Rate-Limit Telemetry feature -- conflict-free. Auto-appears in the sidebar / command palette with NO edits to App.tsx or server.ts. Complements the Rate-Limit Dashboard (which shows remaining budget) by showing ENFORCEMENT: which routes actually returned HTTP 429, how often, and when they were last rejected. Note: this project uses the automatic JSX runtime, so you do NOT import React.

## API calls

- `/api/rate-limit/telemetry`

---

_Auto-generated from source. Edit the module to change behaviour._
