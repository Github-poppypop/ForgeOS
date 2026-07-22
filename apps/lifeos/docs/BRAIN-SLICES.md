# Brain Slices

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO / CTO · **Status:** Design v1.0

## Purpose
Brain Slices are **topic-scoped context views** derived from Brain DNA plus the
memories relevant to a topic. They let LifeOS load *just the right self* for a
task instead of the entire mind — enabling focus, privacy, and shareability.

## What a slice is
```ts
BrainSlice = {
  id: string
  topic: string                 // e.g. "finance", "health", "writing"
  dnaRef: BrainDNA.id
  memoryRefs: Memory.id[]
  summary: string               // condensed context for agents
  visibility: "private" | "shared" | "public"
}
```

## Why slices matter
- **Context economy:** Agents receive only topic-relevant DNA + memory.
- **Privacy scoping:** A "work" slice can be shared without exposing "health".
- **Composability:** Slices are the unit exported to the Marketplace.
- **Conflict isolation:** Topic conflicts stay inside their slice.

## Lifecycle
1. **Create** — on first activity in a topic; seeded from DNA + retrieved memory.
2. **Hydrate** — Memory Engine keeps `memoryRefs` current.
3. **Summarize** — a condensed `summary` is maintained for agent context.
4. **Share/Export** — `visibility` flips; Marketplace listing created (revocable).

## Governance
- Slice creation is autonomous (CTO-runtime).
- `visibility` change to `shared`/`public` requires owner approval.
- A slice can never exceed the constraints encoded in its `dnaRef`.

## Relationships
- **← Brain DNA:** projection source.
- **→ Agent Engine:** agents are bound to one or more slices for context.
- **→ Marketplace:** slices are exportable units.

---
*Owner: CPO · Last updated: 2026-07-12*
