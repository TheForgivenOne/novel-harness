#!/usr/bin/env bash
# Install novel-harness from this checkout: bun install, link `novel` globally,
# and verify. Idempotent — safe to re-run after a `git pull`.
#
#   bash scripts/install.sh
#
# Undo with:  bun unlink   (from the repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is not installed. See https://bun.sh (requires Bun >= 1.1)." >&2
  exit 1
fi

echo "Installing dependencies..."
bun install

echo "Linking \`novel\` globally (bun link)..."
bun link

echo "Verifying..."
bun run typecheck
bun test ./tests >/dev/null
novel --version
novel --help >/dev/null

echo
echo "Installed. \`novel\` is on your PATH via bun's global bin."
echo "Undo with: bun unlink   (in $ROOT)"
