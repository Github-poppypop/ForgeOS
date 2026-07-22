# /profiles — ForgeOS Role & Team Profiles

**C-suite owner:** CEO (`/profiles/c-suite`) · **Team owner:** COO (`/profiles/teams`)
**Purpose:** Authoritative definitions of every role and team in the org.

## Structure
```
profiles/
  c-suite/   # Board + CEO/CTO/CPO/COO/CMO/CFO (see c-suite/README.md)
  teams/     # functional teams that report into C-suite owners
```

## Rules
- `c-suite/` is the constitutional layer; changes require Board ratification.
- `teams/` defines the teams that operationalize each C-suite domain. Each team
  names its C-suite owner and reporting cadence.
- No team or agent may exist without a defined owner (ORG §3.1).
