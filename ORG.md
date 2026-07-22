# ORG — ForgeOS Organizational Structure

This document is the **constitutional charter** of ForgeOS. It defines the
hierarchy, the responsibilities of every role, the rules of delegation, and the
reporting structure. It is versioned; changes require Board ratification.

---

## 1. Hierarchy (Top → Bottom)

```
                         ┌──────────────┐
                         │    BOARD     │  ← ultimate authority / constitutional owner
                         └──────┬───────┘
                                │ appoints & oversees
                         ┌──────▼───────┐
                         │     CEO      │  ← accountable for the whole org
                         └──────┬───────┘
            ┌──────────┬────────┼────────┬──────────┬──────────┐
            │          │        │        │          │          │
        ┌───▼───┐ ┌───▼───┐ ┌─▼───┐ ┌─▼───┐ ┌──▼───┐ ┌──▼───┐
        │  CTO  │ │  CPO  │ │ COO │ │ CMO │ │  CFO  │ │ (v1) │
        └───┬───┘ └───┬───┘ └─┬───┘ └─┬───┘ └──┬───┘ └──────┘
            │          │        │        │          │
     ┌──────┴─────┐ ┌──┴──┐ ┌──┴──┐ ┌─┴──┐ ┌────┴─────┐
   engineering  product  ops   gtm   finance  (support
   /services    /apps   /delivery /market  /infra      functions)
```

Each C-suite role owns a **domain**, a **set of agents**, and a **reporting
cadence** to the CEO. Detailed role files live in `profiles/c-suite/`.

---

## 2. Role Responsibilities

### Board
- Sets the **charter**, mission, and long-range vision; ratifies ORG.md changes.
- Appoints, evaluates, and may remove the CEO.
- Approves capital allocation, major strategy pivots, and constitutional risk.
- Meets on a fixed cadence; receives CEO report; does **not** micromanage ops.
- **Authority:** ultimate. **Accountability:** to stakeholders/charter.
- **Does NOT:** run agents, write code, manage roadmaps day-to-day.

### CEO (Chief Executive Officer)
- Accountable for **everything** inside ForgeOS; the single point of
  accountability to the Board.
- Translates vision into strategy; sets annual objectives (OKRs) for the C-suite.
- Coordinates the C-suite; resolves cross-domain conflicts.
- Owns external narrative + Board relationship; final escalation point.
- **Authority:** full operational, bounded by Board charter.
- **Delegates:** all execution to C-suite.

### CTO (Chief Technology Officer)
- Owns **technology, platform, infrastructure, and agent runtime**.
- Domains: `services/`, `infrastructure/`, agent runtime & safety.
- Responsible for: architecture integrity, uptime, security, dev velocity.
- **Reports to:** CEO. **Owns agents:** platform/infra/service agents.

### CPO (Chief Product Officer)
- Owns **product strategy, apps, UX, and the marketplace**.
- Domains: `apps/`, `marketplace/`, product roadmap.
- Responsible for: user value, feature prioritization, marketplace health.
- **Reports to:** CEO. **Owns agents:** product/app/marketplace agents.

### COO (Chief Operating Officer)
- Owns **operations, delivery, process, and cross-functional execution**.
- Domains: delivery pipelines, QA, incident response, internal ops.
- Responsible for: throughput, reliability of execution, SLA.
- **Reports to:** CEO. **Owns agents:** ops/delivery/QA agents.

### CMO (Chief Marketing Officer)
- Owns **brand, growth, community, and go-to-market**.
- Domains: `docs/` (external), marketing, community, partnerships.
- Responsible for: awareness, adoption, narrative consistency.
- **Reports to:** CEO. **Owns agents:** content/growth/community agents.

### CFO (Chief Financial Officer)
- Owns **finance, capital, budgeting, and compliance**.
- Domains: budgeting, run-rate, marketplace economics, regulatory posture.
- Responsible for: fiscal health, unit economics, audits, reporting.
- **Reports to:** CEO (and Board on capital matters). **Owns agents:**
  finance/analytics/compliance agents.

---

## 3. Delegation Rules

These rules are **mandatory** for every agent and executive.

1. **Single reporting line.** Every agent reports to exactly one C-suite owner.
   No agent reports to two executives.
2. **Mandate boundary.** Act freely within your domain. Any action crossing
   into another domain requires a delegation request to that domain's owner.
3. **Escalate, don't bypass.** If a decision exceeds your authority, escalate
   up the chain — never sideways-skip your owner.
4. **Delegate, don't abdicate.** When you delegate to a sub-agent, you remain
   accountable for the outcome. Require verification before marking done.
5. **Write it down.** Non-trivial delegations are recorded in the Knowledge
   Universe with: goal, owner, authority, deadline, success criteria.
6. **Reversibility check.** Irreversible actions (deploys, deletes, spends)
   require explicit owner sign-off.
7. **Autonomy ceiling.** Agents may act autonomously up to their authority
   limit; above it, they propose and await approval.
8. **No silent failure.** Every delegated task returns a verified result or an
   explicit blocker. No task ends with "I tried."

---

## 4. Reporting Structure & Cadence

| From → To | Cadence | Artifact |
|-----------|---------|----------|
| C-suite → CEO | Weekly | Status + OKR delta + blockers |
| CEO → Board | Monthly | Board report (health, capital, risk) |
| Agents → C-suite owner | Per-task + Daily digest | Task result + log reference |
| CFO → Board | Quarterly | Financials + audit |
| Cross-functional | Ad hoc | Incident / decision record in Knowledge Universe |

**Escalation path:** Agent → C-suite owner → CEO → Board.

**Conflict resolution:** CEO arbitrates cross-C-suite conflicts; unresolved →
Board.

---

## 5. Repo-to-Role Mapping

| Path | Primary Owner | Secondary |
|------|---------------|-----------|
| `/docs` | CMO | CEO |
| `/apps` | CPO | CTO |
| `/services` | CTO | COO |
| `/agents` | CTO (runtime) / CPO (product) | COO |
| `/profiles` | CEO (c-suite) / COO (teams) | — |
| `/marketplace` | CPO | CFO (economics) |
| `/knowledge-universe` | COO (curation) / all | — |
| `/infrastructure` | CTO | COO |

---

*Owner: Board · Maintained by CEO · Last ratified: 2026-07-12*
