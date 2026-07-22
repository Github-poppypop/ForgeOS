# Agent Registry — ForgeOS

Authoritative index of all governed agents. Each entry links to its definition
file (schema: MISSION · RESPONSIBILITIES · KPIs · DECISION RIGHTS ·
DELEGATION RULES · ESCALATION RULES). Canonical hierarchy & rules: `../ORG.md`.

## C-Suite Agents (constitutional layer)

| Agent | File | Reports To | Domain | Owner |
|--------|-------|------------|--------|-------|
| Board | `board.agent.md` | Charter / Stakeholders | Governance | Board |
| CEO | `ceo.agent.md` | Board | Whole Org | Board |
| CTO | `cto.agent.md` | CEO | Tech / Platform / Infra | CEO |
| CPO | `cpo.agent.md` | CEO | Product / Apps / Marketplace | CEO |
| COO | `coo.agent.md` | CEO | Ops / Delivery / Knowledge | CEO |
| CMO | `cmo.agent.md` | CEO | Brand / Growth / Community | CEO |
| CFO | `cfo.agent.md` | CEO (ops) / Board (capital) | Finance / Capital / Compliance | CEO |

## Delegation Rights Legend (per agent DECISION RIGHTS)
- ✅ sole/full authority
- ⚠️ conditional — requires co-sign (named in file)
- ❌ outside mandate — requires request to owning role

## Notes
- Every agent has exactly one reporting line (ORG §3.1).
- Sub-agents (platform, product, ops, etc.) are defined per-domain and inherit
  their C-suite owner's rules. See `../profiles/c-suite/`.
- Irreversible actions (deploys, deletes, spend) require owner sign-off (ORG §3.6).
