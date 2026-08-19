# feat-agentcache (client)

> Client feature — `src/client/src/features/feat-agentcache.tsx`

**Mounts at:** `/feature/agent-cache` · **Label:** Agent Cache · **Category:** Features

Client feature: Agent Cache UI — set/get/delete keys (with TTL) and view meta + keys. Conflict-free: auto-discovered by features/registry.ts; no edits to App.tsx or server.ts. Closes backlog item #25. Reuses existing design-system classes (panel, card, btn, input, table). Note: automatic JSX runtime — do NOT import React; import hooks directly.

## API calls

- `/api/agent-cache`
- `/api/agent-cache/`
- `/api/agent-cache/meta`

---

_Auto-generated from source. Edit the module to change behaviour._
