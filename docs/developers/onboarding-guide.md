# ForgeOS Brain-Console — Developer Onboarding Guide

Welcome to the ForgeOS `brain-console`. This guide gets a new developer from
zero to a running, testable local build and explains the conventions you need
to extend the app.

## Overview

The **brain-console** is the web control surface for ForgeOS. It is a single
Node app with two halves:

- **Client** — a React + Vite single-page app (SPA) in `src/client/`. It is
  built with `npm run build:client`, which emits a static bundle into `dist/`.
- **Server** — a small **Express** app (`server.ts`) that serves the built SPA
  from `dist/` (with a `public/` fallback for static assets) and exposes the
  JSON APIs the client calls. By default it listens on **port 7777**
  (`PORT` env var overrides it).

So the only process you run in production/PM2 is `server.ts`: it both serves
the UI and answers the `/api/*` routes. There is no separate frontend dev
server required once the client is built.

## Prerequisites

- **Node.js 20+** (the VPS runs Node 24; CI expects ≥20). Use `nvm` or your
  OS package manager to match.
- **The repo** checked out at `/opt/forgeos` (on the VPS the active worktree is
  `/opt/forgeos-wt/wave1-onboarding`). From the repo root the app lives at
  `apps/brain-console`.
- **(Optional) Ollama** for local embeddings / LLM features. If you don't have
  it, the console still runs; embedding-dependent features will degrade
  gracefully.
- **No `npm install` needed in the app root** for the server — it runs via
  `tsx` against the already-present `node_modules` (hardlinked in the VPS
  worktree). The client build step will `npm install` inside `src/client`.

## Run locally

From the repo root:

```bash
cd apps/brain-console
npm run build:client      # builds the React SPA into dist/
npx tsx server.ts         # starts Express on http://localhost:7777
```

Then open **http://localhost:7777** in your browser.

> `npm run build:client` is `cd src/client && npm install && npm run build`.
> `npx tsx server.ts` is what the `serve` script does. The combined `npm start`
> does both in one shot.

### On the VPS (PM2)

The production process is managed with PM2 so it survives restarts:

```bash
pm2 start npx --name forgeos -- tsx server.ts
pm2 save
```

The `--name forgeos` label is what the ops runbooks reference when restarting
or checking logs (`pm2 logs forgeos`).

## Run tests

The app uses Node's built-in test runner (via `tsx`):

```bash
cd apps/brain-console
npx tsx --test
```

This is the `test` script (`npm test`). It discovers `*.test.ts` / `__tests__`
files. End-to-end specs (Playwright) are a separate script: `npm run e2e`.

## Project structure

```
apps/brain-console/
├── server.ts                      # Express entrypoint: serves dist/ + public/, mounts /api
├── src/
│   ├── server/
│   │   ├── runtime.ts             # createRuntime(): process/agent runtime, audit export, SSE
│   │   └── ratelimit.ts           # rateLimit() + getRateLimitSnapshot()
│   ├── client/
│   │   └── src/
│   │       ├── App.tsx            # The SPA: routes, panels, api<T>() + usePathRoute() helpers
│   │       ├── main.tsx           # SPA bootstrap
│   │       ├── styles/
│   │       │   └── design.css     # CSS-first design system (tokens, themes, component classes)
│   │       └── panelkit.tsx       # Reusable panel/UI primitives
│   └── lib/
│       └── api.ts                 # Shared API client (api object, offline queue)
├── public/                        # Static assets served as a fallback
├── dist/                          # Built SPA output (gitignored, produced by build:client)
└── docs/                          # App-level docs (this file lives in repo docs/developers/)
```

Notes that matter when you edit:

- **`server.ts`** is the single HTTP surface. Static files come from `dist/`
  first, then `public/`. API routes are mounted under `/api`.
- **`src/server/runtime.ts`** hosts the in-process runtime, the audit trail
  (`pushAudit`, exposed via `/api/export/*slug`), and the Server-Sent Events
  stream (`text/event-stream`). There is **no separate `sse.ts` or
  `auditExport.ts`** — both live here.
- **`src/server/ratelimit.ts`** exposes `rateLimit()` middleware and
  `getRateLimitSnapshot()` for observability.
- **`src/client/src/App.tsx`** is the SPA. It defines two local helpers you
  should reuse: `api<T>(path, init)` (typed fetch wrapper) and `usePathRoute()`
  (clean-URL client routing with `navigate`).
- **`src/client/src/styles/design.css`** is the design system. Theming and
  component styling are CSS-first via CSS variables and class names.
- **`src/lib/api.ts`** is a separate, shared API client (`api` object +
  `replayOfflineQueue`) used where the App-local helper isn't in scope.

## How to add a panel

Panels are CSS-first. Follow this order so you don't fight the design system:

1. **Add your styles in `src/client/src/styles/design.css` first.** Define new
   class names (or extend existing tokens) there. Keep visual changes in CSS —
   do not inline large style objects in TSX.
2. **Then wire the panel into `src/client/src/App.tsx`.** Reuse the existing
   primitives in `panelkit.tsx` where possible.
3. **Use the typed API helper.** Call `api<T>('/api/...')` for backend data
   instead of raw `fetch`, so responses stay typed.
4. **Use clean URLs via `usePathRoute()`.** Grab `{ path, navigate }` from
   `usePathRoute()` to switch views instead of mutating component state by
   hand. This keeps the address bar and deep-links working.

Example shape inside `App.tsx`:

```tsx
const { navigate } = usePathRoute();
const data = await api<MyType>('/api/command?cmd=' + encodeURIComponent(cmd));
// render <section className="panel my-panel"> ... </section>
```

If your panel needs a new backend route, add it in `server.ts` (or in
`runtime.ts` via the router) following the existing `/api/*` pattern, and add a
`mocha`/`node:test` case under `__tests__`.

## Conventions

- **Strict TypeScript style.** Prefer explicit types, avoid `any`, and keep the
  `noUnusedLocals` discipline (no unused variables/imports). The repo's
  `tsconfig.json` is the source of truth for compiler flags — tighten rather
  than loosen when you touch it.
- **Narrow patches, not large rewrites.** When editing `App.tsx` (which is
  large), make a small, targeted change rather than rewriting the whole file.
  Keep diffs reviewable.
- **Verify before you push:**
  - `npm run build:client` — the client must build cleanly into `dist/`.
  - `npm test` (`npx tsx --test`) — the unit/integration suite must pass.
- **Server runs via `tsx`, not a compiled `node` start.** Don't add a build
  step for the server; `server.ts` is executed directly.
- **Static assets:** put shipped assets in `public/`; built client output goes
  to `dist/` (gitignored).

## Related docs

- [API reference](./api-reference.md) — endpoint and type contracts for `/api/*`.
- `docs/developers/agents.md`, `plugins.md`, `themes.md`, `docker.md` — deeper
  dives maintained alongside this guide.
- `apps/brain-console/README.md`, `DEPLOY.md`, `SECURITY-GAPS.md`,
  `STATUS-AND-ROADMAP.md` — app-level status and deployment notes.
