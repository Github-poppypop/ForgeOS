# Security Principles

Derived from Constitution Article VII. ForgeOS enforces these automatically.

1. **Secrets** — never stored in repositories; use environment injection.
2. **Migrations** — all schema changes are versioned migrations, never ad-hoc DDL.
3. **Documentation** — every API is documented before it ships.
4. **QA gate** — deployment requires passing automated quality gates.
5. **Review gate** — no merge without review.
6. **Least privilege** — agents and brains operate with minimum necessary access.
7. **Isolation** — the root brain is isolated; app-child brains do not mingle.
8. **Audit** — security-relevant actions are logged to the Timeline Engine and
   Decision Ledger.
