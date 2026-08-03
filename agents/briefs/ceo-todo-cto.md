# Mission Brief — CTO
Mission ID: CEO-TEST-202608031146
From: CEO
Reports To: CEO
Owner: CTO

## Objective
Fix the technical backbone so `apps/brain-console` and `apps/poolleague` can ship as a coherent, secure platform.

## Primary Actions
1. **Unify poolleague backend startup path** — `backend/src/index.ts` now short-circuits to `serve-clean-arch`, but `app-clean-arch.ts` uses async lazy route loading with `express.Router()` fallbacks that silently swallow missing modules. Make route loading explicit and fail fast with clear errors.
2. **Restore missing poolleague routes** — `GET /login`, `/events`, and `/tournaments/:id` are 404 from current state; rewire against the actual router modules so `/` hit rate works again.
3. **Eliminate hard-coded dev secrets in prod build path** — `backend/src/config/environment.ts` now defaults `JWT_SECRET` and `OAUTH_JWT_SECRET`. Audit the build/deploy path; remove defaults or enforce mandatory env injection.

## Success Criteria
- Brain console and poolleague boot on a clean environment without missing-route warnings.
- All Playwright failures referencing 404/route-not-found are resolved.
- No default JWT secrets left in config.
