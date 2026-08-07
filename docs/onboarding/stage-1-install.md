# Stage 1 — Install

**Time target:** < 10 minutes

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Git | latest | `git --version` |
| Bun | 1.x | `bun --version` |
| Ollama | latest | `ollama --version` |
| Node | 18+ | `node --version` |

## Steps

1. Clone the repo:
   ```bash
   git clone https://github.com/forgeos/forgeos.git && cd forgeos
   ```
2. Set brain environment:
   ```bash
   export GBRAIN_HOME="C:\\ForgeOS"
   export GBRAIN_CWD="C:\\Users\\pop\\forge-gbrain"
   unset DATABASE_URL
   ```
3. Pull the embedding model:
   ```bash
   ollama pull mxbai-embed-large
   ```
4. Start the console:
   ```bash
   cd apps/brain-console
   bun run server.ts
   ```
5. Open `http://127.0.0.1:7777`.

## Troubleshooting

- `DATABASE_URL` breaks PGLite — must be unset.
- Use native `C:\\...` paths, not `/c/...` (MSYS breaks PGLite).
- `bun build` does not work on this MSYS host; serve plain JS.

## Verification

```bash
curl -s http://127.0.0.1:7777/api/health
# Expected: {"status":"ok",...}
```
