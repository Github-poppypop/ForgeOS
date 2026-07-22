# Marketplace (LifeOS view)

**Component of LifeOS** · `apps/lifeos/docs`
**Owner:** CPO (curation) / CFO (economics) · **Status:** Design v1.0

## Purpose
The Marketplace is LifeOS's **capability exchange** — the place where Brain
Slices, agent skills, and knowledge packs are published, discovered, and consumed.
It is the app-level face of the ForgeOS `/marketplace`.

## What is traded
| Listing type | Example |
|--------------|---------|
| **Brain Slice** | "Founder mindset" slice, importable |
| **Agent skill** | "Email triage" agent capability |
| **Knowledge pack** | "Personal finance basics" semantic set |
| **Goal template** | "Launch a product in 90 days" goal graph |

## Listing contract (app-level)
```ts
LifeOSListing = {
  id: string
  type: "slice" | "skill" | "knowledge" | "goal-template"
  owner: User.id
  visibility: "private" | "shared" | "public"
  pricing: PricingRef        // references ForgeOS marketplace economics
  revocable: true
}
```

## Operations
- **Publish** — user exports a slice/skill (visibility `shared/public`).
- **Discover** — search the ForgeOS Marketplace index.
- **Consume** — import applies the listing into the user's Knowledge Universe;
  slices are scoped, skills attach to the Agent Engine.
- **Revoke** — publisher can withdraw a listing at any time.

## Governance & economics
- Pricing model set by CFO per ForgeOS marketplace economics (`/marketplace`).
- Imports are **slice-scoped** — they can never exceed the importer's DNA
  constraints.
- All trades logged to the Knowledge Universe (audit + learning).

## Relationships
- **↔** Brain Slices (export unit).
- **↔** Agent Engine (skill import).
- **↔** Knowledge Universe (pack import/export).
- **↔** ForgeOS `/marketplace` (index + economics).

---
*Owner: CPO · Last updated: 2026-07-12*
