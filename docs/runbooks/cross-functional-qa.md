# Cross-functional QA runbook

**Owner:** COO · **Reviewers:** CPO, CTO, CFO  
**Applies to:** ForgeOS platform, brain-console, first app, marketplace, services.

## Scope
Use this runbook before every release candidate and after any governance change.

## Gate checklist
1. Unit tests green in `apps/*/` and root packages.
2. E2E smoke: brain-console panels load at `http://127.0.0.1:7777/#/dashboard`.
3. API contract: `GET /api/openapi` and `GET /api/config` respond.
4. Security: auth optional if `CONSOLE_TOKEN` is unset, required if set.
5. Accessibility: headings, buttons, and modals expose labels.
6. Performance: FCP within budget and no console errors.
7. Docs: `docs/developers/*` and `docs/tutorials/*` updated.

## Escalation
- Blocker → CEO
- Security / compliance → CFO
- Product risk → CPO
- Platform risk → CTO
