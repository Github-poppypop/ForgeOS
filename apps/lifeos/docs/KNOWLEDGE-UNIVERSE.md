# Knowledge Universe (LifeOS view)

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** COO (curation) / CTO (service) · **Status:** Design v1.0

## Purpose
The Knowledge Universe is LifeOS's **private, compounding memory store** — the
persistent substrate that Memory, Mission, Goal, and Agent engines read from and
write to. At the platform level it is the `/knowledge-universe` core service;
at the app level it is the user's personal instance.

## What it holds
- All `Memory` records (episodic / semantic / procedural).
- Mission, Goal, and Agent state snapshots.
- Decision & escalation records (audit trail).
- Imported/exported slice metadata.

## Properties
| Property | Behavior |
|----------|----------|
| **Private by default** | Per-user encrypted instance. |
| **Versioned** | Snapshots enable restore (COO incident response). |
| **Compounding** | Every cycle's outputs become next cycle's inputs. |
| **Queryable** | Semantic + temporal retrieval for all engines. |

## Operations (app-facing)
- `ingest(event)` — Memory Engine writes here.
- `retrieve(query, slice)` — engines pull context.
- `snapshot()` / `restore()` — COO-managed backup/rollback.
- `export(slice)` / `import(listing)` — Marketplace bridge.

## Governance
- COO owns ingestion standards & retrieval quality (see `/knowledge-universe`).
- All material LifeOS decisions recorded here per `ORG.md §3.5`.
- No agent may bulk-delete; deletes are owner-approved + audited.

## Relationships
- **↔** Memory / Mission / Goal / Agent engines (read-write).
- **↔** ForgeOS `/knowledge-universe` core service.
- **↔** Marketplace (export/import bridge).

---
*Owner: COO · Last updated: 2026-07-12*
