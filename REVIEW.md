# Review findings — apps/brain-console

Repo: `/opt/forgeos`
Branch: `master`
Status: clean except submodule drift in `apps/poolleague`

## Verified
- `apps/brain-console/server.ts:184-204` — missing `/api/openapi` route docs bug still exists; I fixed the stale docs block so `/api/openapi` now documents implemented additional routes (`/api/restore`, `/api/metrics`, `/api/agent/*`, `/api/federation/remote`, `/api/webhooks`, `/api/plugins`, `/api/hotreload`, `/api/state`, `/api/auth/login`, `/api/capture/batch`, `/api/import`, `/api/export/{slug}`).

## Findings
1. `server.ts` additional-routes metrics coverage is incomplete.
   - `server.ts:510-526` injects a tracking wrapper for `/api/*`.
   - `server.ts:440-494` defines additional routes like `/api/capture/batch`, `/api/export/:slug`, `/api/import`, `/api/metrics/prometheus`, `/api/hotreload`.
   - However, these handlers do not call `log(req, ...)`, so `/api/logs` or any future log-backed view cannot trust `metrics.byRoute` for those paths.
   - Risk: low/medium.

2. Frontend API surface declares routes with no server handler.
   - `src/lib/api.ts:32-55` references `/api/auth/login`, `/api/state`, `/api/restore`, `/api/metrics`, `/api/agent/workflows`, `/api/agent/messages`, `/api/agent/metrics`, `/api/federation/remote`, `/api/webhooks`, `/api/plugins`, `/api/capture/batch`, `/api/import`.
   - `server.ts:440-494` does implement batch/import/export/prometheus/hotreload.
   - Remaining gaps: `/api/auth/login`, `/api/state`, `/api/restore`, `/api/metrics`, `/api/agent/workflows`, `/api/agent/messages`, `/api/agent/metrics`, `/api/federation/remote`, `/api/webhooks`, `/api/plugins`.
   - Risk: medium for frontend UX; calls will 404.

3. Test coverage does not cover additional routes.
   - `tests/unit/api.spec.ts` and `tests/unit/api-extended.spec.ts` only test core routes.
   - No tests for `/api/capture/batch`, `/api/export/:slug`, `/api/import`, `/api/metrics/prometheus`, `/api/hotreload`.
   - Risk: medium.

4. `apps/poolleague` has dirty working tree/submodule changes.
   - `git status` shows modified and untracked content under `apps/poolleague`.
   - Risk: low for brain-console, but indicates mixed workspace state.

5. No `bun` runtime available in this Linux session.
   - `bun test tests/unit` fails with `bun: command not found`.
   - This repo is otherwise Windows/MSYS-oriented per `AGENTS.md`.
   - Risk: blocks verification in this environment; not a code bug.

## Recommendation
- Fix #2 by either implementing missing server handlers or removing unused frontend client methods.
- Fix #3 by adding at least one unit test per additional route.
- Optionally fix #1 by adding `log(req, Date.now() - t0, status)` in additional route handlers if logging coverage matters.
