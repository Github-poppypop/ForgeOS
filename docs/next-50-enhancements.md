# Next-50 Enhancements — ForgeOS Platform

**Status:** Planned  
**Target:** End-to-end mock-first implementation; real backends can be wired later.  
**Batch strategy:** 10 enhancements per logical batch; each batch is a single commit.

---

## Batch A — Mock Service Foundation (1–10)

1. Add `services/mock-service-registry.ts`: in-memory registry for all mock endpoints.
2. Add `services/mock-auth.ts`: fake login/registration/token refresh.
3. Add `services/mock-billing.ts`: invoices, plans, usage events.
4. Add `services/mock-notifications.ts`: in-app notifications feed.
5. Add `services/mock-search.ts`: keyword + tag search over seeded content.
6. Add `services/mock-ai.ts`: fake completion/embedding/rerank endpoints.
7. Add `services/mock-storage.ts`: file upload/list/delete with size limits.
8. Add `services/mock-webhooks.ts`: inbound webhook receiver + delivery log.
9. Add `services/mock-telemetry.ts`: events + metrics stream.
10. Add `services/mock-integrations.ts`: Slack/Notion/GitHub fake OAuth flows.

## Batch B — Brain Console UX + Data Panels (11–20)

11. Add saved views/filters for missions/vault/audit tables.
12. Add command-palette fuzzy search across all panels.
13. Add batch actions for missions/decisions/incidents.
14. Add export-to-CSV for vault/audit/missions tables.
15. Add inline edit for decisions with optimistic rollback.
16. Add time-travel diff viewer for decision history.
17. Add keyboard shortcuts cheatsheet panel.
18. Add offline mode queue with sync indicator.
19. Add panel resize + column reorder persistence.
20. Add right-click context menus on table rows.

## Batch C — Agent Runtime Hardening (21–30)

21. Add retry/backoff wrapper for gbrain CLI spawns.
22. Add circuit breaker for repeated gbrain failures.
23. Add agent sandbox policy enforcement in `agents/guardrails.ts`.
24. Add structured agent output schema validation.
25. Add agent memory cache with TTL eviction.
26. Add dead-letter queue for failed agent tasks.
27. Add agent cost/token accounting per role.
28. add agent A/B routing for canary prompts.
29. Add graceful degradation when Ollama is offline.
30. Add agent runbook auto-selection by mission type.

## Batch D — Knowledge Universe + Federation (31–40)

31. Add incremental sync from markdown files to knowledge universe.
32. Add link-health checker for federation edges.
33. Add duplicate-page detection + merge tooling.
34. Add semantic bookmarking and reading-list capture.
35. Add page-level analytics (views, edits, last accessed).
36. Add automatic frontmatter normalization on ingest.
37. Add access-control lists per role on sensitive pages.
38. Add audit trail viewer for page mutations.
39. Add bulk page mover with link rewrite.
40. Add knowledge graph visualization data endpoint.

## Batch E — Marketplace + SDK + Onboarding (41–50)

41. Add listing review/approval workflow in marketplace.
42. Add capability compatibility checks before install.
43. Add marketplace analytics for publishers.
44. Add SDK publish helper in `apps/sdk`.
45. Add first-app template selector in `apps/first-app`.
46. Add guided onboarding checklist tied to ROADMAP phases.
47. Add role-based quickstart wizards for C-suite.
48. Add local demo data seeder for offline tours.
49. Add feature flags for staged rollout.
50. Add release notes generator from git history + ROADMAP.

---

## Implementation Rules
- Prefer mock services over external dependencies.
- Keep UI changes additive and panel-scoped.
- Every batch must have:
  - one commit,
  - one targeted verification script,
  - one in-browser or curl check.
