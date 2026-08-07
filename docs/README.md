# /docs — ForgeOS Documentation

**Primary owner:** CMO (external docs) · **Secondary:** CEO
**Purpose:** All human-facing documentation — charters, guides, specs, ADRs,
and the public documentation site source.

## Contents (planned)
- `charter/` — MISSION, VISION, ORG, ROADMAP (canonical copies)
- `guides/` — onboarding, contributor, operator guides
- `specs/` — technical & product specifications
- `adr/` — Architecture Decision Records
- `site/` — source for the external docs site (built from these docs)
- `developers/` — agent authoring, API gateway, marketplace, Docker
- `tutorials/` — video scripts, step-by-step walkthroughs
- `onboarding/` — community funnel stages

## Rules
- External-facing content must align to VISION.md and be validated with CPO
  before publishing claims about product behavior.
- ADRs are immutable once merged; supersede via a new ADR, never edit history.
- All docs are versioned artifacts of the org (Structure as code — VISION §).
