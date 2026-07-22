#!/usr/bin/env bash
# ForgeOS Brain Console — daemon launcher
# Starts the console DETACHED so it survives the spawning shell closing
# (the root cause of repeated ERR_CONNECTION_REFUSED).
set -euo pipefail

export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"
export GBRAIN_HOME="C:\\ForgeOS"
export GBRAIN_CWD="C:\\Users\\pop\\forge-gbrain"
export OLLAMA_BASE_URL="http://localhost:11434/v1"
export GBRAIN_EMBEDDING_DIMENSIONS=1024
unset DATABASE_URL

DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/.console.log"
PIDF="$DIR/.console.pid"
PORT="${PORT:-7777}"

is_up() { curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/status" >/dev/null 2>&1; }

case "${1:-start}" in
  start)
    if is_up; then echo "already up on :$PORT"; exit 0; fi
    # kill any stale listener on the port first (clean restart)
    OLD=$(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | head -1)
    [ -n "$OLD" ] && taskkill /PID "$OLD" /F >/dev/null 2>&1 || true
    sleep 1
    cd "$DIR"
    # setsid + nohup => fully detached from this shell
    setsid bash -c "PORT=$PORT bun run server.ts > '$LOG' 2>&1" </dev/null &
    echo $! > "$PIDF"
    # wait for readiness
    for i in $(seq 1 20); do
      if is_up; then echo "up on http://localhost:$PORT (pid $(cat "$PIDF"))"; exit 0; fi
      sleep 1
    done
    echo "FAILED to start — tail of log:"; tail -20 "$LOG"; exit 1
    ;;
  stop)
    if [ -f "$PIDF" ]; then kill "$(cat "$PIDF")" 2>/dev/null || true; rm -f "$PIDF"; fi
    OLD=$(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | head -1)
    [ -n "$OLD" ] && taskkill /PID "$OLD" /F >/dev/null 2>&1 || true
    echo "stopped"
    ;;
  restart) "$0" stop; sleep 1; "$0" start ;;
  status)
    if is_up; then echo "UP on :$PORT"; else echo "DOWN"; fi
    [ -f "$PIDF" ] && echo "pidfile: $(cat "$PIDF")"
    ;;
  logs) tail -40 "$LOG" ;;
  *) echo "usage: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
