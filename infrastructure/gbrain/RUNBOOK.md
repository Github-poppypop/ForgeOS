# ForgeOS Org Brain — Deployment Runbook

**Goal:** stand up the ForgeOS org brain on gbrain and wire the C-suite hierarchy
into it. Based on verified gbrain (`garrytan/gbrain`) install protocol.

## Prereqs
- `bun` (gbrain runtime) or Node 18+.
- A Postgres (prod) or nothing (dev — PGLite).
- `gbrain` CLI: `bun install -g github:garrytan/gbrain`.

## 1. Init the org brain (dev — zero server)
```bash
gbrain init --pglite                 # 2s local brain
gbrain doctor                        # verify health
```

## 2. Install the ForgeOS schema pack
```bash
# scaffold then drop in our pack definition
gbrain schema fork gbrain-base forgeos
# copy infrastructure/gbrain/forgeos-schema-pack.yaml ->
#   ~/.gbrain/schema-packs/forgeos/pack.yaml
gbrain schema use forgeos            # activate (writes config.json)
gbrain schema show                   # confirm resolved types + verbs
```

## 3. Apply org storage layout
```bash
# copy infrastructure/gbrain/forgeos-brain.yml -> repo root or ~/.gbrain/
gbrain sync                          # create db_tracked dirs + .gitignore
```

## 4. Seed the hierarchy
```bash
gbrain capture --file docs/ORG.md --type org
gbrain capture --file profiles/c-suite/board.md  --type role --slug board
gbrain capture --file profiles/c-suite/ceo.md    --type role --slug exec/ceo
# ... one role page per C-suite agent, each with reports_to + tier frontmatter
```

## 5. Wire agent scopes (enforcement layer for ORG §3)
- Issue per-agent scoped tokens: `gbrain serve --http` + OAuth client per role.
- `board`/`ceo` → `admin` tier; C-suite → `write` on own slice; teams → `write`
  on team slice under owning C-suite.
- Verify isolation: fuzz-read across slices → expect zero cross-slice leaks
  (gbrain's company-brain guarantee).

## 6. Connect agents (MCP)
```bash
gbrain connect https://your-host/mcp --token gbrain_xxx --install
```
Each ForgeOS agent calls the brain via MCP tools (`search`, `think`, `capture`,
`agent run`).

## 7. Verify
```bash
gbrain doctor
gbrain think "who reports to the CEO and what are their mandates?"
# expect a cited synthesis across cto/cpo/coo/cmo/cfo role pages.
```

## Prod notes
- Swap `--pglite` for Postgres/Supabase (`DATABASE_URL`).
- Enable `--http` + OAuth 2.1 + rate limiting for multi-agent access.
- Snapshot/restore via `gbrain export --restore-only` (COO incident response).

---
*Owner: CTO/COO · Last updated: 2026-07-12*
