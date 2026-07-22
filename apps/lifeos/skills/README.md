# LifeOS Agent Skills — Registry

LifeOS engine behaviors, expressed in the ForgeOS fused skill format
(see `../../../agents/SKILL-SPEC.md`). Each runs on the user's private gbrain
brain (LifeOS schema pack) and reports into the ForgeOS COO chain.

| Skill | Engine | gbrain type | Reports to |
|-------|--------|-------------|-----------|
| `memory/` | Memory Engine | `memory` | COO |
| `mission/` | Mission Engine | `mission` | COO |
| `goal/` | Goal Engine | `goal` | COO |
| `agent/` | Agent Engine | `agent` (Minion) | COO |

All four inherit the governance rules: single reporting line, mandate boundary,
no silent failure, irreversible sign-off. The Agent Engine adds the hard
constraint that agents **cannot** modify Brain DNA `constraints`.

These are the *behavior* layer under `apps/lifeos/docs/` architecture. Engine
runtime stubs live in `apps/lifeos/src/`.
