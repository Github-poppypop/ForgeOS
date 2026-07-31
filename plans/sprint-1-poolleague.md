# Sprint 1 — PoolLeague Governed-Project Sprint
**Product:** Pool League Manager (`apps/poolleague/`)
**Sprint Owner:** CPO (Product) · CTO (Eng) · COO (QA/Delivery)
**Target:** 2-week sprint anchored to ForgeOS M1–M5 acceptance gates.

---

## Pre-Flight Checklist (Session Start)

Run these in order. If any check fails, STOP and do not proceed to implementation.

- [ ] **Git state clean**
  ```
  cd C:\\Projects\\ForgeOS
  git status --porcelain
  git log --oneline -5
  ```
  - [ ] No dirty files outside `plans/` that aren't staged for this sprint.
  - [ ] Last message includes a ratified RFC or sprint plan reference.

- [ ] **Brain-console healthy**
  ```
  curl -s http://localhost:7777/api/missions/index
  curl -s http://localhost:7777/api/knowledge
  ```
  - [ ] Both return JSON (not HTML, not connection refused).
  - [ ] If `7777` not responding, run `cd apps/brain-console && ./run.sh start` and verify `curl -s http://localhost:7777/api/brain/status`.

- [ ] **Environment sanity (Windows/MSYS)**
  - [ ] `DATABASE_URL` is **unset** (PGLite breaks with host Postgres pool).
     ```
     if defined DATABASE_URL echo FAIL && exit /b 1
     ```
  - [ ] `C:\\Users\\pop\\forge-gbrain` exists and is writable.
  - [ ] `bun` available (`bun --version`).

- [ ] **Governance pre-reqs**
  - [ ] `governance/constitution/Constitution.md` exists.
  - [ ] `governance/standards/FES-001.md` through `FES-012.md` present.
  - [ ] `governance/rfcs/RFC-0000.md` ratified.
  - [ ] `agents/agents/cpo.agent.md` present (CPO is accountable for this sprint).

- [ ] **PoolLeague repo hygiene**
  ```
  cd apps/poolleague
  git status --porcelain
  git log --oneline -5
  ```
  - [ ] No uncommitted `node_modules`, `.env`, or `build/`.
  - [ ] Branch is `master` or a feature branch named `sprint-1-poolleague`.
  - [ ] `docker-compose.yml` or `start-all.bat` exists and documented in README.

---

## Mission Seeds for This Sprint

Every feature requires a mission. Create these **before** writing code.

### Mission 1: PoolLeague Governance Scaffold
```
POST /api/missions/index
{
  "slug": "p1-gov-scaffold",
  "title": "PoolLeague Governance Scaffold",
  "vision": "Make PoolLeague a governed ForgeOS governed-product",
  "requirements": "Add governance/ README, RFC, decision ledger use, test strategy.",
  "definitionOfDone": [
    "RFC written and linked",
    "governance README present",
    "tests require 80% coverage minimum per FES-006"
  ],
  "status": "Approved",
  "owner": "CPO"
}
```

### Mission 2: PoolLeague Backend Domain Contracts
```
POST /api/missions/index
{
  "slug": "p1-backend-contracts",
  "title": "PoolLeague Backend API Contracts",
  "vision": "Typed, documented, tested Express API with Prisma migrations.",
  "requirements": "Players, matches, tournaments, brackets. swagger or README.",
  "definitionOfDone": [
    "db/migrations applied",
    "API docs update",
    "integration tests pass",
    "security review per FES-010"
  ],
  "status": "Approved",
  "owner": "CTO"
}
```

### Mission 3: PoolLeague QA + Onboarding Gate
```
POST /api/missions/index
{
  "slug": "p1-qa-onboard",
  "title": "QA Suite + Onboarding Gate",
  "vision": "Fresh clone works in < 30 minutes with passing tests.",
  "requirements": "npm install → migrate → test → run.",
  "definitionOfDone": [
    "npm test succeeds",
    "docker-compose up healthy",
    "health-check.js green",
    "contributing.md updated"
  ],
  "status": "Approved",
  "owner": "COO"
}
```

Acceptance gate for each:
```
curl -s http://localhost:7777/api/missions/p1-<slug> | jq '.status'
# Must return "Approved" before coding begins.
```

---

## Session-Ready Implementation Checklist

Use this checklist during the sprint. Do not skip gates; Engineering Law #6 requires tests before feature is considered done.

### Day 1 — Governance & Contracts

