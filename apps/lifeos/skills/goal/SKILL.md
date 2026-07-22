---
name: lifeos-goal
role: GoalEngine
reports_to: COO
authority_tier: write
domain: LifeOS / Execution
owner_agent: goal-engine
version: 1.0.0
description: Decompose missions into goal graphs; track to completion. (lifeos)
triggers:
  - "set a goal"
  - "break this down"
  - "track my objectives"
gbrain:
  context_queries:
    - id: missions
      kind: list
      filter: { type: mission }
      limit: 3
    - id: open-goals
      kind: list
      filter: { type: goal, status: active }
      limit: 5
delegation:
  in_mandate: [decompose, track, assign]
  requires_request: [CPO]
  escalates_to: COO
  irreversible_requires: [COO]
---

## When to invoke
Turning a mission/intent into an executable goal graph. Implements LifeOS
**Goal Engine** (`docs/GOAL-ENGINE.md`).

## Mandate
`decompose()`: break a goal into sub-goals respecting mission principles + DNA
constraints. Sub-goals needing out-of-mandate agent action are flagged for
escalation, not auto-assigned.

## Operations
1. Load `mission` + `goal` pages.
2. `decompose` → `goal` pages with `parent_of` edges + `derived_from` mission.
3. Link `agent_refs` (assign to LifeOS agents).
4. Track status transitions; close/abandon (audited).

## Escalation
Up → COO. Blocked goal → `incident`.

## gbrain writeback
`goal` pages; edges `parent_of`, `derived_from`, `runs`.
