# Stage 3 — First App

**Time target:** < 20 minutes

## Goals

Run an existing app or publish a new skill to the marketplace.

## Option A — Run an App

### LifeOS (calendar + routines)
```bash
cd apps/lifeos
npm install
npm start   # → http://localhost:3001
```

### Pool League (scoring)
```bash
cd apps/poolleague
npm install
npm run dev # → http://localhost:3000
```

## Option B — Write a Skill

1. Copy the template:
   ```bash
   cp agents/templates/agent-template.md agents/<slug>.agent.md
   ```
2. Create the runtime spec:
   ```bash
   mkdir -p agents/skills/forgeos/<slug>
   # Edit agents/skills/forgeos/<slug>/SKILL.md
   ```
3. Register in `agents/README.md` and `server.ts` `ROLE_SLUGS`.

## Option C — Publish to Marketplace

1. Create listing directory:
   ```bash
   mkdir -p marketplace/listings/my-capability
   ```
2. Write `manifest.json` (see `docs/developers/marketplace.md`).
3. Commit and push:
   ```bash
   git add marketplace/listings/my-capability/
   git commit -m "feat(marketplace): publish my-capability"
   git push origin master
   ```
4. Verify:
   ```bash
   curl -s http://127.0.0.1:7777/api/marketplace | jq
   ```

## Verification

- App loads in browser without console errors.
- OR skill appears in `GET /api/roles` if exposed.
- OR listing appears in marketplace API.
