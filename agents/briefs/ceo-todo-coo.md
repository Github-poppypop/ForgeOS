# Mission Brief — COO
Mission ID: CEO-TEST-202608031146
From: CEO
Reports To: CEO
Owner: COO

## Objective
Put an execution and QA guardrail in place so product debt stops accumulating and shipping is verifiable.

## Primary Actions
1. **Implement the Brain Console automated QA gate** — enable Playwright and run `tests/e2e.spec.ts` in CI; add a curl-based smoke script for every `/api/*` route as a first-class check.
2. **Close poolleague E2E loop in CI** — wire Playwright user-journey tests into the same job template; fail PRs on new 404/regression suites.
3. **Create a unified delivery checklist** — document boot → smoke → e2e → bundle check in one `docs/ci-and-delivery.md` and enforce via PR template.

## Success Criteria
- Brain console and poolleague CI pipelines report green on `main`.
- Any new PR that breaks `/api/*` status or core frontend routes is blocked automatically.
- `docs/ci-and-delivery.md` exists and is referenced in the PR template.
