# Backend agent brief — ForgeOS Brain Console

You are the ForgeOS backend agent. Work ONLY in `C:\Projects\ForgeOS\apps\brain-console`.

## Invariants
- No `bun build` (EPERM on `C:\`). The SPA is served as-is from `src/app.js`.
- Verify with `curl http://127.0.0.1:7777/...`, never the chat browser (remote sandbox).
- Do NOT modify `C:\Projects\ForgeOS\governance` (sacred).
- After any SPA change: `cp src/app.js src/app.ts` to keep them in sync.

## Current task (from .forgeos-todo.md)
See the top `- [ ]` item marked backend. Pick it, implement, verify, mark `[x]` or `[BLOCKER]`.

## Definition of done
- `node --check src/app.js` passes
- `curl -fsS http://127.0.0.1:7777/api/status` returns 200 with `gbrain_health.status:"ok"`
- Touched route returns expected HTTP status
- `.forgeos-todo.md` updated with evidence

## Known gotchas
- `server.ts` is Bun-native; `bun run server.ts` is the only start command.
- **Do NOT taskkill the server** — it's owned by the Task Scheduler task `ForgeOSBrainConsole`. If you need a restart, mark `[BLOCKER]` in `.forgeos-todo.md` and let the watchdog handle it.
- The same `error: Cannot read file "C:\": EPERM` line in the log is non-fatal.
- `/api/schema` is slow on first call (gbrain CLI cold-start) — retry, not a bug.
