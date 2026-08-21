# /docs/onboarding — Community Funnel

**Owner:** CMO · **Ops support:** COO  
**Purpose:** A 4-stage funnel that takes a stranger from "heard of ForgeOS" to "active community contributor."

## Funnel Stages

| Stage | Name | Goal | Key Actions |
|-------|------|------|-------------|
| 1 | Install | Clone, run, see the console | `git clone`, env vars, `bun run server.ts` |
| 2 | First Brain | Seed roles, capture a page, search | Seed C-suite, create decision, run search |
| 3 | First App | Run an app or publish a skill | Start `lifeos` or `poolleague`, or write a skill |
| 4 | Community | Join Discord/GitHub, contribute, publish | Open RFC, PR, list capability on marketplace |

## Stage 1 — Install

See `docs/tutorials/setup.md` for the full video walkthrough.

```bash
git clone https://github.com/forgeos/forgeos.git && cd forgeos
cd apps/brain-console
export GBRAIN_HOME="C:\\ForgeOS"
export GBRAIN_CWD="C:\\Users\\pop\\forge-gbrain"
unset DATABASE_URL
bun run server.ts
# Open http://127.0.0.1:7777
```

Completion signal: the Brain Console SPA loads and status shows `brain ok`.

## Stage 2 — First Brain

1. Seed C-suite roles: `POST /api/seed-roles` (or run `e2e-governance.mjs`).
2. Capture a page: `POST /api/capture` with `{ slug, markdown }`.
3. Search it: `GET /api/search?q=<query>`.
4. Record a decision: `POST /api/decision` with `{ title, body }`.

Completion signal: at least 1 page, 1 role, and 1 decision exist in the vault.

## Stage 3 — First App

Pick one:

### A. Run LifeOS (calendar + routines)
```bash
cd apps/lifeos
npm install
npm start   # :3001
```

### B. Run Pool League (scoring)
```bash
cd apps/poolleague
npm install
npm run dev # :3000
```

### C. Write a Skill
1. Copy `agents/templates/agent-template.md` to `agents/<slug>.agent.md`.
2. Create `agents/skills/forgeos/<slug>/SKILL.md`.
3. Add to `agents/README.md`.

Completion signal: an app loads or a skill is registered in `server.ts` `ROLE_SLUGS`.

## Stage 4 — Community

1. Star the repo on GitHub.
2. Join Discord (link in repo README).
3. Open an RFC for a new capability: use `docs/developers/marketplace.md` schema.
4. Publish to marketplace: commit under `marketplace/listings/<id>/`.
5. Help others: answer issues, review PRs, share tutorials.

Completion signal: at least 1 PR merged or 1 marketplace listing published.

## Metrics (CMO-tracked)

| Metric | Target |
|--------|--------|
| Stage 1 → 2 conversion | > 60% |
| Stage 2 → 3 conversion | > 30% |
| Stage 3 → 4 conversion | > 10% |
| Time to first capture | < 10 min |
