#!/usr/bin/env bash
# Build a standalone `novel` binary for a target triple with `bun build --compile`.
#
#   bash scripts/build.sh                                  # host target
#   bash scripts/build.sh bun-linux-x64                    # cross-compile
#   bash scripts/build.sh bun-darwin-arm64 dist/novel-mac  # custom outfile
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"
OUT="${2:-dist/novel}"

mkdir -p "$(dirname "$OUT")"

args=(bun build --compile --minify ./bin/novel.ts --outfile "$OUT")
if [ -n "$TARGET" ]; then
  args=(bun build --compile --minify --target="$TARGET" ./bin/novel.ts --outfile "$OUT")
fi

echo "Compiling ${TARGET:-host} -> $OUT"
"${args[@]}"

"$OUT" --version
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
