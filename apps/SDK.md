# ForgeOS App SDK

**Owner:** CPO (product) · **Engineering co-owner:** CTO
**Scope:** How to scaffold, wire, and ship an app under `/apps`.
**Reference implementation:** `apps/brain-console` (live on port 7777, no build step).

This document is the contract for building a ForgeOS app. It covers the four things every
app must get right: the **scaffold**, the **manifest**, **service consumption**, and the
**isolated brain**.

---

## 1. Scaffold pattern

Canonical layout (from `apps/README.md`, enforced for every app):

```
apps/<app-id>/
  README.md         # what it is, owner, status, how to run
  manifest.json     # capabilities, dependencies, version  (REQUIRED)
  package.json      # runtime + scripts (start/dev/test)
  <app-id>-brain.yml# gbrain config IF the app owns a brain (see §4)
  src/              # application source
  tests/            # unit + e2e
  scripts/          # smoke.sh / watchdog.sh style operational checks
  AGENTS.md         # optional: autonomous-management contract for agents/cron
  .forgeos-todo.md  # optional: durable task ledger (survives session close)
```

`app-id` is lowercase-kebab, stable forever, and must match `manifest.json.id` and the
directory name. It is the join key across manifest, brain config, and federation paths.

### Minimum viable app (three files)

```bash
mkdir -p apps/<app-id>/{src,tests}
cd apps/<app-id>
# 1. manifest.json  — see §2
# 2. package.json   — "type": "module", start = the single run command
# 3. README.md      — what/owner/status/run
```

### Runtime conventions

- **Bun is the default runtime.** `package.json` `start`/`dev` should be a *single*
  command (`bun run server.ts`). Apps that need a different stack must justify it in
  their README.
- **Single process where possible.** `brain-console` serves both its SPA and its REST API
  from one `server.ts`. Prefer that over a split frontend/backend for internal tools.
- **Ports are declared, not discovered.** Put the port in `manifest.json` (`runtime.port`)
  and the README. Currently allocated: **7777 = brain-console**. Pick an unused port and
  record it in your manifest before you bind it.
