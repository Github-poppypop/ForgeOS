# Next-50 Enhancements — ForgeOS Platform

**Status:** In Progress
**Target:** End-to-end mock-first implementation; real backends can be wired later.
**Batch strategy:** 10 enhancements per logical batch; each batch is a single commit.
**Source-of-truth rule:** items below are verified against `apps/brain-console/src/**`
(feature-glob `feat-*.tsx`, `App.tsx`, `panelkit.tsx`, `offline.tsx`) on 2026-08-20.
Ledgers drift — confirm in source before implementing.

---

## Batch A — Mock Service Foundation (1–10) ✅
- Added `services/mock-service-registry.ts`
- Added mock services: auth, billing, notifications, search, AI, storage, webhooks, telemetry, integrations
- Added `services/__tests__/` coverage for mock services

## Batch B — Brain Console UX + Data Panels (11–20)
- 11. ✅ Saved views/filters for missions/vault/audit tables → `features/feat-savedviews.tsx`
- 12. ✅ Command-palette fuzzy search across all panels → `App.tsx` Cmd/Ctrl+K (`useCommandPalette`)
- 13. ✅ Batch actions for missions/decisions/incidents → `features/feat-bulkvault.tsx` + `panelkit.tsx` selection
- 14. ✅ Export-to-CSV for vault/audit/missions/ledger → `features/feat-exportcsv.tsx` + `panelkit.exportCsv`
- 15. ⬜ Inline edit for decisions with optimistic rollback — NO source evidence (no `contenteditable`/`inlineEdit`)
- 16. ✅ Time-travel diff viewer for decision history → `features/feat-diffviewer.tsx` (needed Express 5 `/api/page/:slug` wildcard fix in `runtime.ts`)
- 17. ✅ Keyboard shortcuts cheatsheet panel → `App.tsx` `ShortcutsOverlay` + `features/feat-keyboard-shortcuts.tsx`
- 18. ✅ Offline mode queue with sync indicator → `features/offline.tsx` (`flushOfflineQueue`, `navigator.onLine`)
- 19. ⬜ Panel resize + column reorder persistence — column *visibility* exists (`toggleCol`/`hiddenCols`) but no *reorder*/drag-handle
- 20. 🟡 Right-click context menus — `ContextMenu` component exists in `panelkit.tsx` but is NOT wired to table rows (`onContextMenu` absent)

## Batch C — Agent Runtime Hardening (21–30)
- 21. ⬜ Retry/backoff wrapper for gbrain CLI spawns
- 22. ⬜ Circuit breaker for repeated gbrain failures
- 23. ⬜ Agent sandbox policy enforcement in `agents/guardrails.ts`
- 24. ⬜ Structured agent output schema validation
- 25. ✅ Agent memory cache with TTL eviction → `features/feat-agentcache.tsx`
- 26. ✅ Dead-letter queue for failed agent tasks → `features/feat-deadletter.tsx`
- 27. ⬜ Agent cost/token accounting per role
- 28. ⬜ Agent A/B routing for canary prompts
- 29. ⬜ Graceful degradation when Ollama is offline
- 30. ⬜ Agent runbook auto-selection by mission type
- (also shipped: `feat-ratelimit.tsx`, `feat-ratelimit-telemetry.tsx`, `feat-alert-status.tsx`)

## Batch D — Knowledge Universe + Federation (31–40)
- 31. ⬜ Incremental sync from markdown files to knowledge universe
- 32. ✅ (partial) GraphQL endpoint guard → `features/feat-graphql-guard.tsx`
- 33. ⬜ Duplicate-page detection + merge tooling
- 34. ✅ Semantic bookmarking and reading-list capture → `features/feat-readinglist.tsx` (localStorage; CSV export + JSON import; Batch D #34, shipped Wave 5)
- 35. ⬜ Page-level analytics (views, edits, last accessed)
- 36. ✅ Mission scheduling executor → `features/feat-missionsched-exec.tsx`
- 37. ⬜ Access-control lists per role on sensitive pages
- 38. ⬜ Audit trail viewer for page mutations
- 39. ⬜ Bulk page mover with link rewrite
- 40. ⬜ Knowledge graph visualization data endpoint

## Batch E — Marketplace + SDK + Onboarding (41–50)
- 41. ⬜ Listing review/approval workflow in marketplace
- 42. ⬜ Capability compatibility checks before install
- 43. ⬜ Marketplace analytics for publishers
- 44. ⬜ SDK publish helper in `apps/sdk`
- 45. ⬜ First-app template selector in `apps/first-app`
- 46. ✅ Guided onboarding checklist tied to ROADMAP phases → `features/feat-onboarding-checklist.tsx` (localStorage-persisted progress; mirrors ROADMAP Phase 0–5 tasks; Batch E #46, shipped 2026-08-20)
- 47. ⬜ Role-based quickstart wizards for C-suite
- 48. ⬜ Local demo data seeder for offline tours
- 49. ⬜ Feature flags for staged rollout
- 50. ✅ Release notes generator — `features/feat-releasenotes.tsx` (curated milestone timeline + live feature-registry count via `registry.ts`; `/feature/release-notes`; Batch #50, shipped 2026-08-20)
- (also shipped: `feat-webhooks.tsx`, `feat-workspaces.tsx`, `feat-sse.tsx`,
  `feat-auditstore.tsx`, `feat-apidocs.tsx`, `feat-changelog.tsx`, `feat-csp-enforce.tsx`)

---

## Cross-cutting shipped (outside the 50 numbering)
- Security headers (CSP/HSTS/X-Frame/Referrer/Permissions) in `server.ts`
- Structured JSON request logging to `logs/` (gitignored)
- Env-gated Sentry/alert webhook (`alertError`, no-op without `SENTRY_DSN`/`ALERT_WEBHOOK_URL`)
- In-memory rate limiting (`/api/rate-limit/status`)
- OpenAPI spec (`openapi.json`, 70+ paths; `/api/openapi` live)
- Playwright E2E scaffold + performance budgets
- Error boundary (`DebugErrorBoundary`), loading `Skeleton`, `OnboardingTour`, a11y (skip-link/aria-live/chart roles)
- SSE live channel scaffold (`feat-sse.tsx`)

## Implementation Rules
- Prefer mock services over external dependencies.
- Keep UI changes additive and panel-scoped (use `features/feat-*.tsx`; auto-registers).
- Every batch must have: one commit, one targeted verification, one curl/browser check.
- **Verify gaps in source before implementing** — ledgers lag reality.
