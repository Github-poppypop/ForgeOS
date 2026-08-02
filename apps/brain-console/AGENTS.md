# AGENTS.md — ForgeOS Brain Console (autonomous management contract)

_This file is the single source of truth for any Hermes session, subagent, or cron job
working on this app. It is auto-loaded on `/new` in this directory and re-read by the
cron orchestrator every cycle. If a session is unsure what to do, it reads THIS file._

## Product
The ForgeOS Brain Console is a single Bun process (`server.ts`) on **port 7777** serving
both a SPA (plain ES module at `/src/app.js`, NO build step) and a REST API over the
isolated gbrain at `C:\ForgeOS`. It is the public face of ForgeOS governance/brains.

## Non-negotiable invariants (do NOT violate)
1. **No build step.** The SPA is served as-is from `src/app.js`. `bun build` is BROKEN in
   this env (EPERMs on `C:\`). Never introduce a bundler, never make `index.html` load a
   bundled file. `package.json` `start`/`dev` = `bun run server.ts` only.
2. **Keep `src/app.ts` and `src/app.js` in sync.** `app.js` is the source of truth; after
   editing the SPA, copy `app.js -> app.ts`.
3. **Static assets get `Cache-Control: no-cache`** (server.ts `serveStatic`) and the
   script tag carries a `?v=N` cache-buster. Bump `?v=` on SPA changes.
4. **`localhost:7777` is the server.** The chat's built-in browser is a REMOTE sandbox and
   CANNOT reach it — verify with `curl http://127.0.0.1:7777/...`, never the chat browser.
5. **Governance is sacred** (`C:\Projects\ForgeOS\governance`): immutable except by
   constitutional amendment. The console only READS it (never captures into it).
6. **Irreversible actions** (delete brain pages, push to remote, deploy) require explicit
   user confirmation — subagents must not do these autonomously.
7. **Never `taskkill` the server.** The server is owned by the Windows Task Scheduler task `ForgeOSBrainConsole`. If you need a restart, write it as a `[BLOCKER]` in `.forgeos-todo.md` and let the watchdog/task scheduler handle it. Killing the task-owned process causes a race and orphaned state.
8. **No `bun build`** — it is broken in this environment (EPERM on `C:\`).

## How to run the server
```
cd C:\Projects\ForgeOS\apps\brain-console
export GBRAIN_HOME="C:\ForgeOS"; export GBRAIN_CWD="C:\Users\pop\forge-gbrain"
export OLLAMA_BASE_URL="http://localhost:11434/v1"; export GBRAIN_EMBEDDING_DIMENSIONS=1024
unset DATABASE_URL; export PORT=7777
bun run server.ts
```
Persistent uptime is handled by the Windows Task Scheduler task **`ForgeOSBrainConsole`**
(ONLOGON, Highest). To (re)start manually: `schtasks /Run /TN ForgeOSBrainConsole`.

## Definition of done (a change is "shipped" only when ALL hold)
- [ ] `node --check src/app.js` passes (SPA syntax valid)
- [ ] `bun run server.ts` boots and `curl -fsS http://127.0.0.1:7777/api/status` returns 200
      with `gbrain_health.status:"ok"`
- [ ] Every touched `/api/*` route returns its expected status (smoke loop)
- [ ] If SPA changed: served bytes match disk; `TITLES` defined before `route()`
- [ ] `src/app.ts` re-synced if `src/app.js` changed
- [ ] No new `bun build` dependency introduced
- [ ] Change summarized in <=3 lines referencing the real command output

## Autonomous directive (for orchestrator / subagents)
- **Default to action** on safe, reversible steps. Do not ask "continue?" after each step.
- **Verify before claiming** — run the command, read output, state concise outcome.
- **Parallelize independent work; serialize verification.** Fan out via delegate_task;
  gate the next wave on fresh test/build results.
- **Stop only on a real blocker** (tool fails twice on same path, env unavailable, irreversible
  action needed). On blocker: write the blocker to `.forgeos-todo.md` and alert the user.
- **Update `.forgeos-todo.md`** as the durable task ledger (survives session close).

## API surface (all under /api/*, JSON)
status · governance (sacred tree) · roles · schema · brains (multi-brain meta) ·
federation · audit · search?q= · page/<slug> · capture (POST) · embed (POST) ·
backup (POST gzip) · health/stream (SSE) · openapi
Frontend client: `src/lib/api.js`. Panels: `render<Name>` fns in `src/app.js`
(`route()` ~617, `shell()` ~589).

## Known issues (tracked, not blocking)
- Boot log shows `error: Cannot read file "C:\": EPERM` — non-fatal probe, server still serves.
- `/api/schema` cold-start slow (~1st call) due to gbrain CLI resolve; not a bug.
- `tests/e2e.spec.ts` (Playwright, enh #47) exists but unexecuted — Playwright not installed.

## Reference
Full status + 50 improvements: `STATUS-AND-ROADMAP.md` (this dir).
