# Developer Guide — Agents

**Owner:** CTO · **Status:** Draft  
**Purpose:** Author, govern, and dispatch agents inside ForgeOS.

---

## Agent architecture

ForgeOS agents are governed roles (CEO, CTO, CPO, COO, CMO, CFO, Board) plus
sub-agents that inherit their parent's mandate. Agents are defined in two
places:

1. **Governance source of truth** — `agents/<role>.agent.md` (human-readable,
   immutable once merged).
2. **Runtime skill spec** — `agents/skills/forgeos/<role>/SKILL.md` (machine-readable,
   used by the agent runner).

The console does **not** execute agents directly. It dispatches them into
`tmux` sessions (or any runner configured via `AGENT_CMD`) and tails their
logs into `/api/agent/{missionId}/log`.

---

## Authoring an agent

### Step 1 — Governance file

Copy `agents/templates/agent-template.md` (see Community Templates) and fill in:
- **Mission** — one sentence.
- **Responsibilities** — bullet list.
- **KPIs** — measurable outcomes.
- **Decision Rights** — ✅ / ⚠️ / ❌ per domain.
- **Delegation Rules** — what needs a request.
- **Escalation Rules** — exact path + triggers.

Commit the file to `agents/<slug>.agent.md` and open an RFC if the role is new.

### Step 2 — Runtime skill

Create `agents/skills/forgeos/<slug>/SKILL.md`:

```yaml
---
name: forgeos-<slug>
role: <Slug>
reports_to: <Parent>
authority_tier: write
domain: <Domain>
owner_agent: <slug>
version: 1.0.0
description: one-line summary
triggers:
  - "trigger phrase 1"
  - "trigger phrase 2"
gbrain:
  context_queries:
    - id: prior-decisions
      kind: list
      filter: { type: decision, tags_contains: "role:<slug>" }
      limit: 5
delegation:
  in_mandate: [capability, area]
  requires_request: [OtherRole]
  escalates_to: CEO
  irreversible_requires: [CEO, COO]
---
```

#### Body sections (required)

1. **When to invoke** — trigger semantics.
2. **Mandate** — bounded authority (mirrors the governance file).
3. **Operations** — concrete steps.
4. **Delegation Rules** — in-mandate vs request-based vs escalate.
5. **Escalation** — exact path + when.
6. **gbrain writeback** — what it writes (decision/incident/capability pages).

### Step 3 — Register

Add the role to `agents/README.md` and `server.ts` `ROLE_SLUGS` if it should
appear in `/api/roles`.

---

## Dispatch protocol

The console exposes three endpoints for agent execution:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/dispatch` | POST | Launch agent on a mission. |
| `/api/agent/{missionId}/status` | GET | Poll execution state. |
| `/api/agent/{missionId}/log` | GET | Stream last 50 log lines. |

### Dispatch flow

1. Client POSTs `{ missionId, agent }`.
2. Server creates an in-memory `AgentState` entry (`pending`).
3. Server spawns a detached `tmux` session running `AGENT_CMD`.
4. A `tail -f` reader streams the agent log into memory.
5. When the tmux session exits, state flips to `done` or `failed`.
6. A decision page is captured in the brain automatically.

---

## Safety & governance

- **Mutex** — All `gbrain` calls are serialized by a global async mutex. One
  writer at a time; the console owns PGLite exclusively.
- **Auth** — If `CONSOLE_TOKEN` is set, all `/api/agent/*` routes require
  `Authorization: Bearer <token>`.
- **Rate limits** — `/api/capture` (2/min) and `/api/embed` (1/min) are
  throttled per IP.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` kill active children and close
  SSE writers.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Agent stuck in `pending` | Check `AGENT_CMD` is valid and `tmux` is installed. |
| Log empty | Verify `logs/agent-<missionId>.log` is writable. |
| 429 rate limited | Reduce dispatch frequency; default is 5/min except `/api/capture`. |
| 401 unauthorized | Set `CONSOLE_TOKEN` or send `Authorization: Bearer`. |
| gbrain lockup | Another call is holding the mutex; wait for it to finish. |
