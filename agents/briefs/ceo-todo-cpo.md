# Mission Brief — CPO
Mission ID: CEO-TEST-202608031146
From: CEO
Reports To: CEO
Owner: CPO

## Objective
Align the product surface across `apps/brain-console` and `apps/poolleague` with `ORG.md` and the published roadmap.

## Primary Actions
1. **Close poolleague Playwright regression** — 5 tests fail on `/login`, `/events`, and `/tournaments/undefined` 404s. Validate router/routes and ensure the app shell and flows are functional again.
2. **Reduce brain console backlog exposure** — `.forgeos-todo.md` shows high-impact UX items behind shipped features: model fallback chains, font/contrast controls, and destructive-action confirmation coverage. Prioritize these for the next release slice.
3. **Define shared design-system contract** — poolleague has `design-system.md`; brain console panel styles are inconsistent. Produce a single agreed token set before next round of UI work.

## Success Criteria
- poolleague user-journey tests pass or are explicitly marked pending infrastructure.
- Brain console backlog is trimmed to a single prioritized `vNext` slice.
- One shared design-system/contract doc exists across apps.
