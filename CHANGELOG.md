# Changelog

All notable changes to ForgeOS are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
  - Brain Console "Whats New" panel (/feature/changelog) + /api/changelog endpoint parsing CHANGELOG.md into structured releases.
- Phase 10 — Documentation & community
  - Full OpenAPI 3.0 spec (`apps/brain-console/openapi.json`) with schemas,
    examples, and security definitions for all `/api/*` routes.
  - Developer docs: `docs/developers/plugins.md`, `agents.md`, `themes.md`.
  - Video tutorial scripts: `docs/tutorials/setup.md`, `agent-dispatch.md`,
    `governance-workflow.md`.
  - Community templates: `templates/agents/` and `templates/missions/` with
    example files.
  - `CHANGELOG.md` with semantic versioning.

### Changed
- STATUS-AND-ROADMAP.md updated with Phase 6–10 completion tracking.

---

## [0.3.0] — 2026-08-02

### Added
- Phase 9 — Agent runtime & tmux dispatch
  - `/api/agent/dispatch` launches agents in detached tmux sessions.
  - `/api/agent/{missionId}/status` and `/api/agent/{missionId}/log` for
    live monitoring.
  - In-memory `AgentState` tracker with automatic `tail -f` log streaming.
  - Decision capture on every dispatch for immutable governance traces.

### Added
- Phase 8 — Governance enforcement
  - `/api/governance` source-of-truth index (constitution, laws, standards,
    RFCs, roadmap).
  - Sacred path protection: capture rejects slugs that resolve into
    `governance/`.
  - Authority chain rendering in the Brain Console UI.

### Added
- Phase 7 — Observability & hardening
  - `/api/health/stream` SSE live heartbeat (5s interval).
  - Structured JSON logging with `x-request-id` correlation.
  - Rate limiting per route with `X-RateLimit-Remaining` headers.
  - `CONSOLE_TOKEN` auth gate for `/api/*` routes.
  - Graceful `SIGTERM`/`SIGINT` cleanup for PGLite and child processes.

### Added
- Phase 6 — Multi-brain & backup
  - `/api/brains` multi-brain metadata registry.
  - `/api/backup` POST endpoint returning a gzipped JSON bundle of the
    PGLite brain.
  - `GBRAIN_HOME` isolation guarantees (root `forgeos` + child `lifeos`).

### Changed
- `server.ts` refactored to use async mutex for serialized `gbrain` calls.
- Mission store expanded with sample data and agent state enrichment.

---

## [0.2.0] — 2026-07-31

### Added
- Phase 2 console — Timeline Engine, Decision Ledger, enhanced Org panel.
- PoolLeague submodule conversion (FES-001 compliance).
- `/api/timeline`, `/api/ledger`, `/api/org` endpoints.
- In-memory mission store with status advancement logic.

### Changed
- SPA cache headers fixed (`Cache-Control: no-cache`).
- Cache-busting query param added to `index.html` module loader.
- `app.ts` / `app.js` sync enforced (no more divergence).

---

## [0.1.0] — 2026-07-22

### Added
- Phase 1 foundation — RFC-0000 ratified, Constitution committed, FES-001..012
  defined.
- Initial Brain Console SPA on port 7777.
- Core `/api/*` routes: health, status, roles, search, page, capture, embed,
    vault, audit, schema, diff.
- C-suite agent registry (`agents/*.agent.md`).
- gbrain CLI wrapper with PGLite engine and Ollama embeddings.
- Task Scheduler auto-boot for persistent uptime on Windows.

---

## [0.0.1] — 2026-07-12

### Added
- Initial repo scaffold: governance, C-suite agents, brain-console skeleton.
- 50-enhancement roadmap (`STATUS-AND-ROADMAP.md`).
