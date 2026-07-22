# ForgeOS Brain Console — Deploy (49)

The console is a single Bun process that serves both the SPA and the REST API
wrapping the isolated gbrain at `C:\ForgeOS`.

## Run locally
```bash
bash start.sh
# → http://127.0.0.1:7777
```

## Production
- The process owns the PGLite brain exclusively; do NOT run a separate
  `gbrain serve` against the same `GBRAIN_HOME` (single-writer lock).
- Set `CONSOLE_TOKEN` to enable the auth gate (41) — requests must send
  `Authorization: Bearer <token>`.
- Set `RATE_PER_MIN` to tune the rate limit (42, default 120).
- Reverse proxy (nginx/caddy) in front for TLS + static caching:
  ```
  location / { proxy_pass http://127.0.0.1:7777; }
  ```
- The brain data lives at `C:\ForgeOS\.gbrain\brain.pglite`; back it up with
  `POST /api/backup` (44) or zip the directory.

## Env (must be set)
- GBRAIN_HOME=C:\ForgeOS
- OLLAMA_BASE_URL=http://localhost:11434/v1
- GBRAIN_EMBEDDING_DIMENSIONS=1024
- DATABASE_URL unset (host Postgres pool breaks PGLite)
