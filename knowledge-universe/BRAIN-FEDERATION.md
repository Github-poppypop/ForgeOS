# Brain Federation — ForgeOS ⊃ App Brains

**Owner:** CTO (runtime) / COO (curation) · **Status:** Design v1.0
**Supersedes:** single-slice model in `GBRAIN-INTEGRATION.md §2`.

This document defines the **federated brain topology** of ForgeOS. It is the
constitutional rule that the ForgeOS brain and its hierarchy **supercede every
app brain**, while each app keeps its own isolated brain + replicated hierarchy.

---

## 1. Principle

> ForgeOS is the root. Every app is a child brain. The child replicates the
> parent's hierarchy but is subordinate to it. Knowledge flows **up**, never
> **sideways**.

Three invariants:

1. **Supercession.** ForgeOS hierarchy > app hierarchy. An app C-suite reports
   *up to* the ForgeOS C-suite in the reporting graph, even though the app
   operates autonomously inside its own brain.
2. **Isolation.** Each app brain is a **separate gbrain instance** (separate
   DB). Sibling apps cannot see each other. No cross-mingle, ever.
3. **Directionality.** Reads go **down** (ForgeOS → app, oversight). Writes go
   **up** (app → ForgeOS, governance only). There is no app→app or app→ForgeOS
   raw memory path.

---

## 2. Topology

```
FORGEOS ROOT BRAIN  (admin over federation)
├── /forgeos                # ForgeOS's own hierarchy slice
│    ├── board  ceo  cto  cpo  coo  cmo  cfo
│    └── decisions/ incidents/   (org-governance records)
│
├── /apps-feed              # WRITE-UP UPLINK (app → ForgeOS, governance only)
│    ├── lifeos/decisions/   # selected records pushed by LifeOS
│    ├── lifeos/incidents/
│    └── <app>/...           # one sub-tree per app
│
└── [federation connectors → READ-DOWN]
     ├── lifeos  ──► child brain instance A  (isolated)
     ├── <app>   ──► child brain instance B  (isolated)
     └── ...                    (no instance sees another)
```

Each **child brain** (e.g. LifeOS) is a full gbrain instance with the `forgeos`
schema pack, so it contains its **own** Board/CEO/CTO/CPO/COO/CMO/CFO — a
replicated, subordinate hierarchy.

---

## 3. Visibility matrix

| From \ To | ForgeOS root | App A brain | App B brain | /apps-feed |
|-----------|:---:|:---:|:---:|:---:|
| **ForgeOS root** | own | **read** (down) | **read** (down) | write (owns) |
| **App A brain** | *no* | own | *no* | **write-up** (gov only) |
| **App B brain** | *no* | *no* | own | **write-up** (gov only) |

- **Read-down** is ForgeOS-only (oversight/supervision). Implemented as
  read-only federation connectors — ForgeOS holds a read token per child.
- **Write-up** is app-only and **constrained**: apps may push only governance
  record types (`decision`, `incident`, `kpi`) to their `/apps-feed/<app>/`
  sub-tree. They cannot write to ForgeOS's own slices or to any sibling.
- **Lateral** is blocked by construction: separate DB instances + no shared
  tokens. (This is gbrain's company-brain zero-leak guarantee, extended from
  slices to instances.)

---

## 4. Hierarchy inheritance (replicated, subordinate)

Each child brain runs the same `forgeos` schema pack → same role types and link
verbs. The reporting graph is **local within the app**, PLUS one upward edge:

```
# inside LifeOS brain:
lifeos-board ──appoints──▶ lifeos-ceo
lifeos-cto/cpo/coo/cmo/cfo ──reports_to──▶ lifeos-ceo

# cross-boundary (the ONLY app→ForgeOS edge):
lifeos-ceo ──reports_up_to──▶ forgeos-ceo
```

`reports_up_to` is a constrained edge: it carries **governance summaries**
(decisions, escalations, KPI deltas), not memory. ForgeOS reads these from
`/apps-feed/lifeos/` — it does **not** need write access to the child.

---

## 5. Enforcement (gbrain mechanics)

- **Child isolation** = separate gbrain instance per app (`gbrain init` per
  app, distinct `DATABASE_URL` / PGLite path). No shared scope → no leak.
- **Read-down** = ForgeOS root holds a `read`-scoped OAuth client per child
  brain; children hold **no** token for the root or siblings.
- **Write-up** = app brain holds a `write`-scoped token **only** for
  `/apps-feed/<app>/`. Constrained by record `type` allow-list
  (`decision`, `incident`, `kpi`) enforced at the gbrain server.
- **Supercession** = the ForgeOS `forgeos-ceo` is the escalation terminus for
  every `reports_up_to` edge; app hierarchies cannot override org policy.

---

## 6. What this enables

- **Oversight without intrusion.** ForgeOS sees app decisions/escalations/KPIs
  but not app-private memory.
- **App autonomy.** Each app runs its full hierarchy autonomously in isolation.
- **No cross-contamination.** LifeOS's brain can never bleed into another app.
- **Clean escalation.** A blocked app goal surfaces to ForgeOS via
  `incident` + `reports_up_to`, never via raw memory merge.

---

## 7. Open items

- [ ] Provision per-app gbrain instances (separate DBs).
- [ ] Issue read-down tokens (ForgeOS → each child) + write-up tokens
      (each child → `/apps-feed/<app>/`).
- [ ] Enforce `type` allow-list on the write-up path at the gbrain server.
- [ ] Add `app` type + `reports_up_to` verb to `forgeos` schema pack.

---
*Owner: CTO/COO · Last updated: 2026-07-12*
