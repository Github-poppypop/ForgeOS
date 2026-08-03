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

mkdir -p /opt/forgeos/agents/logs /opt/forgeos/agents/briefs

PROMPT="Execute brief from /opt/forgeos/agents/briefs/brief-${AGENT_NUM}.md for mission ${MISSION_ID}"
LOG="/opt/forgeos/agents/logs/agent-${AGENT_NUM}.log"

# Ensure clean session
tmux kill-session -t "agent-${AGENT_NUM}" 2>/dev/null || true

# Run hermes with forge profile in detached tmux session
# Use a wrapper script to avoid quoting hell
WRAPPER="/tmp/agent-wrapper-${AGENT_NUM}.sh"
cat > "$WRAPPER" << INNEREOF
#!/bin/bash
cd /opt/forgeos
/usr/local/bin/hermes --profile forge -z "$1" > "$2" 2>&1
INNEREOF
chmod +x "$WRAPPER"

tmux new-session -d -s "agent-${AGENT_NUM}" "$WRAPPER '${PROMPT}' '${LOG}'"

# Wait for tmux session to finish
while tmux has-session -t "agent-${AGENT_NUM}" 2>/dev/null; do
    sleep 2
done

rm -f "$WRAPPER"
echo "Agent ${AGENT_NUM} finished for mission ${MISSION_ID}"
