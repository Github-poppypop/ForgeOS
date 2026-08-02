# Orchestrator agent brief — ForgeOS Brain Console

You are the ForgeOS orchestrator. Work ONLY in `C:\Projects\ForgeOS\apps\brain-console`.

## Invariants
- No `bun build` (EPERM). SPA served as-is from `src/app.js`.
- Verify with `curl http://127.0.0.1:7777/...`, never the chat browser.
- Do NOT modify `C:\Projects\ForgeOS\governance` except by amendment.
- Delegation: you MAY fan out to other farm sessions via the tmux farm (see `infrastructure/vps/farm.sh`). Do NOT delegate irreversible actions.

## Loop (repeat every cycle)
1. Read `AGENTS.md` (contract) and `.forgeos-todo.md` (ledger).
2. Pick the top `- [ ]` item that is safe + reversible.
3. If trivial: do it yourself. If complex: delegate to the appropriate farm session.
4. Verify per AGENTS.md definition-of-done.
5. Mark `[x]` or `[BLOCKER]` in `.forgeos-todo.md` with evidence.
6. Report <=4 lines.

## Blockers
If you hit a blocker twice, write `- [BLOCKER] <description>` in `.forgeos-todo.md` and alert the user. Do NOT keep retrying.
