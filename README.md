# ForgeOS

Autonomous-organization operating system. Governance, C-suite agent
definitions, and a knowledge-universe brain (gbrain + gstack) fused into
an isolated, local-first runtime.

## Community Onboarding Funnel

New to ForgeOS? Follow the 4-stage funnel to go from zero to active contributor:

| Stage | Goal | Time |
|-------|------|------|
| **1. Install** | Clone, run, see the Brain Console | < 10 min |
| **2. First Brain** | Seed roles, capture a page, search, decide | < 15 min |
| **3. First App** | Run an app or publish a skill | < 20 min |
| **4. Community** | Join Discord, open an RFC, contribute | Ongoing |

Detailed guides:
- `docs/onboarding/funnel.md` — overview and metrics
- `docs/onboarding/stage-1-install.md` — clone, env, run
- `docs/onboarding/stage-2-first-brain.md` — seed, capture, search, decide
- `docs/onboarding/stage-3-first-app.md` — run an app or write a skill
- `docs/onboarding/stage-4-community.md` — contribute, publish, grow

External docs:
- `docs/developers/` — agent authoring, API gateway, marketplace, Docker
- `docs/tutorials/` — video scripts and step-by-step walkthroughs

---

## Layout
```
docs/                 governance docs (charter, ADRs)
apps/                 runnable apps (brain-console, future lifeos)
services/             shared services (api-gateway)
agents/               agent role definitions
profiles/             per-agent config profiles
marketplace/          capability/agent marketplace
knowledge-universe/   brain federation, schema packs
infrastructure/       deployment + ops
```

## The brain
- Isolated brain home: `C:\ForgeOS` (separate from personal vaults & app brains).
- Engine: gbrain (PGLite, single-writer). Console owns it exclusively.
- Embeddings: local Ollama `mxbai-embed-large` (1024d) — free, no API key.
- Web console: `apps/brain-console` on `http://localhost:7777`.

## Quick start (dev)
```bash
cd apps/brain-console
./run.sh start        # detached daemon on :7777 (survives shell close)
./run.sh status
./run.sh stop
# open http://localhost:7777
```
See `AGENTS.md` for the environment quirks (DATABASE_URL, MSYS paths, gbrain cwd).

## Env gotchas (critical)
1. `DATABASE_URL` (host Postgres pool) MUST be unset or gbrain's PGLite breaks.
2. gbrain is installed in `C:\Users\pop\forge-gbrain` — spawn with `cwd` there.
3. Use native `C:\...` paths for the brain, not `/c/...` (MSYS breaks PGLite).
4. `bun build` does NOT work on this MSYS host — the console is served as
   plain JS (no transpile step) and `bun run server.ts` runs the backend TS directly.
