# Feature: Saved Views & Filters (`feat-savedviews`)

Closes **Batch B #11** — saved views/filters for the missions / vault / audit / ledger data panels.

## What it does
- Persists named filter presets per data panel to `data/saved-views.json` (gitignored runtime artifact).
- Re-applies a saved view against the live panel data: each filter field is matched as a
  case-insensitive substring, and all filters are AND-combined.
- Create / delete views from the UI or the API.

## API
- `GET  /api/saved-views?panel=vault` — list views (optionally filtered by panel)
- `POST /api/saved-views` — body `{ panel, name, filters: { field: "substring" } }` → `201`
- `GET  /api/saved-views/:id` — fetch one view
- `DELETE /api/saved-views/:id` — delete a view

## UI
Route `/feature/saved-views` (auto-added to the sidebar under **Knowledge**).
Pick a panel, name a view, paste a filter JSON object, save it, then **Apply** to
see the matching rows fetched live from the panel's API.

## Conflict-free
Server: `src/server/features/feat-savedviews.ts` (auto-loaded by `features/loader.ts`).
Client: `src/client/src/features/feat-savedviews.tsx` (discovered via Vite glob).
No edits to `App.tsx` / `runtime.ts` / `server.ts`.
