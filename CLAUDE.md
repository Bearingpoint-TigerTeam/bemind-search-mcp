# CLAUDE.md

## Project Overview

**bemind-search-mcp** is a BearingPoint MCP (Model Context Protocol) server that provides:
- Azure AI Search integration (SAP knowledge bases)
- SAP system integration (ABAP source, ATC checks, table reads)
- SAP AI Core Document Grounding (help search)
- Microsoft Graph API (email, calendar)
- Office document tools (Excel, Word, PDF, PowerPoint)

## Build Commands

```bash
bun install                 # Install dependencies
bun run src/server.ts       # Run server (stdio)
bun test                    # Run tests
bunx tsc --noEmit           # Type-check
bun build --compile src/server.ts --outfile dist/bemind-search-mcp  # Build binary
bash scripts/build-all.sh   # Build all platform binaries
```

## Architecture

- **src/server.ts** — MCP server bootstrap, tool registration
- **src/config.ts** — Zod-validated env var loading
- **src/logging.ts** — Stderr-only logger (MCP stdio requirement)
- **src/tools/** — Tool implementations (one file per domain)
- **src/util/** — Shared helpers (tokens, timezone)
- **test/** — Unit and integration tests

## Key Conventions

- Use Bun, not Node.js
- All logs to stderr (stdout is JSON-RPC only)
- Tools conditionally registered based on available config
- Office tools are always available
