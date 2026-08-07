# Video Tutorial Script — Publish to Marketplace

**Length:** 3–5 minutes  
**Audience:** Developers, C-suite admins, capability owners  
**Style:** Screencast + voice-over

---

## Scene 1 — Intro (0:00–0:30)

| Time | Visual | Audio |
|------|--------|-------|
| 0:00 | Marketplace listing preview card. | "ForgeOS capabilities are apps, services, and skills published through the marketplace." |
| 0:15 | `marketplace/listings/` directory tree. | "In this video you will package a capability, price it, and publish it." |

## Scene 2 — Prepare the Artifact (0:30–1:15)

| Time | Visual | Audio |
|------|--------|-------|
| 0:30 | `mkdir -p marketplace/listings/my-skill` | "Create a listing directory with a manifest and a README." |
| 0:45 | Edit `manifest.json` (schema shown on screen). | "Every manifest needs id, type, owner, version, and pricing." |

## Scene 3 — Pricing (1:15–2:00)

| Time | Visual | Audio |
|------|--------|-------|
| 1:15 | `pricing` block in manifest. | "Choose flat, metered, or free. Internal capabilities are usually free; external ones need CFO sign-off." |
| 1:45 | CFO approval flow in ORG.md. | "Flat pricing is simplest; metered requires `/api/usage` hooks." |

## Scene 4 — Validate & Publish (2:00–2:45)

| Time | Visual | Audio |
|------|--------|-------|
| 2:00 | `curl -s http://127.0.0.1:7777/api/marketplace` | "The console reads the index from `/marketplace/listings/`. Commit to master and the listing appears automatically." |
| 2:25 | `git add`, `git commit`, `git push`. | "That's it — no separate deploy step. Structure as code." |

## Scene 5 — Subscribe (2:45–3:30)

| Time | Visual | Audio |
|------|--------|-------|
| 2:45 | `POST /api/marketplace/subscribe` with curl. | "Consumers subscribe via the API. The gateway handles auth and rate limits." |
| 3:10 | Console marketplace panel. | "The UI shows active subscriptions, cost, and usage." |

## Outro (3:30–3:45)

| Time | Visual | Audio |
|------|--------|-------|
| 3:30 | Link to `docs/developers/marketplace.md` + `marketplace/economics.md`. | "Next: learn the full economics model, then configure budgets for your org." |
