# ForgeOS VPS Agent Farm — briefs

Each tmux session `forgeos-farm-N` runs a hermes chat with one of these briefs
pre-injected. Copy the matching block into the session via:
```bash
tmux send-keys -t forgeos-farm-1 "$(cat agents/briefs/<file>.md)" Enter
```

## Concerns

| Session | Concern | Brief file | Primary deliverable |
|---|---|---|---|
| farm-1 | **backend** | backend.md | /api/* routes, gbrain wrappers, error handling |
| farm-2 | **frontend** | frontend.md | SPA panels, UX, a11y, themes |
| farm-3 | **tests** | tests.md | Playwright e2e, unit tests, smoke.sh |
| farm-4 | **docs** | docs.md | README, STATUS-AND-ROADMAP, agent docs |
| farm-5 | **governance** | governance.md | FES checks, RFC hygiene, amendment trails |
| farm-6 | **security** | security.md | Headers, slug validation, auth, rate limits |
| farm-7 | **infra** | infra.md | Docker, CI, deploy, VPS tmux farm |
| farm-8 | **agents** | agents.md | C-suite agent skills, gbrain wiring, MCP |
| farm-9 | **verification** | verification.md | End-to-end verification, byte-checks, regression |
| farm-10 | **orchestrator** | orchestrator.md | Reads ledger, picks top item, delegates to 1-9 |

## Orchestrator loop (farm-10)
The orchestrator does NOT implement features. It:
1. Reads `apps/brain-console/.forgeos-todo.md`
2. Picks the top safe pending item
3. Delegates to the appropriate farm session (or does it directly if trivial)
4. Verifies, marks [x], reports

## Brief template
```markdown
You are the ForgeOS <concern> agent. Work ONLY in C:\Projects\ForgeOS\<your-dir>.

Invariants:
- No bun build (EPERM trap). SPA served as-is.
- Verify with curl, not chat browser.
- Never modify C:\Projects\ForgeOS\governance except by amendment.
- Update .forgeos-todo.md when done.

Your current task from the ledger: <paste the item here>

Definition of done: <specific to concern>
```
