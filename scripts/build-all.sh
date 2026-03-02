#!/usr/bin/env bash
# Build single-file binaries for all platforms via Bun cross-compile.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

mkdir -p dist

echo "Building bemind-search-mcp for all platforms..."

targets=(
  "bun-linux-x64:bemind-search-mcp-linux-x64"
  "bun-linux-arm64:bemind-search-mcp-linux-arm64"
  "bun-linux-x64-musl:bemind-search-mcp-linux-x64-musl"
  "bun-windows-x64:bemind-search-mcp-windows-x64.exe"
  "bun-darwin-arm64:bemind-search-mcp-darwin-arm64"
  "bun-darwin-x64:bemind-search-mcp-darwin-x64"
)

for entry in "${targets[@]}"; do
  target="${entry%%:*}"
  outfile="${entry##*:}"
  echo "  → $target → dist/$outfile"
  bun build --compile --target="$target" src/server.ts --outfile "dist/$outfile"
done

echo ""
echo "Build complete. Binaries:"
ls -lh dist/
