# Stage 2 — First Brain

**Time target:** < 15 minutes

## Goals

- Seed at least one C-suite role
- Capture at least one brain page
- Run a semantic search
- Record one decision

## Steps

1. **Seed roles**
   ```bash
   curl -s -X POST http://127.0.0.1:7777/api/seed-roles | jq
   ```
   Expected: array of 7 roles.

2. **Capture a page**
   ```bash
   curl -s -X POST http://127.0.0.1:7777/api/capture \
     -H "Content-Type: application/json" \
     -d '{"slug":"welcome","markdown":"# Welcome\n\nThis is my first brain page."}' | jq
   ```

3. **Search the page**
   ```bash
   curl -s "http://127.0.0.1:7777/api/search?q=welcome" | jq
   ```

4. **Record a decision**
   ```bash
   curl -s -X POST http://127.0.0.1:7777/api/decision \
     -H "Content-Type: application/json" \
     -d '{"title":"First decision","body":"I chose ForgeOS."}' | jq
   ```

## UI Walkthrough

- Open `http://127.0.0.1:7777/#/capture` → create a page via the form.
- Open `#/search` → confirm the page is searchable.
- Open `#/decisions` → see the new decision entry.

## Verification

```bash
curl -s http://127.0.0.1:7777/api/status | jq '.gbrain_health'
# Expected: {"status":"ok",...}
```
