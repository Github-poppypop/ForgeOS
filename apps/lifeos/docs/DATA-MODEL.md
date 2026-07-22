# LifeOS — Data Model (full schema)

**Companion to** `ARCHITECTURE.md §4`. Canonical TypeScript-ish contracts for
all LifeOS entities. Versioned with the app (`manifest.json`).

```ts
// ── Brain DNA ───────────────────────────────────────────────
type Trait     = { dimension: string; score: number; evidence?: string }
type Value     = { id: string; label: string; rank: number }
type Preference= { id: string; category: string; value: string }
type Constraint= { id: string; rule: string; severity: "hard" | "soft" }

type BrainDNA = {
  id: string
  version: number
  traits: Trait[]
  values: Value[]
  preferences: Preference[]
  constraints: Constraint[]   // hard limits on agent/system behavior
  updatedAt: ISODate
}

// ── Brain Slices ────────────────────────────────────────────
type BrainSlice = {
  id: string
  topic: string
  dnaRef: BrainDNA["id"]
  memoryRefs: Memory["id"][]
  summary: string
  visibility: "private" | "shared" | "public"
}

// ── Memory ──────────────────────────────────────────────────
type Memory = {
  id: string
  kind: "episodic" | "semantic" | "procedural"
  content: string
  embeddings?: number[]
  source: string            // agent | import | user
  timestamp: ISODate
}

// ── Mission ─────────────────────────────────────────────────
type Mission = {
  id: string
  statement: string
  principles: string[]
  horizon: "life" | "year" | "quarter"
}

// ── Goal ────────────────────────────────────────────────────
type GoalStatus = "active" | "blocked" | "done" | "abandoned"
type Goal = {
  id: string
  missionRef?: Mission["id"]
  parentGoalId?: Goal["id"]
  title: string
  status: GoalStatus
  subGoals: Goal["id"][]
  agentRefs: Agent["id"][]
}

// ── Agent ───────────────────────────────────────────────────
type Mandate = {
  allowedActions: string[]
  forbiddenActions: string[]
  dnaRef: BrainDNA["id"]
}
type AgentStatus = "idle" | "running" | "escalated"
type Agent = {
  id: string
  dnaRef: BrainDNA["id"]
  goalRefs: Goal["id"][]
  mandate: Mandate
  status: AgentStatus
}

// ── Marketplace (app-level) ────────────────────────────────
type LifeOSListing = {
  id: string
  type: "slice" | "skill" | "knowledge" | "goal-template"
  owner: string
  visibility: "private" | "shared" | "public"
  pricing: string          // references ForgeOS marketplace economics
  revocable: true
}
```

## Storage mapping
| Entity | Store |
|--------|-------|
| BrainDNA, BrainSlice | Knowledge Universe (encrypted, versioned) |
| Memory | Knowledge Universe core |
| Mission, Goal, Agent | Knowledge Universe (state snapshots) |
| LifeOSListing | ForgeOS `/marketplace` registry |

## Invariants
1. `Agent.mandate.forbiddenActions` ⊆ derived from `BrainDNA.constraints`.
2. `BrainSlice.dnaRef` must match the agent/session DNA.
3. `Goal.missionRef`, if present, must not conflict with DNA constraints.
4. All deletes are soft + audited; `constraints` immutable by agents.

---
*Owner: CPO/CTO · Last updated: 2026-07-12*
