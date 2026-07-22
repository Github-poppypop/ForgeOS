---
name: lifeos-agent
role: AgentEngine
reports_to: COO
authority_tier: write
domain: LifeOS / Autonomy
owner_agent: agent-engine
version: 1.0.0
description: Spawn and run LifeOS agents bound to Brain DNA + goals. (lifeos)
triggers:
  - "run an agent"
  - "delegate this task"
  - "spawn an agent"
gbrain:
  context_queries:
    - id: dna
      kind: list
      filter: { type: brain_dna }
      limit: 1
    - id: goals
      kind: list
      filter: { type: goal, status: active }
      limit: 5
delegation:
  in_mandate: [plan, execute, terminate]
  requires_request: [CPO, COO]
  escalates_to: COO
  irreversible_requires: [COO]
---

## When to invoke
Executing a goal via an autonomous agent. Implements LifeOS **Agent Engine**
(`docs/AGENT-ENGINE.md`) on gbrain Minions.

## Mandate
Agent mandate = gbrain token scope, derived from Brain DNA `constraints` + goal
scope. Out-of-mandate step → gbrain **403** → escalate, never run. Agents
**cannot** modify DNA constraints (hard block).

## Operations
1. Load `brain_dna` + `goal` pages.
2. `plan`: steps within mandate; `execute` via Minion queue (2-phase safe).
3. Write result back to brain → compounds.
4. `terminate` idle/complete agents; logs persist.

## Escalation
Up → COO. 403 → `incident` + `escalated_to`.

## gbrain writeback
`agent` pages; edges `dna_of`, `runs` (goal).
