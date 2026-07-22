# Goal Engine

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO / CTO · **Status:** Design v1.0

## Purpose
The Goal Engine turns Mission into an executable **goal graph** — objectives
decomposed into sub-goals, tracked to completion, and linked to the agents that
pursue them.

## Data Contract
```ts
Goal = {
  id: string
  missionRef?: Mission.id
  parentGoalId?: Goal.id
  title: string
  status: "active" | "blocked" | "done" | "abandoned"
  subGoals: Goal.id[]
  agentRefs: Agent.id[]
}
```

## Operations
- **Decompose** — `GoalGraph' = decompose(Goal, Mission, DNA)`; breaks a goal
  into sub-goals, respecting mission principles and DNA constraints.
- **Track** — status transitions (`active → blocked → done`).
- **Assign** — links sub-goals to agents via `agentRefs`.
- **Close / Abandon** — completion or explicit cancellation (audited).

## Execution model
```
GoalGraph' = decompose(Goal, Mission, DNA)
```
Decomposition is bounded: a sub-goal that would require an out-of-mandate agent
action is flagged for escalation rather than auto-assigned.

## Governance
- Goal creation is user-originated; agents may propose sub-goals.
- Blocked goals trigger escalation per ForgeOS protocol (`ORG.md §3`).
- Abandoned goals are preserved (not deleted) for learning.

## Relationships
- **← Mission Engine:** principles + horizon.
- **→ Agent Engine:** `agentRefs` bind agents to goals.
- **↔ Knowledge Universe:** progress recorded as memory.

---
*Owner: CPO · Last updated: 2026-07-12*
