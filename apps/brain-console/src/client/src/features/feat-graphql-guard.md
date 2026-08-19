# feat-graphql-guard (client)

> Client feature — `src/client/src/features/feat-graphql-guard.tsx`

**Mounts at:** `/feature/graphql-guard` · **Label:** GraphQL Guard · **Category:** Features

GraphQL Guard feature — conflict-free. Auto-appears in the sidebar / command palette with NO edits to App.tsx or server.ts (discovered via import.meta.glob in features/registry.ts). Shows the server's current query limits and lets an operator paste a query to validate it (local depth/complexity preview + a live POST against the guarded endpoint). Note: this project uses the automatic JSX runtime, so you do NOT import React.

## API calls

- `/api/graphql`
- `/api/graphql/limits`

---

_Auto-generated from source. Edit the module to change behaviour._
