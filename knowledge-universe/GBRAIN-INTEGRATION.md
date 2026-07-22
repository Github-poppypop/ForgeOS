# Knowledge Universe × GBrain — ForgeOS Integration

**Owner:** COO (curation) / CTO (runtime) · **Status:** Design v1.0
**Depends on:** [`garrytan/gbrain`](https://github.com/garrytan/gbrain) (verified architecture)

This document defines **gbrain as the storage and runtime substrate for the
ForgeOS Knowledge Universe** — at both the org level (ForgeOS itself) and the
app level (LifeOS). It maps the ForgeOS hierarchy and delegation protocol onto
gbrain's primitives.

---

## 1. Why gbrain

gbrain is a mature, production brain layer. It gives ForgeOS four things we
would otherwise have to build from scratch:

| Capability | gbrain primitive | ForgeOS use |
|------------|------------------|-------------|
| Structured memory | Markdown wiki + Postgres/PGLite DB | Knowledge Universe store |
| Identity resolution | Entity registry (canonical IDs + aliases) | One page per agent/team/org |
| Provenance & audit | Event ledger (append-only, sourced) | Decision/escalation records |
| Structured truth | Fact store (claims w/ confidence+source) | Org facts, KPI state |
| Graph queries | Relationship graph (typed edges) | Reporting lines, ownership |
| Synthesis | `gbrain think` (cited answer + gap analysis) | Exec/Board briefings |
| Raw retrieval | `gbrain search` (hybrid) | Agent context windows |
| Multi-tenant scoping | Company-brain (per-login slices) | C-suite / team isolation |
| Sub-agents | Minions queue (crash-safe 2-phase) | Agent Engine execution |
| Capability exchange | Skillpacks (43 bundled + registry) | Marketplace listings |
| Access control | OAuth scopes `read`/`write`/`admin` + rate limit | Delegation protocol enforcement |

**Decision:** ForgeOS does **not** build its own knowledge store. The Knowledge
Universe *is* a gbrain instance. We extend, not re-implement.

---

## 2. Topology

```bash
FORGEOS ROOT BRAIN  (single Postgres/PGLite instance — the federation root)
└── gbrain "org brain"
    ├── schema pack: forgeos  (defines org types + link verbs)
    ├── scoped slices (company-brain model, WITHIN the root brain):
    │    ├── /board       (Board agent scope — admin)
    │    ├── /exec        (CEO scope — admin over all)
    │    ├── /cto  /cpo  /coo  /cmo  /cfo   (C-suite scopes)
    │    └── /teams/*     (team scopes, owned by C-suite)
    ├── shared: /org /decisions /incidents /capabilities (cross-cutting)
    ├── /apps-feed       (WRITE-UP UPLINK: apps push governance records here)
    └── MCP server (stdio + HTTP) → agents call via tools
```

> **Note:** the root brain's slices above are the *ForgeOS org's own* hierarchy.
> Apps are **separate instances** (see `BRAIN-FEDERATION.md`), not slices of
> this brain. The slices here are internal to ForgeOS; the federation
> connectors give ForgeOS read-down into each app and receive app write-ups.

Each C-suite agent and team gets a **scoped slice** of the root brain,
exactly per gbrain's company-brain model (login-scoped visibility, fuzz-tested
for zero cross-slice leaks) — and apps get their own isolated instances with
the same model extended to instances.

---

## 3. Hierarchy → gbrain mapping

| ForgeOS concept | gbrain representation |
|-----------------|------------------------|
| Board | `board` entity page + `admin` scope on `/board` slice |
| CEO | `ceo` entity + `admin` scope over all slices |
| CTO/CPO/COO/CMO/CFO | `cto`…`cfo` entity + `write` scope on own slice |
| Team | `team` entity under owning C-suite slice |
| Reporting line | typed edge `reports_to` in relationship graph |
| ORG.md charter | `org` page (compiled truth above line, history below) |
| Decision (ORG §3.5) | `decision` page + event-ledger entry |
| Escalation | `incident` page + edge `escalated_to` |
| KPI state | facts in fact store (confidence=verified) |

**Single reporting line (ORG §3.1)** is enforced by gbrain's scope gating: an
agent can only `write` to its own slice + explicitly shared slices. A C-suite
agent cannot silently write to another's slice — that requires a delegated
`write` grant (the gbrain equivalent of a cross-domain delegation request).

---

## 4. Delegation protocol → gbrain access control

ORG.md §3 rules map onto gbrain's OAuth scope model:

