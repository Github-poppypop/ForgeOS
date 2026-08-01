#!/usr/bin/env bash
# worktree-complete.sh — Finalize a worktree session: test, commit, push, PR, auto-merge.
#
# This is the "feature complete" trigger. Run it from inside a worktree when your
# work is ready for review. It will:
#   1. Run pre-flight checks (typecheck, lint, test)
#   2. Commit any uncommitted changes
#   3. Push to remote
#   4. Create/update PR with auto-merge
#
# Usage:
#   scripts/worktree-complete.sh                           # interactive
#   scripts/worktree-complete.sh --title "feat: add auth"  # with PR title
#   scripts/worktree-complete.sh --draft                   # create draft PR
#   scripts/worktree-complete.sh --no-merge                # skip auto-merge
#
# Environment:
#   GIT_REMOTE        Remote name (default: origin)
#   BASE_BRANCH       Base branch (default: main)
#   GITHUB_REPO       GitHub repo (default: auto-detect from remote URL)

set -euo pipefail

REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "FATAL: not inside a git repo" >&2; exit 1
}
cd "$REPO_DIR"

REMOTE="${GIT_REMOTE:-origin}"
BASE_BRANCH="${BASE_BRANCH:-main}"
AUTO_MERGE=1
DRAFT=0
PR_TITLE=""
PR_BODY=""
LABELS="auto-pr"

while [ $# -gt 0 ]; do
  case "$1" in
    --title) PR_TITLE="$2"; shift 2 ;;
    --body) PR_BODY="$2"; shift 2 ;;
    --draft) DRAFT=1; shift ;;
    --no-merge) AUTO_MERGE=0; shift ;;
    --remote) REMOTE="$2"; shift 2 ;;
    --base) BASE_BRANCH="$2"; shift 2 ;;
    --help|-h)
      cat <<USAGE
Usage: $(basename "$0") [OPTIONS]

Options:
  --title TITLE       PR title (default: last commit message)
  --body BODY         PR body (default: auto-generated)
  --draft             Create as draft PR
  --no-merge          Disable auto-merge
  --remote REMOTE     Git remote (default: origin)
  --base BRANCH       Base branch (default: main)
  --help              Show this help

This script assumes you are in a worktree created by worktree-session.sh.
USAGE
      exit 0
      ;;
    *) shift ;;
  esac
done

# Detect if we're in a worktree
IS_WORKTREE=0
if git rev-parse --git-common-dir >/dev/null 2>&1; then
  COMMON_DIR="$(git rev-parse --git-common-dir)"
  if [ -n "$COMMON_DIR" ] && [ "$COMMON_DIR" != "$REPO_DIR/.git" ]; then
    IS_WORKTREE=1
  fi
fi

# Get current branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -z "$CURRENT_BRANCH" ]; then
  echo "ERROR: Not on a named branch" >&2
  exit 1
fi

# Verify we're not on main/master
if [[ "$CURRENT_BRANCH" =~ ^(main|master)$ ]]; then
  echo "ERROR: Cannot complete session on main/master branch" >&2
  echo "Create a worktree first: scripts/worktree-session.sh --branch feat/..." >&2
  exit 1
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           🏁 Completing Worktree Session                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Branch:    $CURRENT_BRANCH"
echo "  Base:      $REMOTE/$BASE_BRANCH"
echo "  Worktree:  $(pwd)"
echo "  In worktree: $IS_WORKTREE"
echo ""

# Pre-flight checks
echo "==> Running pre-flight checks..."
if ! npm run typecheck >/dev/null 2>&1; then
  echo "ERROR: TypeScript typecheck failed" >&2
  npm run typecheck
  exit 1
fi
echo "  ✓ typecheck"

if ! npm run lint >/dev/null 2>&1; then
  echo "ERROR: Lint failed" >&2
  npm run lint
  exit 1
fi
echo "  ✓ lint"

