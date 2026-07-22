# LifeOS — Architecture

**Version:** 1.0 · **Owner:** CPO · **Engineering:** CTO · **Status:** Design

This document is the canonical architecture for LifeOS. It defines the system
topology, the eight core components, their data contracts, and how they map to
ForgeOS platform services (`/services`, `/marketplace`, `/agents`,
`/knowledge-universe`).

---

## 1. Design Principles

1. **Mind as data.** A human mind is modeled as versioned, queryable data —
   not prose. Every component reads/writes against a typed schema.
2. **Single source of self.** Brain DNA is the root; everything else derives
   from or references it.
3. **Composable slices.** Topics are isolated into Brain Slices so context can
   be loaded, shared, or exported without leaking the whole self.
4. **Engines are pure functions over state.** Memory, Mission, Goal, Agent
   engines are deterministic transforms on the Knowledge Universe + Brain state.
5. **Grounded autonomy.** Agents act only within the mandate encoded in Brain
   DNA + active Goals; out-of-mandate actions are delegated or blocked.
6. **Private by default, portable by choice.** The Knowledge Universe is private;
   the Marketplace enables explicit, revocable sharing.

---

## 2. Topology

```
FORGEOS ROOT BRAIN  (admin over federation; hierarchy supercedes all apps)
├── /forgeos                # ForgeOS's own hierarchy slice
│    ├── board  ceo  cto  cpo  coo  cmo  cfo
│    └── decisions/ incidents/   (org-governance records)
├── /apps-feed              # WRITE-UP UPLINK (app → ForgeOS, governance only)
│    └── lifeos/{decisions,incidents,kpi}/
└── federation connectors → READ-DOWN into each isolated app brain
     ├── lifeos-brain          (separate instance — isolated)
     └── <future-app>-brain    (separate instance — isolated; no sibling visibility)

Each app brain = a separate gbrain instance running the `forgeos` schema pack,
so it REPLICATES the ForgeOS hierarchy internally but is SUBORDINATE to the
root. Full rules: knowledge-universe/BRAIN-FEDERATION.md.
```

**Data flow:** Brain DNA seeds Brain Slices → Slices + Mission + Goals form the
agent context → Memory Engine records activity → everything persists to the
app's *own* Knowledge Universe → selected governance records flow **up** to
`/apps-feed/<app>/` → ForgeOS reads **down** for oversight.

---

## 3. Component Responsibilities

| Component | Responsibility | Reads | Writes |
|-----------|----------------|--------|--------|
| Brain DNA | Schema of identity (traits, values, preferences, constraints) | — | Brain DNA store |
| Brain Slices | Topic-scoped context views derived from DNA + memories | DNA, Memories | Slice index |
| Memory Engine | Episodic / semantic / procedural memory capture & retrieval | KU, Slices | KU |
| Mission Engine | Purpose, principles, long-range intent | DNA, KU | Mission store |
| Goal Engine | Objective decomposition, tracking, execution | Mission, KU | Goal graph |
| Agent Engine | Spawns/bonds agents to DNA+Goals; executes per protocol | All above | KU, actions |
| Knowledge Universe | Private compounding memory store (per-user) | All | All |
| Marketplace | Import/export slices, skills, agents, capabilities | External | Listings |

---

## 4. Data Contracts (high level)

```ts
BrainDNA = {
  id: string
  version: number
  traits: Trait[]            // big-five style dimensions
  values: Value[]
  preferences: Preference[]
  constraints: Constraint[]   // hard limits on agent behavior
  updatedAt: ISODate
}

BrainSlice = {
  id: string
  topic: string
  dnaRef: BrainDNA.id
  memoryRefs: Memory.id[]
  summary: string
  visibility: "private" | "shared" | "public"
}

Memory = {
  id: string
  kind: "episodic" | "semantic" | "procedural"
  content: string
  embeddings?: vector
  source: string
  timestamp: ISODate
}

Mission = {
  id: string
  statement: string
  principles: string[]
  horizon: "life" | "year" | "quarter"
}

Goal = {
  id: string
  missionRef?: Mission.id
  parentGoalId?: Goal.id
  title: string
  status: "active" | "blocked" | "done" | "abandoned"
  subGoals: Goal.id[]
  agentRefs: Agent.id[]
}

Agent = {
  id: string
  dnaRef: BrainDNA.id
  goalRefs: Goal.id[]
  mandate: Mandate
  status: "idle" | "running" | "escalated"
}
```

> Full schema lives in `docs/DATA-MODEL.md`. Engine specs in component docs.

---

## 5. Engine Execution Model

Each engine is a pure transform:

```
state' = Engine(state, input)
```

- **Memory Engine:** `KU' = ingest(KU, event)`
- **Mission Engine:** `Mission' = reconcile(Mission, DNA, input)`
- **Goal Engine:** `GoalGraph' = decompose(Goal, Mission, DNA)`
- **Agent Engine:** `actions = plan(Agent, Goal, KU); result = execute(actions)`

All engine outputs are written to the Knowledge Universe and thus become
retrievable memory for future cycles — the compounding loop.

---

## 6. ForgeOS Platform Mapping

| LifeOS need | ForgeOS asset |
|-------------|---------------|
| Agent execution | `/agents` runtime (CTO) + delegation protocol (`ORG.md §3`) |
| Persistent memory | `/knowledge-universe` core (federated brain — per `BRAIN-FEDERATION.md`) |
| Capability exchange | `/marketplace` |
| Governance | C-suite agents (`/agents/*.agent.md`) |
| Docs & ADRs | `/docs` (CMO) |

LifeOS Agents are **sub-agents** of the CPO-owned product surface; they inherit
the ForgeOS delegation rules (single reporting line, mandate boundary, no silent
failure, irreversible-action sign-off).

**Federation:** LifeOS is a *separate, isolated child brain* under the ForgeOS
root. The ForgeOS hierarchy **supercedes** LifeOS's replicated hierarchy.
ForgeOS reads down (oversight); LifeOS writes governance records up only
(`decision`/`incident`/`kpi` → `/apps-feed/lifeos/`). No app↔app mingle. See
`/knowledge-universe/BRAIN-FEDERATION.md`.

---

## 7. Security & Privacy

- Brain DNA is the highest-sensitivity store; encrypted at rest, access-gated.
- Agents cannot modify DNA constraints without explicit user (owner) sign-off.
- Marketplace exports are slice-scoped and revocable.
- All agent actions are logged to the Knowledge Universe (audit trail).

---

## 8. Roadmap (LifeOS v1 → v2)

- **v1.0 (this doc):** Architecture + schemas + engine specs.
- **v1.1:** Brain DNA + Knowledge Universe persistence.
- **v1.2:** Memory + Mission + Goal engines.
- **v1.3:** Agent Engine on ForgeOS runtime.
- **v1.4:** Marketplace import/export of slices & skills.
- **v2.0:** Cross-user knowledge inheritance (opt-in).

See `docs/ROADMAP.md` for detail.

---
*Owner: CPO · Engineering: CTO · Last updated: 2026-07-12*
