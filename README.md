# bemind-search-mcp

BeMind Search MCP Server — a [Model Context Protocol](https://modelcontextprotocol.io/) server providing Azure AI Search, SAP integration, Microsoft Graph, and Office document tools.

## Quick Start

```bash
# Run directly
bun run src/server.ts

# Or build a single-file binary
bun build --compile src/server.ts --outfile dist/bemind-search-mcp
./dist/bemind-search-mcp
```

## Tools

### SAP Integration
| Tool | Description |
|------|-------------|
| `sap_search` | Search Azure AI Search indexes for SAP knowledge |
| `list_indexes` | List available search indexes |
| `get_abap_source` | Fetch ABAP source code from SAP via OData |
| `run_abap_atc_check` | Run ATC checks on ABAP objects |
| `read_sap_table` | Read SAP tables via RFC_READ_TABLE |
| `sap_help_search` | Search SAP help via AI Core Document Grounding |

### Microsoft Graph
| Tool | Description |
|------|-------------|
| `graph_whoami` | Get current user identity |
| `graph_list_emails` | List Outlook emails |
| `graph_read_email` | Read full email content |
| `graph_send_email` | Send email via Outlook |
| `graph_list_events` | List calendar events |
| `graph_create_event` | Create calendar event |

### Office Documents
| Tool | Description |
|------|-------------|
| `read_xlsx` | Read Excel files (.xlsx, .xls, .xlsm, .xlsb, .ods) |
| `render_xlsx` | Create Excel with formulas, charts, images |
| `render_docx` | Create Word documents |
| `render_pdf` | Create PDF documents |
| `render_pptx` | Create PowerPoint presentations |

## Configuration

Set environment variables in `~/.bmind/.env` or `./.env`:

```bash
# Azure AI Search
AZURE_SEARCH_ENDPOINT="https://your-service.search.windows.net"
AZURE_SEARCH_KEY="your-key"
AZURE_SEARCH_DEFAULT_INDEX="sap"

# SAP System (optional)
SAP_HOST="sap-hostname"
SAP_USER="username"
SAP_PASSWD="password"
SAP_CLIENT="900"

# SAP AI Core (optional)
SAP_AICORE_CLIENT_ID="your-client-id"
SAP_AICORE_CLIENT_SECRET="your-client-secret"

# Microsoft Graph (optional)
AZURE_TENANT_ID="your-tenant-id"
AZURE_CLIENT_ID="your-client-id"
# Optional: set to 0 to disable device-code auth bootstrap
GRAPH_DEVICE_CODE_FLOW="1"
```

Tools are conditionally registered based on available config. Office tools are always enabled.

### Graph auth behavior (device code flow)

When Graph tools are enabled but no valid token exists:

1. First `graph_*` call returns a structured `graph_auth_required` error payload with:
   - `verification_uri`
   - `user_code`
   - `message`
2. User completes login in browser using the provided code.
3. Retry any `graph_*` tool call. The server polls once, stores tokens in `~/.bmind/.graph_token`, and proceeds automatically after authorization is complete.

This avoids long-blocking tool calls and works with interactive MCP clients like Codex CLI.

## Integration with BeMind CLI

Add to `~/.bmind/config.toml`:

```toml
[mcp_servers.bemind-search]
command = "/path/to/bemind-search-mcp"
enabled = true
startup_timeout_sec = 10.0
tool_timeout_sec = 60.0
```

## Testing with MCP Inspector

```bash
bun test                    # Unit tests
bunx @modelcontextprotocol/inspector src/server.ts  # Interactive testing
```

## Building

```bash
# Current platform
bun build --compile src/server.ts --outfile dist/bemind-search-mcp

# All platforms
bash scripts/build-all.sh
```

Cross-compile targets: Linux x64/arm64/musl, Windows x64, macOS arm64/x64.

## Transport

- **stdio** (default): JSON-RPC 2.0 over stdin/stdout. Logs to stderr only.

## Releasing

This project uses a **tag-driven release flow** with GitHub Actions. No file changes are required to cut a release.

### Versioning policy

| Tag format | Example | Release type |
|---|---|---|
| `vMAJOR.MINOR.PATCH` | `v2.1.0` | Stable — published as latest |
| `sha.<7-char-SHA>` | `sha.ab12cd3` | Snapshot — published as prerelease |

- Version is derived entirely from the git tag — `package.json` is not involved.
- Stable releases also overwrite the permanent **`latest`** release so download URLs never change.

### Release workflows

- **`release-manual`** — manually triggered, validates input and pushes a tag.
- **`release-on-tag`** — fires automatically on tag push, cross-compiles for all platforms, publishes to GitHub Releases.

### Stable release runbook

1. Push changes to `main`.
2. Go to **Actions → release-manual → Run workflow**.
3. Provide `version` input (e.g. `2.1.0`). Must be plain `X.Y.Z` semver.
4. Workflow creates tag `v2.1.0`, which triggers `release-on-tag`.
5. `release-on-tag` builds all 6 platform binaries and publishes:
   - A versioned release: `BeMind Search MCP v2.1.0`
   - Updates the permanent `latest` release with un-versioned binaries.

### Snapshot release runbook

1. Push changes to `main`.
2. Go to **Actions → release-manual → Run workflow**.
3. Leave `version` **empty**.
4. Workflow creates tag `sha.<commit-SHA>`, which triggers `release-on-tag`.
5. Published as a **prerelease** — does **not** update the `latest` release.

### Build matrix

Each release produces 6 platform binaries:

| Platform | Filename |
|---|---|
| Linux x64 | `bemind-search-mcp-linux-x64` |
| Linux ARM64 | `bemind-search-mcp-linux-arm64` |
| Linux x64 musl | `bemind-search-mcp-linux-x64-musl` |
| Windows x64 | `bemind-search-mcp-windows-x64.exe` |
| macOS ARM64 (Apple Silicon) | `bemind-search-mcp-darwin-arm64` |
| macOS x64 (Intel) | `bemind-search-mcp-darwin-x64` |

### Permanent latest download URLs

Always resolve to the most recent stable binary:

```
https://github.com/Bearingpoint-TigerTeam/bemind-search-mcp/releases/download/latest/bemind-search-mcp-linux-x64.tar.gz
https://github.com/Bearingpoint-TigerTeam/bemind-search-mcp/releases/download/latest/bemind-search-mcp-linux-arm64.tar.gz
https://github.com/Bearingpoint-TigerTeam/bemind-search-mcp/releases/download/latest/bemind-search-mcp-linux-x64-musl.tar.gz
https://github.com/Bearingpoint-TigerTeam/bemind-search-mcp/releases/download/latest/bemind-search-mcp-windows-x64.exe.zip
https://github.com/Bearingpoint-TigerTeam/bemind-search-mcp/releases/download/latest/bemind-search-mcp-darwin-arm64.tar.gz
https://github.com/Bearingpoint-TigerTeam/bemind-search-mcp/releases/download/latest/bemind-search-mcp-darwin-x64.tar.gz
```

### macOS first-run note

macOS binaries are unsigned. Remove the quarantine flag before first run:

```bash
xattr -dr com.apple.quarantine ./bemind-search-mcp-darwin-arm64
chmod +x ./bemind-search-mcp-darwin-arm64
```

### Safeguards

The `release-manual` workflow fails fast if:

- Explicit `version` is not plain semver (`X.Y.Z`).
- The resolved tag already exists on origin.
- `RELEASE_PAT` secret is missing or empty.

### Token rotation checklist (`RELEASE_PAT`)

- [ ] Create a new fine-grained PAT (scope: this repo only, **Contents: Read and write**).
- [ ] Set an expiration date (recommended: 30–90 days).
- [ ] Update repo secret: **Settings → Secrets and variables → Actions → `RELEASE_PAT`**.
- [ ] Run a snapshot release to confirm tag push and `release-on-tag` trigger still work.
- [ ] Revoke the old PAT after successful validation.
- [ ] Record rotation date/owner in team notes.

**If `release-on-tag` does not trigger after rotation:**
- Verify secret name is exactly `RELEASE_PAT`.
- Verify token owner has write access to this repository.
- Verify token permission includes **Contents: Read and write**.
