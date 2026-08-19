# feat-workspaces (client)

> Client feature — `src/client/src/features/feat-workspaces.tsx`

**Mounts at:** `/feature/workspaces` · **Label:** Shared Workspaces · **Category:** Features

Shared Workspaces feature — conflict-free. Auto-appears in the sidebar / command palette with NO edits to App.tsx or server.ts. Lets an operator create a workspace, join it with an agent name, post activity to the shared feed, and watch the live feed (polled every 4s). Reuses table-wrap/card/tag. Automatic JSX runtime: do NOT import React.

## API calls

- `/api/workspaces`
- `/api/workspaces/`

---

_Auto-generated from source. Edit the module to change behaviour._
