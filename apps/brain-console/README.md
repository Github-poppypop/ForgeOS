![Console CI](https://github.com/Github-poppypop/ForgeOS/actions/workflows/ci.yml/badge.svg)

# ForgeOS Brain Console

**Package:** `forgeos-brain-console`  
**Port:** 7777 (HTTP)  
**Runtime:** Node.js + Express — `npx tsx server.ts`  
**SPA:** React/Vite client built to `dist/`, served by Express

## What it is

The public face of ForgeOS. A single Node process serving:
- A React SPA built with Vite (`npm run build` outputs to `dist/`)
- A REST API over Express (`server.ts`)

## Quick start

```bash
cd C:\Projects\ForgeOS\apps\brain-console
npm install
npm run build
npx tsx server.ts
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

## Docs

- **Status + 50 improvements:** `STATUS-AND-ROADMAP.md`
- **Autonomous management contract:** `AGENTS.md`
- **Durable task ledger:** `.forgeos-todo.md`

## Invariants (non-negotiable)

1. No Bun runtime/config in this package.
2. Do NOT reintroduce `bun`, `bun:test`, `bun:build`, or Bun lockfiles.
3. Use Node + `npx tsx` for development and Node-compatible tests/CI.
4. `localhost:7777` only reachable from this machine; chat browser is a remote sandbox.
5. Governance (`C:\Projects\ForgeOS\governance`) is sacred — console only reads it.
