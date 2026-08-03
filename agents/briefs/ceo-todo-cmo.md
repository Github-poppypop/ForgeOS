# Mission Brief — CMO
Mission ID: CEO-TEST-202608031146
From: CEO
Reports To: CEO
Owner: CMO

## Objective
Align documentation and onboarding narrative with the actual shipped state of ForgeOS apps.

## Primary Actions
1. **Audit `apps/brain-console/STATUS-AND-ROADMAP.md` against current code** — verify phase claims, endpoints, and "shipped" labels match actual source; correct mismatches.
2. **Create `apps/poolleague/web/AGENTS.md`** — establish the single source of truth for sessions/subagents working on poolleague, including product invariants, run commands, and API surface.
3. **Document official onboarding path** — produce a concise onboarding doc under `docs/` that matches actual run commands, port bindings, and environment variables for both apps.

## Success Criteria
- `STATUS-AND-ROADMAP.md` discrepancies are resolved or marked explicitly as pending.
- `apps/poolleague/web/AGENTS.md` exists and covers product, invariants, run commands, and API surface.
- One canonical onboarding doc exists under `docs/` for new contributors or agents.
