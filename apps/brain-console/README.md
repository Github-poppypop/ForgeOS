![Console CI](https://github.com/Github-poppypop/ForgeOS/actions/workflows/ci.yml/badge.svg)

# ForgeOS Brain Console

**Package:** `forgeos-brain-console`  
**Port:** 7777 (HTTP)  
**Runtime:** Bun — `bun run server.ts`  
**SPA:** served directly as ES module (`src/app.js`), **no build step**

## What it is

The public face of ForgeOS. A single Bun process serving:
- A plain-JS SPA (no bundler, no build step)
- A REST API over the isolated `gbrain` at `C:\ForgeOS` (PGLite + Ollama embeddings)

## Why no build step

`bun build` is broken in this environment (EPERMs on `C:\`). The SPA is hand-edited and
served as-is from `src/app.js`. `src/app.ts` is kept in sync with `src/app.js` but is not
compiled. Do NOT introduce a bundler, webpack, or any tool that writes a bundled output.

## Quick start

```bash
cd C:\Projects\ForgeOS\apps\brain-console
export GBRAIN_HOME="C:\ForgeOS"
export GBRAIN_CWD="C:\Users\pop\forge-gbrain"
export OLLAMA_BASE_URL="http://localhost:11434/v1"
export GBRAIN_EMBEDDING_DIMENSIONS=1024
unset DATABASE_URL
export PORT=7777
bun run server.ts
# → http://127.0.0.1:7777
```

## Persistent uptime

Registered Windows Task Scheduler task **`ForgeOSBrainConsole`** (ONLOGON, Highest).
Server auto-starts at every user logon. Manual restart: `schtasks /Run /TN ForgeOSBrainConsole`.

## Verify

```bash
bash scripts/smoke.sh                  # all /api/* routes, exits non-zero on failure
bash scripts/watchdog.sh               # health check; alerts on problem, silent when green
curl -fsS http://127.0.0.1:7777/api/status   # quick single-check
```

## Tests

`tests/e2e.spec.ts` (Playwright) exists but requires Playwright install:
```bash
bun add -d @playwright/test && bunx playwright install chromium && bunx playwright test
```

## Docs

- **Status + 50 improvements:** `STATUS-AND-ROADMAP.md`
- **Autonomous management contract:** `AGENTS.md`
- **Durable task ledger:** `.forgeos-todo.md`

## Invariants (non-negotiable)

1. No build step. SPA served as-is from `src/app.js`.
2. `src/app.ts` re-synced if `src/app.js` changes.
3. Static assets: `Cache-Control: no-cache` + `?v=N` cache-buster.
4. `localhost:7777` only reachable from this machine; chat browser is a remote sandbox.
5. Governance (`C:\Projects\ForgeOS\governance`) is sacred — console only reads it.
