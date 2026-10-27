#!/usr/bin/env bash
# Merge a finished ticket branch into the integration branch, verifying the
# result. Rolls the merge back if anything fails.
# Usage: scripts/merge-ticket.sh ticket/02-create-event
set -euo pipefail

branch="${1:?usage: merge-ticket.sh <branch>}"
integration="${INTEGRATION_BRANCH:-feat/live-contest}"
root="$(git rev-parse --show-toplevel)"

cd "$root"
current="$(git branch --show-current)"
if [ "$current" != "$integration" ]; then
  echo "Switch to $integration before merging (currently on $current)." >&2
  exit 1
fi

git merge --no-ff "$branch" -m "Merge $branch into $integration"

if npm test && npm run typecheck && npm run build; then
  echo "Merged $branch and verified."
else
  echo "Verification failed; rolling back the merge." >&2
  git reset --hard HEAD~1
  exit 1
fi
