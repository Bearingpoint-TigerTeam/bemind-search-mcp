#!/usr/bin/env bash
# Run the MCP server locally with watch mode.
set -euo pipefail
cd "$(dirname "$0")/.."
bun --watch src/server.ts
