#!/usr/bin/env bash
# Activate the ForgeOS self-improve agent on the VPS with an API key.
# Run on VPS as: bash agents/activate-agent.sh <ANTHROPIC_API_KEY>
# The loop (agents/self-improve-loop.ts) will then use the keyed claude provider.
set -euo pipefail
KEY="${1:-}"
if [ -z "$KEY" ]; then
  echo "usage: bash activate-agent.sh <ANTHROPIC_API_KEY>"
  exit 1
fi
cd /opt/forgeos
pm2 set forgeos env.ANTHROPIC_API_KEY "$KEY"
pm2 restart forgeos
echo "Agent activated: forgeos loop will use claude-keyed provider."
