# feat-deadletter (client)

> Client feature — `src/client/src/features/feat-deadletter.tsx`

**Mounts at:** `/feature/dead-letter` · **Label:** Dead-Letter Queue · **Category:** Features

Dead-Letter Queue feature — conflict-free. Auto-appears in the sidebar / command palette with NO edits to App.tsx or server.ts. Lists failed agent tasks captured in the server's dead-letter store, shows status tags, and exposes Retry (simulated re-dispatch) and Ack (remove) actions. Polls GET /api/agent/deadletter/meta every 5s for live counts. Note: automatic JSX runtime, so do NOT import React; import hooks directly.

## API calls

- `/api/agent/deadletter`
- `/api/agent/deadletter/meta`

---

_Auto-generated from source. Edit the module to change behaviour._
