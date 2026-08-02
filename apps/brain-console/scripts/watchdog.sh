#!/usr/bin/env bash
# watchdog.sh — non-agent health check for the ForgeOS Brain Console.
# Runs silently via cron (no_agent=true). Emits output ONLY on a real problem,
# so the cron delivery stays quiet when everything is healthy.
# Exit 0 = healthy (no alert). Exit 1 = problem (alert text on stdout).
set -uo pipefail

PORT="${PORT:-7777}"
BASE="http://127.0.0.1:$PORT"
LOGOK=0; MSG=""

# 1) is the port listening?
if ! curl -fsS --max-time 4 "$BASE/api/status" >/tmp/.forge_wd_status 2>/dev/null; then
  # server down — try to bring it back up via the scheduled task
  MSG="SERVER DOWN on :$PORT — attempting restart via ForgeOSBrainConsole task"
  schtasks //Run //TN ForgeOSBrainConsole >/dev/null 2>&1 || true
  sleep 4
  if curl -fsS --max-time 4 "$BASE/api/status" >/dev/null 2>&1; then
    echo "RECOVERED: server back up on :$PORT after task restart"; exit 0
  fi
  echo "$MSG"; exit 1
fi

# 2) gbrain healthy?
if ! grep -q '"status":"ok"' /tmp/.forge_wd_status 2>/dev/null; then
  MSG="gbrain unhealthy: $(head -c 200 /tmp/.forge_wd_status)"; echo "$MSG"; exit 1
fi

# 3) SPA served + correct size (34,416 bytes expected for current app.js)?
BYTES=$(curl -s --max-time 4 "$BASE/src/app.js" | wc -c)
if [ "${BYTES:-0}" -lt 40000 ]; then
  MSG="SPA app.js served size suspicious: ${BYTES} bytes (expected ~50454)"; echo "$MSG"; exit 1
fi

# 4) any REAL blocker recorded in the todo ledger? (match only actual "- [BLOCKER]" lines,
#    not the format-comment that mentions the word BLOCKER)
if [ -f .forgeos-todo.md ] && grep -qE '^- \[BLOCKER\]' .forgeos-todo.md; then
  MSG="BLOCKER recorded in .forgeos-todo.md:"; echo "$MSG"; grep -E '^- \[BLOCKER\]' .forgeos-todo.md; exit 1
fi

# healthy — stay silent
exit 0
