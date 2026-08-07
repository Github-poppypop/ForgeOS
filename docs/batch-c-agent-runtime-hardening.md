# Batch C — Agent Runtime Hardening (21–30)

21. Add retry/backoff wrapper for gbrain CLI spawns.
22. Add circuit breaker for repeated gbrain failures.
23. Add agent sandbox policy enforcement in `agents/guardrails.ts`.
24. Add structured agent output schema validation.
25. Add agent memory cache with TTL eviction.
26. Add dead-letter queue for failed agent tasks.
27. Add agent cost/token accounting per role.
28. Add agent A/B routing for canary prompts.
29. Add graceful degradation when Ollama is offline.
30. Add agent runbook auto-selection by mission type.
