#!/usr/bin/env bash
# Create an isolated worktree for a ticket and get it ready to run tests.
# Usage: scripts/new-worktree.sh 03-author-a-problem
set -euo pipefail

slug="${1:?usage: new-worktree.sh <ticket-slug>}"
root="$(git rev-parse --show-toplevel)"
worktree_root="$(dirname "$root")/code-feast-wt"
dir="$worktree_root/$slug"
branch="ticket/$slug"

mkdir -p "$worktree_root"

if [ -d "$dir" ]; then
  echo "Worktree already exists: $dir" >&2
  exit 1
fi

git worktree add -b "$branch" "$dir" feat/live-contest
cp "$root/.env.local" "$dir/.env.local"

cd "$dir"
npm ci --silent
npm run db:test:setup

echo "Ready: $dir on $branch"
