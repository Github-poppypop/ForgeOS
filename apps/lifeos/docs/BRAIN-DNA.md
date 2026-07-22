# Brain DNA

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO (product) / CTO (engineering) · **Status:** Design v1.0

## Purpose
Brain DNA is the **root schema of the self** — a structured, versioned,
queryable representation of who the user is. Every other LifeOS component
references it. It is the single source of identity.

## What it encodes
| Field | Meaning |
|-------|---------|
| `traits` | Stable dimensions (e.g. big-five style) describing temperament. |
| `values` | Prioritized principles the user lives by. |
| `preferences` | Recurring likes/dislikes (format, tone, pace). |
| `constraints` | **Hard limits** on agent and system behavior (non-negotiable). |

## Lifecycle
1. **Seed** — initial capture via interview/import; version 1.
2. **Evolve** — Memory Engine proposes DNA deltas; user approves (constraints
   require explicit owner sign-off — never auto-changed by agents).
3. **Version** — every change increments `version`; history is immutable.
4. **Derive** — Brain Slices and Agent mandates are projections of DNA.

## Data Contract (summary)
```ts
BrainDNA = {
  id: string
  version: number
  traits: Trait[]
  values: Value[]
  preferences: Preference[]
  constraints: Constraint[]   // hard agent limits
  updatedAt: ISODate
}
```
Full schema: `../ARCHITECTURE.md §4` and `DATA-MODEL.md`.

## Invariants
- DNA is the **only** source of `constraints`; agents cannot self-grant rights
  outside it.
- Reads are open to all LifeOS engines; **writes require owner approval**.
- DNA is encrypted at rest; highest-sensitivity store in LifeOS.

## Relationships
- **→ Brain Slices:** slices project DNA onto topics.
- **→ Mission Engine:** mission must not violate values/constraints.
- **→ Agent Engine:** agent mandate is derived from DNA + active goals.

---
*Owner: CPO · Last updated: 2026-07-12*
