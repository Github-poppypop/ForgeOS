# Incident response runbook

**Owner:** COO · **On-call:** CTO  
**Severity scale:** P1 service down / data risk, P2 degraded, P3 minor.

## Triage
1. Confirm impact: users affected, data exposure, duration.
2. Capture evidence: `GET /api/audit`, `GET /api/request-log`, server logs.
3. Open decision record: `npx tsx scripts/decision-cli.ts incident create --title "..." --severity high --owner cto/cto`.

## Contain
1. If auth bypass or secrets leak: rotate `CONSOLE_TOKEN` and redeploy.
2. If gbrain process runaway: `SIGTERM` via task manager; do not kill server.
3. If bundle/cache corruption: restart dev server and hard refresh.

## Resolve
1. Fix root cause in local repo; commit with `feat(forgeos):` / `fix(forgeos):`.
2. Update incident record: `npx tsx scripts/decision-cli.ts incident close <id> --resolution ...`.
3. Run `apps/brain-console` unit tests and VPS sync before marking closed.

## Postmortem
- Timeline
- Blast radius
- Root cause
- Remediation
- Follow-up tickets