| ORG §3 rule | gbrain enforcement |
|-------------|--------------------|
| §3.1 single reporting line | Per-slice `write` scope; no cross-slice write without grant |
| §3.2 mandate boundary | Scope = mandate; out-of-scope op returns 403 → agent escalates |
| §3.3 escalate, don't bypass | 403 → `incident` page + `escalated_to` edge → up the line |
| §3.4 delegate, don't abdicate | Minions queue: parent owns outcome; 2-phase persistence |
| §3.5 write it down | Every decision/escalation = page + event-ledger entry |
| §3.6 reversibility check | `admin`-scoped ops (deploys/deletes/spend) require admin grant |
| §3.7 autonomy ceiling | `read` < `write` < `admin`; agent authority = its scope tier |
| §3.8 no silent failure | Minions 2-phase persistence; task ends verified or blocked |

The **ForgeOS delegation protocol** (existing `agents/` definitions) becomes
the *policy layer*; gbrain's scope/rate-limit server is the *enforcement
layer*. Policy declares; gbrain denies.

---

## 5. Agent Engine → gbrain Minions

LifeOS/ForgeOS agents execute via gbrain's **Minions queue**:

- Each agent = a Minion with a scoped token (its C-suite slice + tier).
- Planning/execution bounded by the token's scope (mandate).
- Out-of-mandate steps return 403 → escalated as an `incident`, never run.
- Crash-safe two-phase persistence means a killed agent resumes, not duplicates.
- Agent outputs (`gbrain capture` / `gbrain think`) land in the Knowledge
  Universe → compounding loop preserved.

---

## 6. Marketplace → gbrain skillpacks

ForgeOS `/marketplace` listings are implemented as **gbrain skillpacks**:

- App/skill/knowledge listings → skillpacks in gbrain's registry.
- Publish = `gbrain skillpack harvest|endorse`; consume = install.
- CFO economics overlay the gbrain registry pricing model.
- LifeOS Brain Slices export as scoped skillpacks (revocable).

---

## 7. Configuration & schema

- Org brain config: `infrastructure/gbrain/forgeos-brain.yml`
- Org schema pack: `infrastructure/gbrain/forgeos-schema-pack.yaml`
- Activate: `gbrain schema use forgeos` (writes `~/.gbrain/config.json`).

---

## 8. Operational discipline (from gbrain)

Adopt gbrain's three founding principles org-wide:

1. **MECE directories** — every record has exactly one primary home (resolver).
2. **Compiled truth + timeline** — above the line = current state; below =
   append-only evidence. Pre-computed synthesis, not per-query RAG.
3. **Enrichment on every signal** — every agent action enriches the relevant
   entity page. The brain grows as a side effect of operations.

---

## 9. Fused model: gbrain + gstack + ForgeOS governance

This is the upgrade that makes the stack **better than either reference**:

| Reference | Role in ForgeOS |
|-----------|-----------------|
| **gbrain** | Memory substrate (entity registry, event ledger, fact store, graph) + Minions execution + synthesis. |
| **gstack** | Skill mechanics — `SKILL.md` frontmatter, `triggers`, `routing-eval.jsonl`, router pattern, role personas. **Adapted** into `agents/skills/forgeos/*`. |
| **ForgeOS ORG §3** | Governance layer neither has — `reports_to`, `authority_tier`, `escalates_to`, single reporting line, irreversible sign-off. |

**Two roles gstack lacks, ForgeOS adds:** **Board** (constitutional owner with
veto over charter/CEO) and **CFO** (finance/compliance gate). gstack's CEO is
unbounded; ours reports to a Board.

### First-class decision & incident records
`decision` and `incident` are not afterthoughts — every skill writes them:

- **decision** page = `gbrain capture` with `type: decision`, `owner`,
  `authority`, `rationale`, `outcome`. This satisfies ORG §3.5 ("write it down").
- **incident** page = opened on any 403 / escalation / safety breach, with
  `escalated_to` edge → up the reporting line. Satisfies ORG §3.3.

### Hierarchy graph (relationship edges)
The org chart is a **queryable graph**, not a diagram:

```
board ──appoints──▶ ceo
ceo ──reports_to──▶ board
cto/cpo/coo/cmo/cfo ──reports_to──▶ ceo
<team> ──reports_to──▶ <c-suite owner>
<incident> ──escalated_to──▶ <role>
<goal> ──parent_of──▶ <goal> ; ──derived_from──▶ <mission>
```

Ask `gbrain think "who reports to the CEO and what are their mandates?"` →
cited synthesis across role pages. This is gbrain's graph traversal gstack
cannot do and gbrain alone does not *model*.

See `agents/SKILL-SPEC.md` and `agents/skills/README.md`.

---

## 10. Open items

- [ ] Stand up org gbrain instance (PGLite for dev, Postgres for prod).
- [ ] Author `forgeos` schema pack (types + link verbs).
- [ ] Wire C-suite agent tokens to scoped slices.
- [ ] Map `ORG.md §3` to gbrain scope policy (enforcement layer).
- [ ] Bridge ForgeOS `/marketplace` ↔ gbrain skillpack registry.

---
*Owner: COO · Last updated: 2026-07-12*
