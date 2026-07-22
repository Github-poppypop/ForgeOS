# Memory Engine

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO / CTO (eng) · **Ops:** COO · **Status:** Design v1.0

## Purpose
The Memory Engine captures, indexes, and retrieves the user's experience. It is
the **writable front door** to the Knowledge Universe — every event LifeOS
observes becomes a memory.

## Memory kinds
| Kind | What | Example |
|------|-------|---------|
| `episodic` | Specific events/experiences | "Meeting with X on Friday" |
| `semantic` | Facts, concepts, knowledge | "Project Y uses Postgres" |
| `procedural` | How-to / skills | "Deploy via `vercel --prod`" |

## Data Contract
```ts
Memory = {
  id: string
  kind: "episodic" | "semantic" | "procedural"
  content: string
  embeddings?: vector
  source: string            // agent, import, user
  timestamp: ISODate
}
```

## Operations
- **Ingest** — `KU' = ingest(KU, event)`; classifies kind, embeds, stores.
- **Retrieve** — semantic + temporal search over the Knowledge Universe.
- **Consolidate** — periodic merge of redundant/aging memories.
- **Forget** — user-initiated or policy-driven deletion (with audit log).

## Execution model
```
KU' = ingest(KU, event)
context = retrieve(KU, query, slice)
```
All outputs persist to the Knowledge Universe, so memory compounds across cycles.

## Quality & Ops (COO)
- Ingestion SLA and retrieval latency are tracked.
- QA gates on classification accuracy.
- Incident: memory corruption → restore from versioned KU snapshot.

## Relationships
- **←** all engines feed it events.
- **→** Brain Slices hydrate from it.
- **↔** Knowledge Universe core service (`/knowledge-universe`).

---
*Owner: CPO · Last updated: 2026-07-12*
