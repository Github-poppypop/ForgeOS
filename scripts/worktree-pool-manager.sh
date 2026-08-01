#!/bin/bash
# worktree-pool-manager.sh — Pre-warm a pool of git worktrees so dispatched
# jobs can adopt one instantly instead of waiting ~30-60s for `git worktree add`.
#
# Each pool slot is a detached-HEAD worktree at origin/main with node_modules
# symlinked. vm-task.sh adopts a slot via `git worktree move` (instant path
# rename + metadata update), then creates the feature branch with `git checkout -b`.
#
# Usage:
#   scripts/worktree-pool-manager.sh           # fill pool to POOL_SIZE
#   scripts/worktree-pool-manager.sh --status  # show current pool state
#
# Install systemd timer to keep pool topped up automatically:
#   sudo cp scripts/systemd/worktree-pool.{service,timer} /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now worktree-pool.timer
#
# vm-task.sh also triggers a background fill after each adoption so the pool
# self-heals without waiting for the next timer tick.

set -euo pipefail

REPO=/home/agent/RealtyIQ.io
POOL_DIR="$REPO/.claude/worktrees-pool"
POOL_SIZE=12
LOCK=/tmp/worktree-pool-fill.lock

if [ "${1:-}" = "--status" ]; then
  AVAIL=$(find "$POOL_DIR" -maxdepth 1 -name 'pool-[0-9]*' -type d 2>/dev/null | wc -l | tr -d ' ')
  echo "worktree-pool: $AVAIL / $POOL_SIZE slots available"
  echo "Pool dir: $POOL_DIR"
  git -C "$REPO" worktree list 2>/dev/null | grep -F "$POOL_DIR" || echo "(none registered in git)"
  exit 0
fi

# Single-instance guard — if another fill is already running, exit quietly.
exec 9>"$LOCK"
if ! flock -n 9; then
  exit 0
fi

mkdir -p "$POOL_DIR"

# Fetch latest origin/main so new slots start from current code.
# Failures are non-fatal — we fall back to the last known origin/main ref.
git -C "$REPO" fetch origin main --quiet 2>/dev/null || true
BASE_REF=$(git -C "$REPO" rev-parse origin/main 2>/dev/null || git -C "$REPO" rev-parse HEAD)

# Prune stale worktree metadata for slots that were adopted (directory moved away).
git -C "$REPO" worktree prune --expire=now 2>/dev/null || true

FILLED=0
for i in $(seq 1 "$POOL_SIZE"); do
  SLOT_NAME="pool-$(printf '%03d' "$i")"
  SLOT="$POOL_DIR/$SLOT_NAME"

  # Slot exists and HEAD is readable — healthy, skip.
  if [ -d "$SLOT" ] && git -C "$SLOT" rev-parse HEAD &>/dev/null; then
    continue
  fi

  # Directory gone but git still lists it — remove the orphaned registration.
  if git -C "$REPO" worktree list --porcelain 2>/dev/null | grep -qF "worktree $SLOT"; then
    git -C "$REPO" worktree remove --force "$SLOT" 2>/dev/null || true
  fi

  # Remove any lingering directory remnant.
  [ -d "$SLOT" ] && rm -rf "$SLOT"

  # Create detached worktree at latest origin/main.
  if git -C "$REPO" worktree add --detach "$SLOT" "$BASE_REF" --quiet 2>/dev/null; then
    # Symlink shared node_modules — npm registry is unreachable on this VM.
    ln -sf "$REPO/node_modules" "$SLOT/node_modules"
    FILLED=$((FILLED + 1))
  fi
done

AVAIL=$(find "$POOL_DIR" -maxdepth 1 -name 'pool-[0-9]*' -type d 2>/dev/null | wc -l | tr -d ' ')
echo "worktree-pool: filled $FILLED new slot(s), pool now $AVAIL / $POOL_SIZE"
