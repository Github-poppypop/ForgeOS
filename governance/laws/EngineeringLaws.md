# Engineering Laws (Immutable Platform Rules)

ForgeOS enforces these automatically. They cannot be overridden by instruction.

1. **No deployment without passing QA.**
2. **No merge without review.**
3. **No API without documentation.**
4. **No database changes without migrations.**
5. **No production secrets in repositories.**
6. **Every feature requires tests.**
7. **Every feature requires documentation.**
8. **Every mission requires an RFC.**
9. **Every decision must be recorded** (Decision Ledger).
10. **Every artifact must be versioned.**
11. **No implementation without Definition of Done** (Vision, Requirements, RFC,
    Architecture, DB Design, API Design, UI Design, Test Strategy, Security Review, DoD).
12. **No unreviewed production change** — high-impact actions require approval.

Violations are blocked by the platform and surfaced in the Command Center as
**Blocked Work** with the responsible role.
