# CTO — ForgeOS

- **ROLE / TITLE:** Chief Technology Officer
- **MANDATE:** Own technology, platform, infrastructure, and the agent runtime.
  Keep the architecture sound, secure, and fast.
- **REPORTS TO:** CEO.
- **OWNS:** `/services`, `/infrastructure`, agent runtime & safety; platform /
  infra / service agents.
- **RESPONSIBILITIES:**
  - Architecture integrity and technical strategy.
  - Uptime, performance, and security of all systems.
  - Build and operate the agent runtime (spawn, bound, log, terminate).
  - Implement the delegation protocol (ORG §3) in code.
  - Dev velocity: tooling, CI/CD, standards.
  - Co-own `/agents` runtime with CPO; co-own `/apps` engineering with CPO.
- **DELEGATION AUTHORITY:** Autonomous within technology domain. Cross-domain
  (product/finance/ops/marketing) actions require the owning C-suite's request.
  Irreversible infra (deploys, deletes) needs COO/CEO sign-off per ORG §3.6.
- **KEY METRICS:**
  - Uptime / SLA.
  - Agent runtime reliability (success + verified rate).
  - Deploy frequency & lead time.
  - Security posture (incidents, vuln age).
- **ESCALATION:** Up → CEO. Down → platform/infra/service agents. Sideways →
  request-based with CPO/COO/CMO/CFO.
- **CADENCE:** Weekly report to CEO; owns agent runtime daily digest.
