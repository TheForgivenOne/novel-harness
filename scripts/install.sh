#!/usr/bin/env sh
# novel-harness installer.
#
#   curl -fsSL https://raw.githubusercontent.com/TheForgivenOne/novel-harness/main/scripts/install.sh | sh
#
# Installs the standalone `novel` binary into a bin directory on your PATH.
#
#   1. If a published release has a prebuilt binary for your platform, download it.
#   2. Otherwise (no release yet, or no asset for your platform), build it from
#      source with Bun and install the result. Needs git + Bun >= 1.1.
#
# Environment:
#   NOVEL_VERSION       release tag to install (default: latest; e.g. v0.1.0)
#   NOVEL_HARNESS_BIN   install directory (default: ~/.local/bin)
#   NOVEL_SKIP_BUILD    set to 1 to fail instead of falling back to a source build
set -eu

REPO="TheForgivenOne/novel-harness"
REF="${NOVEL_HARNESS_REF:-main}"
VERSION="${NOVEL_VERSION:-latest}"
BIN_DIR="${NOVEL_HARNESS_BIN:-${NOVEL_INSTALL_DIR:-$HOME/.local/bin}}"

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Linux)  platform="linux" ;;
  Darwin) platform="darwin" ;;
  *) warn "unknown OS: $os" ;;
esac

case "$arch" in
  x86_64|amd64)  arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) warn "unknown architecture: $arch" ;;
esac

asset="novel-${platform:-unknown}-${arch:-unknown}"

if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  download() { wget -qO "$2" "$1"; }
else
  download() { return 1; }
fi

mkdir -p "$BIN_DIR"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

installed=0

# --- 1. prebuilt release -----------------------------------------------------
if [ -n "${platform:-}" ] && [ -n "${arch:-}" ]; then
  if [ "$VERSION" = "latest" ]; then
    url="https://github.com/$REPO/releases/latest/download/$asset"
  else
    url="https://github.com/$REPO/releases/download/$VERSION/$asset"
  fi
  say "Looking for a prebuilt binary: $asset (${VERSION})"
  if download "$url" "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
    installed=1
    say "Downloaded prebuilt binary."
  else
    say "No prebuilt binary available."
  fi
fi

# --- 2. build from source ----------------------------------------------------
if [ "$installed" -eq 0 ]; then
  if [ "${NOVEL_SKIP_BUILD:-0}" = "1" ]; then
    die "no prebuilt binary, and NOVEL_SKIP_BUILD=1"
  fi
  command -v bun >/dev/null 2>&1 || die "need Bun >= 1.1 to build from source (see https://bun.sh), or wait for a release"
  command -v git >/dev/null 2>&1 || die "need git to build from source"

  src="${NOVEL_HARNESS_SRC:-${TMPDIR:-/tmp}/novel-harness-src}"
  say "Building from source ($REF) with Bun..."
  rm -rf "$src"
  git clone --quiet --depth 1 --branch "$REF" "https://github.com/$REPO.git" "$src"
  (cd "$src" && bun install --frozen-lockfile >/dev/null && bun build --compile --minify ./bin/novel.ts --outfile "$tmp")
  installed=1
fi

# --- install -----------------------------------------------------------------
if [ "$installed" -ne 1 ] || [ ! -s "$tmp" ]; then
  die "nothing was installed"
fi

chmod +x "$tmp" 2>/dev/null || true
mv "$tmp" "$BIN_DIR/novel"
trap - EXIT

"$BIN_DIR/novel" --version >/dev/null 2>&1 || die "installed $BIN_DIR/novel failed to run"

say "Installed to $BIN_DIR/novel"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    say ""
    say "note: $BIN_DIR is not on your PATH. Add it:"
    say "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc && exec \$SHELL"
    ;;
esac

say ""
say "Run: novel init my-novel --name \"My Novel\" --author human:you"
say "Uninstall: rm $BIN_DIR/novel"
