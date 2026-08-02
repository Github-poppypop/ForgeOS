#!/usr/bin/env bash
# farm.sh — bootstrap the ForgeOS VPS tmux agent farm.
# Run ON THE VPS (not this Windows host). Requires: tmux, hermes CLI installed.
# Spins up N detached hermes sessions, one per concern, ready for brief injection.
set -uo pipefail
N="${1:-10}"
BASE="forgeos-farm"
echo "[farm] booting $N agents in tmux..."

for i in $(seq 1 "$N"); do
  SESSION="${BASE}-${i}"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "[farm] $SESSION already exists — skipping"
    continue
  fi
  tmux new-session -d -s "$SESSION" "hermes chat -q"
  sleep 0.3
  echo "[farm] $SESSION ready"
done

echo "[farm] listing:"
tmux list-sessions | grep "^${BASE}-"

echo "[farm] to inject a brief: tmux send-keys -t ${BASE}-1 'your brief here' Enter"
echo "[farm] to read progress:  tmux capture-pane -t ${BASE}-1 -p"
