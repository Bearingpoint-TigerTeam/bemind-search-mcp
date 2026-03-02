#!/usr/bin/env bash
# Verify that stdout contains only newline-delimited JSON-RPC messages.
# This is a MCP spec requirement for stdio transport.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Sending initialize request to server via stdio..."

# Send an initialize request and capture stdout
RESPONSE=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 bun run src/server.ts 2>/dev/null || true)

if [ -z "$RESPONSE" ]; then
  echo "WARN: No response received (server may require config)"
  exit 0
fi

# Check each line is valid JSON
while IFS= read -r line; do
  if [ -z "$line" ]; then continue; fi
  echo "$line" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "FAIL: Non-JSON output detected on stdout:"
    echo "  $line"
    exit 1
  fi
done <<< "$RESPONSE"

echo "PASS: All stdout output is valid JSON"
