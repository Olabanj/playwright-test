#!/bin/sh
# Install feature-first e2e git hooks into the repo's hooks dir.
# Idempotent; only touches pre-commit (leaves post-commit / post-checkout alone).
# Run from the repo root:  npm run hooks:install
#
# Uses `git rev-parse --git-path hooks` so it resolves correctly both in a normal
# checkout (.git/hooks) and in a linked worktree (shared common-dir hooks).
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$(git rev-parse --git-path hooks)"

mkdir -p "$DEST"
cp "$HERE/pre-commit" "$DEST/pre-commit"
chmod +x "$DEST/pre-commit"

echo "[hooks] installed pre-commit -> $DEST/pre-commit"
echo "[hooks] gates: G2 tsc --noEmit + architecture lint:arch (on staged *.ts outside archive/)"
