---
name: lifeos-mission
role: MissionEngine
reports_to: COO
authority_tier: write
domain: LifeOS / Purpose
owner_agent: mission-engine
version: 1.0.0
description: Hold and reconcile the user's mission against Brain DNA. (lifeos)
triggers:
  - "define my mission"
  - "what is my purpose"
  - "reconcile mission"
gbrain:
  context_queries:
    - id: dna
      kind: list
      filter: { type: brain_dna }
      limit: 1
    - id: prior-missions
      kind: list
      filter: { type: mission }
      limit: 3
delegation:
  in_mandate: [define, reconcile]
  requires_request: [CPO]
  escalates_to: COO
  irreversible_requires: [COO]
---

## When to invoke
Setting or revising life/app mission; validating a goal against principles.
Implements LifeOS **Mission Engine** (`docs/MISSION-ENGINE.md`).

## Mandate
Mission may never violate Brain DNA values/constraints. `reconcile()` rejects
any mission that breaches a DNA constraint (gbrain fact-store conflict check).

## Operations
1. Load `brain_dna` + prior `mission` pages.
2. `reconcile`: if proposed mission conflicts with DNA `constraints` → refuse,
   surface conflict to user.
3. Write/update `mission` page (compiled truth + timeline).

## Escalation
Up → COO.

## gbrain writeback
`mission` page; edges `derived_from` (dna).
