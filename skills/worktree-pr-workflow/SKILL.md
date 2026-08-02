---
name: worktree-pr-workflow
description: Use when setting up a new Hermes profile or repo for per-session worktrees with automatic PR creation and CI/CD enforcement. Ports the RealtyIQ.io workflow to any Git repo.
---

# Worktree + PR Workflow Skill

Use when:
- Setting up a new Hermes profile for a project
- Porting the RealtyIQ.io workflow to another repo
- Enforcing "never push to main directly" across profiles
- Automating PR creation from per-session worktrees

## What This Provides

1. **Per-session worktree creation** — `scripts/worktree-session.sh`
2. **Session finalization** — `scripts/worktree-complete.sh`
3. **Git hooks** — `.githooks/pre-push` blocks direct pushes to main
4. **Hermes context** — `.hermes.md` injects workflow rules into every session
5. **CI/CD portability** — templates for `.github/workflows/pr-check.yml`

## Setup: New Repo

Run these steps in the target repo:

```bash
# 1. Copy workflow files
cp scripts/worktree-session.sh <target-repo>/scripts/
cp scripts/worktree-complete.sh <target-repo>/scripts/
cp .githooks/pre-push <target-repo>/.githooks/
cp .hermes.md <target-repo>/

# 2. Enable hooks
cd <target-repo>
git config core.hooksPath .githooks

# 3. Make scripts executable
chmod +x scripts/worktree-session.sh scripts/worktree-complete.sh

# 4. Commit
git add scripts/worktree-session.sh scripts/worktree-complete.sh .githooks .hermes.md
git commit -m "chore: add worktree-pr workflow"
```

## Setup: New Hermes Profile

To make another Hermes profile use this workflow:

```bash
# 1. Install the skill into the profile's skills directory
cp -r ~/.claude/skills/worktree-pr-workflow \
      ~/AppData/Local/hermes/profiles/<profile>/skills/

# 2. Add to profile config
# In config.yaml, ensure the skill is loaded for relevant projects
```

## Daily Usage

### Starting a Session

```bash
# From canonical repo checkout
scripts/worktree-session.sh --branch feat/my-feature

# With auto-PR on completion
scripts/worktree-session.sh --branch feat/my-feature --pr --merge
```

### Completing a Session

```bash
# From inside a worktree
scripts/worktree-complete.sh --title "feat: my feature"

# Draft PR
scripts/worktree-complete.sh --draft

# Skip auto-merge
scripts/worktree-complete.sh --no-merge
```

## Enforcement Rules

These are enforced at multiple layers:

1. **Git hooks** — `.githooks/pre-push` blocks `git push origin main`
2. **Hermes context** — `.hermes.md` injects rules into every session
3. **Scripts** — `worktree-session.sh` validates branch naming
4. **CI/CD** — `.github/workflows/pr-check.yml` gates PRs

## Branch Naming

Required format:
```
feat/description
fix/description
test/description
chore/description
```

Examples:
- `feat/add-user-auth`
- `fix/login-redirect`
- `test/coverage-gate`
- `chore/update-deps`

## CI/CD Portability

To port the CI/CD workflow to another repo:

1. Copy `.github/workflows/pr-check.yml`
2. Update `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` if needed
3. Update `node-version` in setup-node steps
4. Adjust `changes` detection paths if repo structure differs
5. Configure branch protection rules in GitHub:
   - Require PR reviews
   - Require status checks
   - Require branches up to date
   - Restrict pushes to main

## Customization

### Change Base Branch

```bash
BASE_BRANCH=develop scripts/worktree-session.sh --branch feat/my-feature
```

### Change Remote

```bash
GIT_REMOTE=upstream scripts/worktree-session.sh --branch feat/my-feature
```

### Adjust Pre-flight Checks

Edit `scripts/worktree-complete.sh` to add/remove checks:
```bash
# Add coverage check
npm run test:coverage

# Add E2E check
npm run test:e2e
```

## Troubleshooting

**"Worktree already exists"**
```bash
git worktree remove .worktrees/feat_my-feature
```

**"Branch already exists"**
```bash
git branch -d feat/my-feature          # local
git push origin --delete feat/my-feature  # remote
```

**"Push rejected"**
```bash
git pull --rebase origin main
git push origin feat/my-feature
```

## Related Files

- `scripts/worktree-session.sh` — worktree creation
- `scripts/worktree-complete.sh` — session finalization
- `.githooks/pre-push` — main protection hook
- `.hermes.md` — Hermes session context
- `CLAUDE.md` — project-specific rules
- `.github/workflows/pr-check.yml` — CI gates
