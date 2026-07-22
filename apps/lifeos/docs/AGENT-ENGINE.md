# Agent Engine

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO (product) / CTO (runtime) / COO (ops) · **Status:** Design v1.0

## Purpose
The Agent Engine **spawns, binds, and runs autonomous agents** on behalf of the
user — each agent is grounded in Brain DNA, scoped to Brain Slices, and directed
by active Goals. It is LifeOS's execution layer, built on the ForgeOS Agent
Runtime.

## Data Contract
```ts
Agent = {
  id: string
  dnaRef: BrainDNA.id
  goalRefs: Goal.id[]
  mandate: Mandate          // derived from DNA constraints + goal scope
  status: "idle" | "running" | "escalated"
}
```

## Operations
- **Plan** — `actions = plan(Agent, Goal, KU)`; produces a step plan within
  mandate.
- **Execute** — `result = execute(actions)`; runs steps, writes outcomes to KU.
- **Bound** — mandate is computed from DNA constraints + goal scope; any planned
  action outside mandate is **escalated**, never silently run.
- **Terminate** — idle/complete agents are retired; logs persist to KU.

## Execution model
```
actions  = plan(Agent, Goal, KU)
result    = execute(actions)        // bounded by Mandate
KU'      = ingest(KU, result)      // memory compounds
```

## Governance (ForgeOS protocol)
LifeOS agents are **sub-agents** of the CPO product surface. They inherit:
- **Single reporting line** — every agent maps to the LifeOS owner chain.
- **Mandate boundary** — cross-mandate actions are escalated, not bypassed.
- **No silent failure** — every task returns a verified result or a blocker.
- **Irreversible sign-off** — deletes/spends/DNA changes need owner approval.

See `/agents/*.agent.md` and `ORG.md §3`.

## Safety
- Agents **cannot** modify Brain DNA constraints (hard block).
- Out-of-mandate proposals are surfaced to the user, never auto-executed.
- Full action log written to the Knowledge Universe (audit trail).

## Relationships
- **← Brain DNA / Brain Slices:** mandate + context.
- **← Goal Engine:** `goalRefs` drive planning.
- **↔ Knowledge Universe:** reads context, writes results.
- **↔ Marketplace:** imports agent skills/capabilities.

---
*Owner: CPO · Last updated: 2026-07-12*
