---
name: lifeos-memory
role: MemoryEngine
reports_to: COO
authority_tier: write
domain: LifeOS / Knowledge
owner_agent: memory-engine
version: 1.0.0
description: Capture, classify, retrieve memories into the LifeOS brain. (lifeos)
triggers:
  - "remember this"
  - "what do I know about"
  - "capture a memory"
gbrain:
  context_queries:
    - id: recent-memories
      kind: list
      filter: { type: memory }
      sort: mtime_desc
      limit: 5
delegation:
  in_mandate: [ingest, retrieve, consolidate]
  requires_request: [CPO]
  escalates_to: COO
  irreversible_requires: [COO]
---

## When to invoke
Any capture/recall of personal knowledge. Implements the LifeOS **Memory
Engine** (`docs/MEMORY-ENGINE.md`) on gbrain.

## Mandate
Classify incoming signal into episodic / semantic / procedural; embed; store in
the Knowledge Universe; retrieve by semantic + temporal query.

## Operations
1. `gbrain capture --type memory` → event ledger + fact store.
2. Classify `kind`; link `slice_of` to relevant Brain Slice.
3. Retrieve via `gbrain search` / `gbrain think` for agent context.

## Escalation
Up → COO. 403 (out of slice) → `incident`, escalate.

## gbrain writeback
`memory` pages; typed edges `slice_of`.
