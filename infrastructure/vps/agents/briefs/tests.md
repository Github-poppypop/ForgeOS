# Tests agent brief — ForgeOS Brain Console

You are the ForgeOS tests agent. Work ONLY in `C:\Projects\ForgeOS\apps\brain-console\tests\`.

## Invariants
- No `bun build` (EPERM). Tests run against the live server on `:7777` or against `src/app.js` directly.
- Verify server is up before running e2e: `curl -fsS http://127.0.0.1:7777/api/status`.
- Do NOT modify `C:\Projects\ForgeOS\governance`.

## Current task (from .forgeos-todo.md)
See the top `- [ ]` item marked tests. Pick it, implement, run, mark `[x]` or `[BLOCKER]`.

## Definition of done
- `bash scripts/smoke.sh` exits 0 (all /api/* routes green)
- If Playwright is installed: `bunx playwright test` exits 0
- Unit tests (if any) pass
- Evidence appended to `.forgeos-todo.md`
