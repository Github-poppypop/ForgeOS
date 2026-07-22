#!/usr/bin/env bash
# ForgeOS Brain Console launcher
# The console owns the isolated PGLite brain (C:\ForgeOS) exclusively — no
# separate gbrain server needed. Serializes CLI calls to avoid lock contention.
set -euo pipefail
export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"
export GBRAIN_HOME="C:\\ForgeOS"
export OLLAMA_BASE_URL="http://localhost:11434/v1"
export GBRAIN_EMBEDDING_DIMENSIONS=1024
unset DATABASE_URL
cd /c/Projects/ForgeOS/apps/brain-console
PORT=7777 bun run server.ts