- [ ] **Gate 1.1:** Mission 1–3 created and approved.
  ```
  curl -s http://localhost:7777/api/missions/p1-gov-scaffold | jq '.status'
  curl -s http://localhost:7777/api/missions/p1-backend-contracts | jq '.status'
  curl -s http://localhost:7777/api/missions/p1-qa-onboard | jq '.status'
  ```
  All three must return `"Approved"`.

- [ ] **Gate 1.2:** Subscribe poolleague to governance.
  ```
  cd C:\Projects\ForgeOS\apps\poolleague
  if (-not (Test-Path GOVERNANCE.md)) {
    @"
    # PoolLeague Governance
    This project is governed under ForgeOS.
    - Constitution: ../../governance/constitution/Constitution.md
    - Engineering Laws: ../../governance/laws/EngineeringLaws.md
    - Standards: FES-001..FES-012 mapped in RFC-0000.
    - Workflow: RFC → Mission → Implement → QA → Done.
    "@ | Out-File GOVERNANCE.md -Encoding utf8
    git add GOVERNANCE.md
    git commit -m "feat(poolleague): add governance stub"
    git push origin HEAD
  }
  ```

- [ ] **Gate 1.3:** Verify Prisma schema is under source control and migrations exist.
  ```
  cd apps/poolleague
  ls prisma/migrations | Measure-Object | Select-Object -ExpandProperty Count
  ```
  - [ ] At least one migration present.
  - [ ] `prisma/schema.prisma` committed.

- [ ] **Gate 1.4:** Backend starts with port check.
  ```
  cd apps/poolleague/backend
  $env:DATABASE_URL = ""
  npm run dev &
  curl -s http://localhost:3000/health || echo "FAIL"
  ```
  - [ ] `200 OK` from `/health` or documented equivalent.

### Day 2–3 — Backend Implementation (Mission 2)

- [ ] **Gate 2.1:** Implement Players + Matches endpoints.
  ```powershell
  # Unit test for players endpoint (example)
  curl -s -X POST http://localhost:3000/api/players `
    -H "Content-Type: application/json" `
    -d '{"name":"Test Player"}' | jq '.id'
  ```
  - [ ] Returns `id`.
  - [ ] Record persisted by querying `/api/players/{id}`.

- [ ] **Gate 2.2:** Implement Tournament + Bracket strands.
  ```
  curl -s -X POST http://localhost:3000/api/tournaments `
    -H "Content-Type: application/json" `
    -d '{"name":"Sprint Cup","format":"single-elimination"}' | jq '.id'
  ```
  - [ ] Returns `id`.
  - [ ] Bracket generation endpoint returns match objects.

- [ ] **Gate 2.3:** Update API docs.
  - [ ] `apps/poolleague/README.md` updated with endpoint table.
  - [ ] Every endpoint has request/response example.

- [ ] **Gate 2.4:** Security review quiz.
  - [ ] No secrets in `backend/.env.example`.
  - [ ] All `/api/*` endpoints validate input (no raw SQL).
  - [ ] No `eval()` or dynamic require.

### Day 4–5 — Tests + QA (Mission 3)

- [ ] **Gate 3.1:** Test suite green.
  ```
  cd apps/poolleague
  npm test
  ```
  - [ ] Exit code `0`.
  - [ ] `coverage_summary_v7.txt` updated (or equivalent report).

- [ ] **Gate 3.2:** docker-compose smoke test.
  ```
  cd apps/poolleague
  docker-compose up -d
  docker-compose ps
  curl -s http://localhost:<backend_port>/health
  curl -s http://localhost:<web_port>/ | Select-Object -First 1
  ```
  - [ ] All services `healthy` or matching documented state.
  - [ ] `health-check.js` returns all green.

- [ ] **Gate 3.3:** Fresh clone simulation.
  ```
  cd C:\Temp
  rm -rf PoolLeague-Staging
  git clone --depth 1 https://github.com/<org>/PoolLeague.git PoolLeague-Staging
  cd PoolLeague-Staging
  # Follow QUICK_START_GUIDE.md exactly.
  # Time: < 30 minutes per mission goal.
  ```
  - [ ] Fresh clone passes in under 30 minutes.
  - [ ] No manual secret wiring if not documented.

