# feat-graphql

> Server feature — `src/server/features/feat-graphql.ts`

GraphQL endpoint with depth & complexity limiting. Self-contained feature: discovers nothing, just registers routes on the runtime router. Loaded by features/loader.ts. No edits to runtime.ts.  The `graphql` package is not a project dependency, so we guard the query by (1) counting brace-nesting depth and (2) counting field-selection nodes via a lightweight scan. Both are crash-proof (wrapped in try/catch) so a malformed query yields a 400 instead of crashing the server.

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/graphql/limits` |
| POST | `/api/graphql` |

---

_Auto-generated from source. Edit the module to change behaviour._
