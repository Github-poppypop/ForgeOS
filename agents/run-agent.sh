#!/bin/bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin"
export TMUX_TMPDIR="/opt/forgeos/.tmux"

AGENT_NUM="${1:?Usage: $0 AGENT_NUM MISSION_ID}"
MISSION_ID="${2:?Usage: $0 AGENT_NUM MISSION_ID}"

if [[ "$AGENT_NUM" -lt 1 || "$AGENT_NUM" -gt 10 ]]; then
    echo "Error: AGENT_NUM must be between 1 and 10" >&2
    exit 1
fi

mkdir -p /opt/forgeos/agents/logs

PROMPT="Execute brief from /opt/forgeos/agents/briefs/brief-${AGENT_NUM}.md for mission ${MISSION_ID}"
LOG="/opt/forgeos/agents/logs/agent-${AGENT_NUM}.log"

# Ensure clean session
tmux kill-session -t "agent-${AGENT_NUM}" 2>/dev/null || true

# Create detached tmux session and run hermes
tmux new-session -d -s "agent-${AGENT_NUM}" "/usr/local/bin/hermes -z '${PROMPT}' >> '${LOG}' 2>&1"

# Wait for tmux session to finish (hermes to exit)
while tmux has-session -t "agent-${AGENT_NUM}" 2>/dev/null; do
    sleep 2
done

echo "Agent ${AGENT_NUM} finished for mission ${MISSION_ID}"
