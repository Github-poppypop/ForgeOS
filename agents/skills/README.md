# ForgeOS Agent Skills — Registry

**Framework:** see [`../SKILL-SPEC.md`](SKILL-SPEC.md) (fused gstack + gbrain +
ORG §3 format).

This directory holds the **ForgeOS agent skill pack** — role behaviors that ride
on top of the gbrain-backed Knowledge Universe, governed by the ForgeOS
delegation protocol.

## Pack layout
```
agents/skills/
├── README.md              # this file (registry + lint)
└── forgeos/               # the org role pack
    ├── router/            # routes any request to the right role (gstack router analogue)
    ├── board/             # Board — constitutional owner (gstack has NO analogue)
    ├── ceo/               # CEO — unbounded accountability
    ├── cto/               # CTO — tech/platform/infra (gstack "Eng Manager")
    ├── cpo/               # CPO — product/apps/marketplace (gstack "Designer")
    ├── coo/               # COO — ops/delivery/QA/knowledge (gstack "Release+QA")
    ├── cmo/               # CMO — docs/brand/growth (gstack "Doc Engineer" + growth)
    └── cfo/               # CFO — finance/compliance (gstack has NO analogue)
```

## Why this is better than the references
- **gstack** gives role personas but **no hierarchy** — its CEO is unbounded and
  there is no Board. ForgeOS adds `reports_to` + `authority_tier` + `escalates_to`.
- **gbrain** gives memory but **no behavior** — skills supply the role logic and
  auto-load relevant brain context via `gbrain.context_queries`.
- **ForgeOS adds** the two roles gstack omits: **Board** (constitutional owner)
  and **CFO** (finance/compliance).

## Lint (run before committing a skill)
A skill is valid iff:
1. `SKILL.md` has frontmatter with `role`, `reports_to`, `authority_tier`,
   `escalates_to` (governance — no ungoverned agents, ORG §3.1).
2. `triggers` has ≥ 3 entries; no two skills share an identical trigger (MECE).
3. `routing-eval.jsonl` has ≥ 5 intents.
4. `runbook.md` is non-empty.
5. `gbrain.context_queries` references only org-brain types (`org`, `role`,
   `decision`, `incident`, `capability`).

## Runtime
Skills are invoked by the ForgeOS **Agent Engine** (gbrain Minions queue). A
role's `authority_tier` = its gbrain scope: `admin` (Board/CEO) or `write`
(C-suite). Out-of-mandate op → gbrain 403 → skill writes an `incident` page and
escalates. See `knowledge-universe/GBRAIN-INTEGRATION.md`.

## Status
🟡 design — skills specified, not yet executed against a live gbrain instance.