if ! npm run test >/dev/null 2>&1; then
  echo "ERROR: Tests failed" >&2
  npm run test
  exit 1
fi
echo "  ✓ test"
echo ""

# Commit uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "==> Committing changes..."
  git add -A
  COMMIT_MSG=$(git log -1 --format=%s 2>/dev/null || echo "wip")
  git commit -m "$COMMIT_MSG" || {
    echo "ERROR: Commit failed" >&2
    exit 1
  }
  echo "  ✓ committed: $COMMIT_MSG"
else
  echo "==> No uncommitted changes"
fi

# Push to remote
echo "==> Pushing to $REMOTE..."
git push -u "$REMOTE" "$CURRENT_BRANCH" || {
  echo "ERROR: Push failed" >&2
  exit 1
}
echo "  ✓ pushed"
echo ""

# PR management
echo "==> Managing PR..."

# Detect GitHub repo from remote URL
GITHUB_REPO="${GITHUB_REPO:-}"
if [ -z "$GITHUB_REPO" ]; then
  REMOTE_URL=$(git remote get-url "$REMOTE" 2>/dev/null || git remote get-url origin)
  if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+/[^/]+)(\.git)?$ ]]; then
    GITHUB_REPO="${BASH_REMATCH[1]}"
    GITHUB_REPO="${GITHUB_REPO%.git}"
  else
    GITHUB_REPO="Github-poppypop/RealtyIQ.io"
  fi
fi

# Check for existing PR
EXISTING_PR=$(gh pr list --repo "$GITHUB_REPO" --head "$CURRENT_BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || echo "")

if [ -n "$EXISTING_PR" ]; then
  echo "  ℹ Existing PR #$EXISTING_PR found, updating..."
  PR_NUM="$EXISTING_PR"
else
  # Generate PR title/body
  if [ -z "$PR_TITLE" ]; then
    PR_TITLE=$(git log -1 --format=%s)
  fi

  if [ -z "$PR_BODY" ]; then
    PR_BODY="## Summary
Work completed in worktree session.

Branch: \`$CURRENT_BRANCH\`

## Changes
$(git log "$REMOTE/$BASE_BRANCH"..HEAD --oneline | sed 's/^/- /')

## Test Plan
- [x] TypeScript typecheck
- [x] ESLint
- [x] Vitest

Generated by: \`scripts/worktree-complete.sh\`"
  fi

  # Create PR
  echo "  ℹ Creating PR..."
  if [ "$DRAFT" -eq 1 ]; then
    gh pr create \
      --repo "$GITHUB_REPO" \
      --base "$BASE_BRANCH" \
      --title "$PR_TITLE" \
      --body "$PR_BODY" \
      --draft \
      --label "$LABELS" || {
        echo "ERROR: PR creation failed" >&2
        exit 1
      }
  else
    gh pr create \
      --repo "$GITHUB_REPO" \
      --base "$BASE_BRANCH" \
      --title "$PR_TITLE" \
      --body "$PR_BODY" \
      --label "$LABELS" || {
        echo "ERROR: PR creation failed" >&2
        exit 1
      }
  fi

  PR_NUM=$(gh pr list --repo "$GITHUB_REPO" --head "$CURRENT_BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || echo "unknown")
fi

# Enable auto-merge
if [ "$AUTO_MERGE" -eq 1 ] && [ "$DRAFT" -eq 0 ]; then
  echo "  ℹ Enabling auto-merge..."
  gh pr merge --auto --squash "$PR_NUM" 2>/dev/null || echo "  ⚠ Auto-merge enable failed (may need manual approval)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  🎉 Session Complete                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Branch: $CURRENT_BRANCH"
echo "  PR:     #$PR_NUM"
echo "  URL:    $(gh pr view "$PR_NUM" --repo "$GITHUB_REPO" --json url -q .url 2>/dev/null || echo 'unknown')"
echo ""
echo "  Next: CI will run tests. If green, PR auto-merges to $BASE_BRANCH."
echo ""
