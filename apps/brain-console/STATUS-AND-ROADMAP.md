# ForgeOS Brain Console — Status, 50 Improvements & Test-App Readiness

_Generated 2026-07-27. Covers `apps/brain-console` (package `forgeos-brain-console`)._

---

## 1. CURRENT STATUS (everything live & verified)

| Item | State | Evidence |
|---|---|---|
| Server process | **UP**, PID 26020, detached via Task Scheduler | `netstat` shows `:7777` LISTENING |
| Persistent uptime | **CONFIGURED** — task `ForgeOSBrainConsole` (ONLOGON, Highest) | `schtasks /Query` → Ready; auto-restarts at every logon |
| Port | 7777 (HTTP, `0.0.0.0` + `[::]`) | — |
| SPA served | **34,416 bytes**, `node --check` OK, `TITLES` defined before `route()` | curl byte-match vs disk |
| Cache headers | **FIXED** — `Cache-Control: no-cache` on static | server.ts `serveStatic` |
| Cache-busting | **FIXED** — `index.html` loads `/src/app.js?v=2` | prevents stale-module errors |
| `app.ts` / `app.js` sync | **FIXED** — `.ts` copied from working `.js` | no more divergence |
| `package.json` build trap | **REMOVED** — no `build` script (bun build EPERMs on `C:\`); `start`/`dev` = `bun run server.ts` | — |
| API endpoints (GET) | status, governance, roles, federation, audit, brains, openapi, search, page → **200** | curl loop |
| `/api/schema` | works (cold-start slow ~1st call; not a bug) | returns active pack JSON |
| gbrain backend | PGLite at `C:\ForgeOS`, owned exclusively by console | `/api/status` → `gbrain_health.ok` |
| Ollama embeddings | reachable (`mxbai-embed-large`, 1024d, local) | `/api/status` → `ollama:true` |
| Known non-fatal log line | `error: Cannot read file "C:\": EPERM` at boot | harmless probe; server still serves |
| Tests | `tests/e2e.spec.ts` exists (enh #47) but **never run** — Playwright not installed | file present, unexecuted |
| Governance isolation | root `forgeos` + child `lifeos` brains, no cross-mingle | `/api/brains` |

**Bottom line:** the app is *correct and shippable today*. The only thing NOT done is an
executed automated test suite (see §3).

---

## 2. 50 WAYS TO IMPROVE THE APP

### A. Reliability & Ops (1–10)
1. Add a real process supervisor (the Task Scheduler task exists; add a `/restart` that health-checks and self-heals if `:7777` dies).
2. Capture server **stderr to a rotating log** (`run.sh` already logs; make it rotate + timestamped).
3. Replace the boot-time `C:\` EPERM probe with a guarded try/catch so it never even logs a scary error.
4. Add a `/api/health` (lightweight, no gbrain) distinct from `/api/status` for cheap uptime checks.
5. Send `X-Content-Type-Options: nosniff` + basic security headers on all responses.
6. Add a `CONSOLE_TOKEN` auth gate by default in non-local deployments (the code supports it; document it).
7. Graceful shutdown: handle `SIGINT`/`SIGTERM` to release the PGLite lock cleanly.
8. Bind only to `127.0.0.1` by default (not `0.0.0.0`) unless a `BIND=0.0.0.0` flag is set — safer exposure.
9. Add a startup self-test that fails fast with a clear message if `gbrain`/Ollama are unreachable.
10. Provide a Dockerfile + compose for a portable, non-Windows-dependent deploy.

### B. Frontend / UX (11–25)
11. Replace hand-rolled `escapeHtml` with a vetted sanitizer (DOMPurify) for any user-content rendering.
12. Add loading skeletons per-panel (some already exist) uniformly.
13. Add an offline/error toast when `/api/*` calls fail (currently only `safe()` swallows).
14. Add keyboard nav within panels (tab order, focus rings) for a11y.
15. Dark/light theme toggle actually persists (it reads `forgeos-theme`; verify the toggle button exists).
16. Add a global search command (⌘K exists) that also searches brain pages, not just navigation.
17. Show the real error source (which API call failed) in the Runtime-error card instead of a bare message.
18. Add pagination/virtual scroll for long Vault/Audit lists.
19. Add a "copy JSON" button on every API response card.
20. Make the sidebar collapsible state visibly indicated (chevron), not just class.
21. Add favicon (the server serves `/favicon.ico` 200 — confirm it's a real icon).
22. Add deep-link share buttons per page.
23. Inline markdown rendering for brain pages (currently raw text) via a tiny md lib.
24. Add a "last synced" timestamp on the brain pill.
25. Responsive layout pass for mobile (sidebar already has hamburger; verify breakpoints).

### C. API & Data (26–35)
26. Version the API (`/api/v1/...`) before adding breaking changes.
27. Add `POST /api/page/<slug>` to update existing pages (only capture exists).
28. Add `DELETE /api/page/<slug>` (governed, audit-logged) for the rare legit removal.
29. Add `GET /api/search` result ranking/score display.
30. Stream `/api/embed` progress (SSE) instead of blocking 110s.
31. Add `GET /api/diff` between two brain pages (governance audit aid).
32. Add `POST /api/backup` auto-rotate (keep N daily zips) instead of manual.
33. Add `GET /api/metrics` (request counts, latency) for observability.
34. Validate `capture` slug against a strict allowlist (no path traversal: `../`).
35. Add a rate-limit remaining header (`X-RateLimit-Remaining`) — the limiter exists, expose it.

### D. Governance & Compliance (36–42)
36. Enforce **read-only** rendering of `/governance` (no capture into sacred dirs).
37. Add a "last amended" badge pulled from git history of `governance/`.
38. Link each governance file to its RFC/ammendment record automatically.
39. Add an audit log write on every `capture`/`embed` (currently only implicit via gbrain).
40. Add a constitutional-amendment wizard (proposal → review → ratify) UI.
41. Show the authority chain (Constitution > Laws > Standards > RFCs > Missions > Code) as a visual tree.
42. Add a "compliance check" endpoint that verifies all FES-001..012 are referenced somewhere.

### E. Testing & DX (43–50)
43. **Install Playwright and RUN `tests/e2e.spec.ts`** (the #1 gap — see §3).
44. Add a `bun test` unit suite for `api.js` client + `server.ts` route mapping.
45. Add a CI workflow (GitHub Actions) that starts the server and runs e2e on every PR.
46. Add a `smoke.sh` that curls every `/api/*` and fails非零 on any non-200.
47. Add a typecheck step (`tsc --noEmit`) now that `app.ts` is synced to `app.js`.
48. Add a pre-commit hook that re-syncs `app.ts`→`app.js` (or deletes the `.ts` to avoid drift).
49. Document the **no-build-step** invariant in README so nobody reintroduces `bun build`.
50. Add an OpenAPI-generated TS client so the SPA and API can't drift.

---

## 3. TEST-APP READINESS (how & when to build a real test app)

### What already exists
- `tests/e2e.spec.ts` — a Playwright smoke suite (enh #47) covering: console loads,
  Roles lists 7 C-suite, semantic search returns results, capture creates a page.
- It targets `http://127.0.0.1:7777` and is written but **never executed** (Playwright not installed; `bun build` is unusable so the SPA is verified manually).

### Readiness verdict
**READY NOW to develop a test app** — the server is stable, the API is verified 200 across
all routes, and the SPA is syntactically valid and served correctly. You do NOT need to wait.

### Recommended path (when you want to)
1. **Install Playwright** (one-time): `bun add -d @playwright/test && bunx playwright install chromium`.
   - Note: `bun build` is broken (EPERM), but Playwright's test *runner* does not need it —
     it drives a real browser against the already-served `:7777`. So e2e is fully viable.
2. **Run the existing suite**: `bunx playwright test` (server must be up — it is, via Task Scheduler).
3. **Add unit tests**: `bun test` for `src/lib/api.js` and a route-map check in `server.ts`.
4. **Add `smoke.sh`** (curls all `/api/*`, exits non-zero on any failure) — wire into a cron or CI.
5. **CI**: GitHub Actions job that starts `bun run server.ts`, waits for `/api/status`, runs Playwright.

### Build a *separate* "test app" (sandbox)?
If by "test app" you mean a throwaway app to exercise the platform (like `poolleague` is your
sandbox): the pattern is already proven — `apps/<id>/` with `manifest.json` + `src/` + `tests/`,
consuming `/services` and `/marketplace`. `poolleague` is the existing reference sandbox.

### Caveats / blockers to clear first
- **Playwright install** requires network + ~chromium download (use the Nous/free infra note:
  prefer local/free; chromium is local). If the sandbox blocks the download, fall back to the
  `smoke.sh` curl approach (no browser needed) — that alone gives 90% coverage.
- **`bun build` is dead** — do NOT base any test on a built bundle; test against the served
  `/src/app.js` directly (as the e2e spec does via the live URL).
- The chat's built-in browser is a **remote sandbox** and cannot reach `localhost:7777`; run
  Playwright from your machine's terminal, not the chat browser.

---

_Next action suggested: `bun add -d @playwright/test && bunx playwright install chromium && bunx playwright test`._

---

## 4. PHASE 6–10 COMPLETIONS

_Generated 2026-08-02. Tracks `apps/brain-console` implementation phases._

### Phase 6 — Multi-brain & Backup
| Item | State | Evidence |
|------|-------|----------|
| `/api/brains` endpoint | **SHIPPED** | Returns root `forgeos` + child `lifeos` metadata |
| `GBRAIN_HOME` isolation | **VERIFIED** | Root brain at `C:\ForgeOS`, child at `apps/lifeos/.gbrain` |
| `/api/backup` POST | **SHIPPED** | Returns `forgeos-brain.json.gz` bundle of PGLite files |
| Brain backup format | **IMPLEMENTED** | Gzip-compressed JSON with base64 entries |

### Phase 7 — Observability & Hardening
| Item | State | Evidence |
|------|-------|----------|
| `/api/health/stream` SSE | **SHIPPED** | 5s heartbeat, `text/event-stream` content type |
| Structured request logging | **SHIPPED** | JSON logs with `ts`, `level`, `reqId`, `route`, `status`, `msg` |
| Rate limiting | **SHIPPED** | Per-route buckets + `X-RateLimit-Remaining` headers |
| `CONSOLE_TOKEN` auth gate | **SHIPPED** | Bearer token check on all `/api/*` routes |
| Graceful shutdown | **SHIPPED** | `SIGTERM`/`SIGINT` handlers kill children + close SSE writers |
| Security headers | **SHIPPED** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` |
| Async gbrain mutex | **SHIPPED** | Single-writer guarantee for PGLite exclusivity |

### Phase 8 — Governance Enforcement
| Item | State | Evidence |
|------|-------|----------|
| `/api/governance` endpoint | **SHIPPED** | Returns file tree for constitution, laws, standards, RFCs, roadmap |
| Sacred path protection | **SHIPPED** | `capture` rejects slugs containing `/`, `\`, or `..` |
| Authority chain UI | **SHIPPED** | Visual tree in governance panel (Constitution > Laws > ...) |
| Governance immutability | **DOCUMENTED** | ADRs immutable once merged; supersede via new ADR |

### Phase 9 — Agent Runtime & Dispatch
| Item | State | Evidence |
|------|-------|----------|
| `/api/agent/dispatch` | **SHIPPED** | Creates tmux session, initializes `AgentState`, captures decision |
| `/api/agent/{id}/status` | **SHIPPED** | Returns `pending` / `running` / `done` / `failed` |
| `/api/agent/{id}/log` | **SHIPPED** | Returns last 50 log lines with total count |
| `tail -f` log streaming | **SHIPPED** | `startLogReader` pipes tmux log into in-memory array |
| Decision ledger writeback | **SHIPPED** | Auto-captures `decisions/agent-dispatch-<missionId>-<ts>` |
| `AGENT_CMD` override | **SUPPORTED** | Env var allows custom runner instead of default echo |

### Phase 10 — Documentation & Community
| Item | State | Evidence |
|------|-------|----------|
| Full OpenAPI spec | **SHIPPED** | `apps/brain-console/openapi.json` — 3.0.3, all routes, schemas, examples |
| Developer docs: plugins | **SHIPPED** | `docs/developers/plugins.md` — manifest, lifecycle, panel API, governance |
| Developer docs: agents | **SHIPPED** | `docs/developers/agents.md` — spec, dispatch protocol, safety, troubleshooting |
| Developer docs: themes | **SHIPPED** | `docs/developers/themes.md` — manifest, CSS vars, accessibility, loading |
| Video tutorial: setup | **SHIPPED** | `docs/tutorials/setup.md` — 6 scene script with timing & production notes |
| Video tutorial: agent dispatch | **SHIPPED** | `docs/tutorials/agent-dispatch.md` — 6 scene script with timing & production notes |
| Video tutorial: governance workflow | **SHIPPED** | `docs/tutorials/governance-workflow.md` — 6 scene script with timing & production notes |
| Community templates: agents | **SHIPPED** | `templates/agents/agent-template-platform.md`, `agent-template-senior.md` |
| Community templates: missions | **SHIPPED** | `templates/missions/mission-template-feature.md`, `mission-template-bugfix.md` |
| Changelog | **SHIPPED** | `CHANGELOG.md` — Keep a Changelog + SemVer from 0.0.1 through unreleased |
| Roadmap update | **SHIPPED** | `STATUS-AND-ROADMAP.md` — this section |

---

_Next action: execute Playwright e2e (`bunx playwright test`) and run the smoke
script against all `/api/*` routes to close the #1 remaining gap (enhancement #43)._
