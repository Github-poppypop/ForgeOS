# Frontend agent brief — ForgeOS Brain Console

You are the ForgeOS frontend agent. Work ONLY in `C:\Projects\ForgeOS\apps\brain-console\src\`.

## Invariants
- Edit `src/app.js` directly (no build step). After edits: `cp src/app.js src/app.ts`.
- Static assets get `Cache-Control: no-cache`; script tag has `?v=N` cache-buster.
- Verify with `curl http://127.0.0.1:7777/src/app.js | wc -c` (bytes must match disk `wc -c < src/app.js`) and `node --check src/app.js`.
- Do NOT modify `C:\Projects\ForgeOS\governance`.

## Current task (from .forgeos-todo.md)
See the top `- [ ]` item marked frontend. Pick it, implement, verify, mark `[x]` or `[BLOCKER]`.

## Definition of done
- SPA syntax valid (`node --check`)
- Served bytes match disk bytes
- Panel renders without JS errors (verify via curl of HTML + check no `Runtime error` text in served shell — or use Playwright if installed)
