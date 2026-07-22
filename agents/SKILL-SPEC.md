# ForgeOS Agent Skill Spec — "Fused" Format

This is the **ForgeOS-native agent skill format**: gstack's `SKILL.md` mechanics
(frontmatter + triggers + `gbrain.context_queries`) fused with ForgeOS
governance (`ORG.md §3`). It is what makes our skills **better than either
reference** — gstack has no hierarchy; gbrain has no role behavior. We add both.

## Why this format (the fusion)

| Reference | What we take | What we improve |
|-----------|--------------|-----------------|
| **gstack** | `SKILL.md` frontmatter (`name`, `triggers`, `allowed-tools`), preamble pattern, router skill, role/persona skills, `routing-eval.jsonl` | Add `reports_to`, `authority_tier`, `mandate`, `delegation`, `escalation` → real governance gstack lacks |
| **gbrain** | `context_queries` block, scoped slices, Minions execution, synthesis | Add `decision`/`incident` as first-class writeback types; bind scopes to org hierarchy |

## SKILL.md frontmatter schema

```yaml
---
name: forgeos-<role>          # unique slug
role: CTO                     # one of the 7 + Board
reports_to: CEO               # single reporting line (ORG §3.1)
authority_tier: write         # admin | write | read  (maps to gbrain scope)
domain: Technology / Platform / Infrastructure
owner_agent: cto              # gbrain entity slug in the org brain
version: 1.0.0
description: one-line, agent-readable
triggers:                     # >=3 phrases that route to this skill
  - "architecture decision"
  - "tech strategy"
  - "platform incident"
gbrain:
  context_queries:            # auto-loaded into context (from gbrain org brain)
    - id: prior-decisions
      kind: list
      filter: { type: decision, tags_contains: "role:cto" }
      limit: 5
delegation:                   # ORG §3 binding rules
  in_mandate: [architecture, infra, runtime]
  requires_request: [CPO, COO, CFO]   # cross-domain needs a request
  escalates_to: CEO
  irreversible_requires: [CEO, COO]   # deploys/deletes/spend (§3.6)
---
```

## Body sections (required)

1. **When to invoke** — trigger semantics.
2. **Mandate** — bounded authority (mirrors `agents/<role>.agent.md`).
3. **Operations** — concrete steps the skill executes (build/plan/review/qa…).
4. **Delegation Rules** — in-mandate vs request-based vs escalate.
5. **Escalation** — exact path + when (403 from gbrain = out-of-mandate).
6. **gbrain writeback** — what it writes (decision/incident/capability pages).

## Rule: governance is non-negotiable
A skill with no `reports_to` / `authority_tier` / `escalates_to` is **invalid** —
it would be an ungoverned agent (forbidden by ORG §3.1). The registry linter
(`agents/skills/README.md` §Lint) rejects it.

## Files per skill
```
agents/skills/forgeos/<role>/
├── SKILL.md              # spec-compliant
├── routing-eval.jsonl    # >=5 intents: trigger -> skill  (gbrain MECE rule)
└── runbook.md            # post-scaffold display (NOT auto-executed)
```
