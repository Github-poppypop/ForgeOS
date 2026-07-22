# Mission Engine

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO / CTO · **Status:** Design v1.0

## Purpose
The Mission Engine holds the user's **purpose, principles, and long-range
intent**. It is the compass that the Goal Engine decomposes and the Agent Engine
respects. A mission may never violate Brain DNA values/constraints.

## Data Contract
```ts
Mission = {
  id: string
  statement: string
  principles: string[]
  horizon: "life" | "year" | "quarter"
}
```

## Operations
- **Define / revise** — user sets or amends mission (owner approval required).
- **Reconcile** — `Mission' = reconcile(Mission, DNA, input)`; rejects any
  mission that conflicts with DNA constraints/values.
- **Cascade** — exposes principles to the Goal Engine as guardrails.

## Execution model
```
Mission' = reconcile(Mission, DNA, input)
```
Reconciliation is a validation gate: a proposed mission that breaches a DNA
constraint is refused and the conflict is surfaced to the user.

## Governance
- Mission is **user-authored**; agents may propose drafts but cannot self-approve.
- Horizon scoping lets users hold a life mission while running quarterly missions.

## Relationships
- **← Brain DNA:** values/constraints bound the mission.
- **→ Goal Engine:** principles become goal guardrails.
- **→ Agent Engine:** agents evaluate actions against mission principles.

---
*Owner: CPO · Last updated: 2026-07-12*