- **No build step unless you prove you need one.** `bun build` EPERMs on `C:\` in this
  environment. `brain-console` ships a plain ES-module SPA served as-is from `src/app.js`
  and it is the pattern to copy. If you introduce a bundler you own its breakage.
- **Persistent uptime** on Windows is a Task Scheduler task (ONLOGON, Highest), named
  after the app (e.g. `ForgeOSBrainConsole`). Restart with
  `schtasks /Run /TN <TaskName>`. Never `taskkill` a task-owned process — that races the
  scheduler and orphans state.

### Operational scripts (copy from `apps/brain-console/scripts/`)

| Script | Job |
|---|---|
| `smoke.sh` | curl every route + the SPA; exit non-zero on any failure |
| `watchdog.sh` | health check; silent when green, alerts on problem |
| `orchestrate.sh` | drive an autonomous agent cycle against the app's ledger |

An app is not "operable" until `bash scripts/smoke.sh` exists and exits 0.

---

## 2. `manifest.json`

Every app declares one. It is the public description of the app: what it can do, what it
depends on, and who owns it. Live example — `apps/lifeos/manifest.json`.

```json
{
  "id": "brain-console",
  "name": "ForgeOS Brain Console",
  "version": "1.0.0",
  "owner": "CPO",
  "engineering_owner": "CTO",
  "status": "live",
  "description": "Web console over the isolated ForgeOS gbrain.",
  "capabilities": ["governance-read", "semantic-search", "capture", "backup"],
  "dependencies": {
    "services": [],
    "marketplace": ["knowledge-universe-core"]
  },
  "runtime": {
    "engine": "bun",
    "entry": "server.ts",
    "port": 7777,
    "build": "none"
  },
  "brain": {
    "mode": "isolated",
    "home": "C:\\ForgeOS",
    "federation_parent": "forgeos"
  },
  "domains": { "product": "CPO", "engineering": "CTO", "ops": "COO" },
  "docs": "apps/brain-console/README.md"
}
```

### Field contract

| Field | Required | Notes |
|---|---|---|
| `id` | yes | == directory name. Immutable. |
| `name`, `version`, `description` | yes | `version` is semver; bump on any interface change. |
| `owner` / `engineering_owner` | yes | Roles from `ORG.md`. Product = CPO, engineering = CTO. |
| `status` | yes | `design` \| `alpha` \| `live` \| `deprecated`. |
| `capabilities` | yes | Kebab-case verbs the app *offers*. Publishable to `/marketplace`. |
| `dependencies.services` | yes | IDs from `/services`. Empty array if none. |
| `dependencies.marketplace` | yes | Consumed capability IDs. |
| `runtime` | recommended | `engine`, `entry`, `port`, `build` (`"none"` is a valid, preferred value). |
| `brain` | if app has one | `mode`: `none` \| `isolated` \| `federated-child`. See §4. |
| `domains` | yes | Which C-suite role owns product/engineering/ops. |
| `docs` | yes | Path to the app's primary doc. |

Rules: apps are **publishable units — design for composability**. Feature prioritization
is CPO's; engineering execution is CTO's. Breaking a declared capability is a version
major bump.

---

## 3. Consuming `/services`

Apps consume services from `/services` and capabilities from `/marketplace`. Apps do
**not** reach into another app's directory or database — ever. Cross-app data flows go
through a service or through brain federation (§4).

Service layout mirrors the app layout (`services/<service-id>/` with its own
`manifest.json` declaring endpoints, deps, SLA, version).

### Contract when you depend on a service

1. **Declare it** in `manifest.json` → `dependencies.services: ["<service-id>"]`.
2. **Bind to the versioned interface**, never to internals. Services expose stable,
   versioned interfaces; breaking changes require an ADR in `/docs/adr` plus COO sign-off
   on rollout.
3. **Degrade, don't crash.** If a service is down your app must still boot and report the
   dependency as unhealthy. `brain-console`'s `/api/status` models this: it returns 200
   with a health object (`gbrain_health.status`, `ollama: false`) rather than failing the
   whole process when a dependency is absent.
4. **Uptime/SLA is CTO-owned; release quality is COO-gated.** Your app inherits the
   service's SLA — do not promise more than your dependencies deliver.

### If your app exposes an HTTP API

Follow the `brain-console` shape — it is the house style. (Items marked ⚠ are the target
standard that the reference implementation does not yet fully meet; new apps should do
them from day one.)

- All JSON endpoints under `/api/*`.
- A cheap `/api/health` (no heavy dependencies) **and** a richer `/api/status`
  (dependency health rolled up).
- `/api/openapi` serving a machine-readable schema of your own surface.
- Optional bearer auth via an env token (`CONSOLE_TOKEN` pattern): off by default, on when
  the env var is set; report the state in `/api/status` (`auth: true|false`).
- Per-IP rate limiting with `X-RateLimit-Remaining`, `429` on exceed.
- ⚠ Security headers on **every** response, JSON included: `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`. Put them in your shared `json()` helper, not just in
  the static handler — `brain-console` currently sets them only on static assets.
- Static assets: `Cache-Control: no-cache` + a `?v=N` cache-buster on the script tag.
- Validate every path-ish input against traversal (`../`, `/`, `\`) before it touches
  storage.
- Long-lived push uses SSE (`/api/health/stream`), not polling.

---

## 4. Isolated brain

Every app that stores knowledge gets its **own gbrain instance**. This is the core
isolation invariant of ForgeOS: an app brain is separate from personal vaults, separate
from the ForgeOS root brain, and separate from sibling app brains.

Authoritative references: `knowledge-universe/BRAIN-FEDERATION.md` and
`knowledge-universe/GBRAIN-INTEGRATION.md`.

### Three brain modes

| `brain.mode` | Meaning |
|---|---|
| `none` | App holds no knowledge; pure UI or compute. |
| `isolated` | App owns a private gbrain at its own `GBRAIN_HOME`. No parent. |
| `federated-child` | App owns a gbrain that is **subordinate** to the ForgeOS root brain. |

### Wiring an isolated brain (the `brain-console` pattern)

The app process owns its PGLite database and is the only writer. Environment, exactly:

```bash
export GBRAIN_HOME="C:\ForgeOS"                     # this app's brain root — unique per app
export GBRAIN_CWD="C:\Users\pop\forge-gbrain"       # gbrain CLI working dir
export OLLAMA_BASE_URL="http://localhost:11434/v1"  # local embeddings
export GBRAIN_EMBEDDING_DIMENSIONS=1024             # mxbai-embed-large
unset DATABASE_URL                                  # CRITICAL: a host Postgres pool breaks PGLite
export PORT=7777
bun run server.ts
```

Hard-won rules:

- **`unset DATABASE_URL`.** If a host Postgres URL leaks into the env, PGLite breaks. The
  server strips it from the child env explicitly before spawning gbrain.
- **One owner per brain.** The app process owns its PGLite dir. Two writers corrupt it.
  Report ownership in status (`gbrain_health.owned_by`).
- **Switching brains is a restart, not a runtime toggle.** Change `GBRAIN_HOME` and
  restart the process to mount a different isolated brain.
- **Embeddings are local.** Ollama at `localhost:11434`, `mxbai-embed-large`, 1024 dims.
  Keep dimensions consistent for the life of a brain — changing them invalidates vectors.
- **Ship a backup route** (`POST /api/backup`, gzip) before you ship writes.

### Wiring a federated child (the `lifeos` pattern)

A federated child replicates the ForgeOS hierarchy internally but is subordinate to the
root. Declare it in `<app-id>-brain.yml` — see `apps/lifeos/lifeos-brain.yml`:

```yaml
storage:
  db_tracked: [board/, ceo/, cto/, cpo/, coo/, missions/, goals/, memories/, decisions/]
  db_only:    [agents/logs/]

schema:
  pack: forgeos          # same roles + verbs as the root

federation:
  parent: forgeos
  read_token_held_by: forgeos          # root holds READ on us (oversight)
  write_up_path: apps-feed/<app-id>    # we may write UP only to this path
  write_up_types: [decision, incident, kpi]   # allow-list, enforced server-side

scopes:                  # role-scoped slices WITHIN this brain
  <app-id>-board: { tier: admin, slices: [board] }
  <app-id>-cto:   { tier: write, slices: [cto, teams/*] }
```

Federation direction is **strictly one-way**: the root holds a read token on the child;
the child holds **no** token for the root or for siblings. The child may write *up* only
to `apps-feed/<app-id>`, only the allow-listed record types, and the allow-list is
enforced server-side — not by client good behaviour.

### Governance is sacred

`C:\Projects\ForgeOS\governance` is **immutable except by constitutional amendment**. Apps
**read** governance; apps never capture into it, never write to it, never mutate it as a
side effect. `brain-console` exposes it via a read-only `/api/governance` tree and that is
the only acceptable relationship an app has with governance.

---

## 5. Definition of done (per app)

An app change is shipped only when all hold:

- [ ] Syntax check passes on every touched source file (e.g. `node --check src/app.js`)
- [ ] The app boots with its documented run command
- [ ] Health endpoint returns 200 with dependencies reported
      (`curl -fsS http://127.0.0.1:<port>/api/status`)
- [ ] `bash scripts/smoke.sh` exits 0 — every route hit, not just the happy path
- [ ] `manifest.json` still accurate (version, capabilities, deps, port)
- [ ] No new build step introduced
- [ ] Change summarized in ≤3 lines quoting real command output

Verify with `curl` against `127.0.0.1`. A remote/sandboxed browser cannot reach a
localhost dev server — a green page in such a browser is not evidence.

## 6. Autonomous agents on an app

Apps managed by Hermes sessions/cron should carry two files:

- **`AGENTS.md`** — the management contract: product summary, non-negotiable invariants,
  run commands, definition-of-done, and the autonomous directive (default to action on
  safe reversible steps; verify before claiming; stop only on real blockers).
- **`.forgeos-todo.md`** — the durable ledger. `- [ ]` pending, `- [x]` done,
  `- [BLOCKER]` needs a human. Irreversible actions (delete, push, deploy) are never
  taken autonomously; they are written as blockers and wait for the user.

See `apps/brain-console/AGENTS.md` for the working example.
