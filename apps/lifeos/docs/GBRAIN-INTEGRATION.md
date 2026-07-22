# LifeOS × GBrain — Integration

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO / CTO · **Status:** Design v1.0
**Substrate:** [`garrytan/gbrain`](https://github.com/garrytan/gbrain)

LifeOS runs as a **federated child brain** under ForgeOS. This doc maps the
LifeOS architecture onto gbrain, and onto the federation rules in
`../../../knowledge-universe/BRAIN-FEDERATION.md`. LifeOS does not re-implement
memory; its brain is a **separate gbrain instance** shaped by the `forgeos`
schema pack (so it replicates the same hierarchy), subordinate to the ForgeOS
root brain.

> **Key rule:** LifeOS has its OWN isolated brain. ForgeOS can **read down**
> into it (oversight), but LifeOS can only **write governance records up**
> (`decision`/`incident`/`kpi` to `/apps-feed/lifeos/`). No raw memory crosses,
> and LifeOS cannot see ForgeOS or any sibling app. See `BRAIN-FEDERATION.md`.

---

## 1. LifeOS components → gbrain primitives

| LifeOS component | gbrain representation |
|------------------|------------------------|
| **Brain DNA** | `person` entity page for the user; `constraints` stored as facts (`confidence=hard`, immutable by agents). Traits/values/preferences = facts. |
| **Brain Slices** | Scoped sources / filtered views — topic-scoped reads of the user's brain. A slice = a saved query + visibility tag. |
| **Memory Engine** | `gbrain capture` / `ingest` → event ledger + fact store. `episodic`=`meeting/email/tweet`; `semantic`=`concept/analysis`; `procedural`=`guide/howto`. |
| **Mission Engine** | `mission` page (compiled truth + timeline). `reconcile()` = gbrain fact conflict check vs DNA constraints. |
| **Goal Engine** | `goal` pages with typed edge `parent_of` (goal graph) + `derived_from` (mission). Status = fact on the page. |
| **Agent Engine** | gbrain **Minions** queue; agent = Minion with scoped token. Mandate = token scope. |
| **Knowledge Universe** | The LifeOS brain DB itself (separate instance). |
| **Marketplace** | gbrain **skillpacks** — slices/skills exported as revocable packs. |

---

## 2. Federation (LifeOS is a child brain)

LifeOS's brain is a **separate gbrain instance** (`lifeos-brain`), not a slice
of the ForgeOS root. Inside it, the `forgeos` schema pack creates LifeOS's own
Board/CEO/CTO/CPO/COO/CMO/CFO — a replicated, **subordinate** hierarchy.

```
lifeos-brain (isolated instance)
├── lifeos-board ──appoints──▶ lifeos-ceo
├── lifeos-cto/cpo/coo/cmo/cfo ──reports_to──▶ lifeos-ceo
└── lifeos-ceo ──reports_up_to──▶ forgeos-ceo   # the ONLY cross-boundary edge
```

- **ForgeOS reads down** into `lifeos-brain` via a `read` token (oversight only).
- **LifeOS writes up** only governance records to `/apps-feed/lifeos/`
  (`decision`, `incident`, `kpi`) — never raw memory.
- **LifeOS sees neither** ForgeOS nor sibling apps (separate instance).

Config: `apps/lifeos/lifeos-brain.yml` + `lifeos-schema-pack.yaml`.

---

## 3. Data contract alignment

LifeOS `DATA-MODEL.md` entities map onto gbrain's four DB primitives:

| LifeOS type | gbrain primitive | Notes |
|-------------|------------------|-------|
| `BrainDNA` | Entity registry + fact store | Canonical user entity; constraints = hard facts. |
| `BrainSlice` | Source config + saved view | Scoped, visibility-tagged. |
| `Memory` | Fact store + event ledger | `kind` → page type; `embeddings` → gbrain vector col. |
| `Mission` | Page (compiled truth) | Horizon = frontmatter field. |
| `Goal` | Page + `parent_of` edges | `status` = fact. |
| `Agent` | Minion + scoped token | `mandate` = token scope (allowed/forbidden actions). |

---

## 4. The compounding loop (preserved, locally)

```
user/agent signal
   → gbrain capture/ingest         (event ledger + facts, in lifeos-brain)
   → enrichment fires on entity     (Brain DNA / Slice updated)
   → gbrain think (synthesis)       (cited answer + gap analysis)
   → Agent (Minion) plans+executes  (bounded by mandate/scope)
   → result captured back to brain  (compounds — locally, in lifeos-brain)
   → governance summary → reports_up_to → /apps-feed/lifeos/  (up only)
```

---

## 5. Grounded autonomy (LifeOS + gbrain)

- Agent mandate = gbrain token scope. Out-of-mandate step → **403** → LifeOS
  Agent Engine escalates (never runs).
- Brain DNA `constraints` are **hard facts**; gbrain fact-store conflict check
  blocks any mission/goal/agent action that would breach them.
- Marketplace imports are slice-scoped → can never exceed importer's DNA
  constraints (gbrain scope gating enforces this).
- A blocked goal / safety breach → `incident` + `reports_up_to` edge to
  ForgeOS (escalation, not memory merge).

---

## 6. LifeOS brain layout

```
lifeos-brain/
├── RESOLVER.md            (forgeos pack resolver)
├── board/  ceo/  cto/  cpo/  coo/  cmo/  cfo/   (replicated hierarchy)
├── people/me.md           (Brain DNA — traits, values, CONSTRAINTS)
├── slices/                (Brain Slices — topic-scoped views)
├── missions/              (Mission Engine output)
├── goals/                 (Goal graph)
├── memories/              (episodic/semantic/procedural)
└── capabilities/          (imported Marketplace skillpacks)
```

---

## 7. Commands (LifeOS agent surface)

```bash
gbrain capture "..."            # Memory Engine ingest (local brain)
gbrain think "..."              # synthesis w/ gap analysis (briefings)
gbrain schema use forgeos       # activate org schema pack (replicated hierarchy)
gbrain agent run "..."          # Minion execution (Agent Engine)
gbrain skillpack install <id>   # Marketplace consume
# federation uplink (governance only):
gbrain capture --type decision --slice apps-feed/lifeos ...
```

---

## 8. Privacy & isolation

- LifeOS brain is a **private, isolated gbrain instance** (PGLite or private Postgres).
- ForgeOS oversight = read-down token only; it cannot mutate the child.
- Cross-app inheritance (LifeOS v2.0) = opt-in federation with constraint
  gating — never a raw data share between instances.

---
*Owner: CPO · Last updated: 2026-07-12*