- [ ] **Gate 3.4:** Decision Ledger record.
  ```
  curl -s -X POST http://localhost:7777/api/knowledge -H "Content-Type: application/json" `
    -d '{
      "type":"decision",
      "slug":"p1-qa-pass",
      "title":"Sprint 1 QA Gate Passed",
      "status":"Approved",
      "owner":"COO",
      "authority":"COO",
      "date":"<iso-now>",
      "rationale":"All Day 1–5 gates green.",
      "alternatives":[],
      "confidence":1.0,
      "evidence":["npm_test_0","health_check_green"],
      "linkedArtifacts":["apps/poolleague"]
    }'
  ```
  - [ ] Returns `201`.

### Day 6–7 — Merge & Review

- [ ] **Gate 4.1:** Create PR per mission.
  ```powershell
  cd C:\Projects\ForgeOS\apps\poolleague
  git checkout -b sprint-1-poolleague
  # commit work on this branch (should already be.)
  git push -u origin sprint-1-poolleague
  gh pr create --title "feat(sprint-1): poolleague governed-project scaffold + backend + QA" `
    --body "Missions: p1-gov-scaffold, p1-backend-contracts, p1-qa-onboard. See plans/sprint-1-poolleague.md."
  ```
  - [ ] PR created and linked to all three mission slugs.
    ```
    gh pr view <number> | Select-String "p1-"
    ```
  - [ ] At least one approval from C-suite reviewer (`cto` or `cpo` agent).

- [ ] **Gate 4.2:** CI green.
  - [ ] GitHub Actions workflow runs and passes.
  - [ ] Branch protection: `no merge without review` enforced.

- [ ] **Gate 4.3:** Merge to master and tag.
  ```
  git checkout master
  git merge --no-ff sprint-1-poolleague
  git tag -a sprint-1-poolleague -m "Sprint 1 poolleague governed-project complete"
  git push origin master --tags
  ```
  - [ ] Tag present: `git tag -l sprint-1-poolleague`.
  - [ ] Master has `feat(poolleague)` commits.

### Day 8–10 — Retro + Report

- [ ] **Gate 5.1:** Sprint retrospective Decision Ledger entry.
  ```
  curl -s -X POST http://localhost:7777/api/knowledge -H "Content-Type: application/json" `
    -d '{
      "type":"lesson",
      "slug":"p1-retro",
      "title":"Sprint 1 PoolLeague Retro",
      "pattern":"best-practice",
      "owner":"COO",
      "date":"<iso-now>",
      "context":"First governed-product sprint under ForgeOS.",
      "recommendation":"Keep docker-compose defaults aligned with Windows MSYS paths."
    }'
  ```
  - [ ] Returns `201`.

- [ ] **Gate 5.2:** CEO digest compiled.
  ```
  curl -s http://localhost:7777/api/reporting/digest | jq '.missionsExecuting, .missionsBlocked'
  ```
  - [ ] Or manually:
  ```powershell
  cd apps/poolleague
  $digest = @{
    missionsExecuting = 0
    missionsBlocked  = 0
    decisions = @("p1-qa-pass")
    blockers = @()
  }
  $digest | ConvertTo-Json -Depth 3
  ```
  - [ ] Digest approved by CEO and surfaced in Command Center.

- [ ] **Gate 5.3:** Cleanup branches.
  ```powershell
  git branch -d sprint-1-poolleague
  git push origin --delete sprint-1-poolleague
  ```
  - [ ] Only `master` (or `main`) remains active for PoolLeague.

---

## Rollback Matrix

| Symptom | Rollback Command |
|---------|-----------------|
| Backend will not start (PGLite incompatible) | Unset `DATABASE_URL` and re-run. If still broken, `cd apps/brain-console && ./run.sh stop` then `git checkout master`. |
| Docker compose fails | `cd apps/poolleague && docker-compose down -v && docker-compose up -d` |
| Tests fail after merge | `git revert <sha>` and push; thread revert reason to Decision Ledger. |
| Console UI breaks | `cd apps/brain-console && git checkout master && npm run build` (fallback to last known good). |
| PoolLeague data pollution | `cd apps/poolleague && npx prisma migrate reset` **only if data is non-production. If production, backup first: `pg_dump > backup-$(Get-Date -Format o).sql`.** |
| Brain-corrupting seed | Stop gbrain (`./run.sh stop` in brain-console), move `C:\ForgeOS\pages` aside, re-seed from `infrastructure/gbrain/forgeos-schema-pack.yaml` and `knowledge-universe/`. |

---

## Success Criteria (binary pass/fail)

- [ ] **All 5 Gates** green (4.1–4.3, plus Day 1–3 gates).
- [ ] All three missions in `data/missions/` marked `Done`.
- [ ] PR merged, tag `sprint-1-poolleague` on master.
- [ ] PoolLeague fresh-clone smoke test passes in < 30 minutes without secrets in repo.
- [ ] `apps/poolleague/GOVERNANCE.md` references ForgeOS Constitution.
- [ ] Decision Ledger contains at least one entry with `type=decision` linked to PoolLeague missions.
- [ ] CEO digest compiled and approved.
- [ ] Zero fabrication: no placeholder metrics in reports; zero counts displayed as `0`.

---

