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

This project uses a **tag-driven release flow** with GitHub Actions.

### Versioning policy

- Source of truth: `package.json` `version`
- Release tag format:
  - Stable: `vMAJOR.MINOR.PATCH` (example: `v2.1.0`)
  - Prerelease: `vMAJOR.MINOR.PATCH-rc.N` / `-beta.N` (example: `v2.2.0-rc.1`)
- Release artifacts are cross-compiled and uploaded to GitHub **Releases**.

### Release workflows

- `release-manual` (manual trigger): validates version and creates/pushes release tag.
- `release-on-tag` (automatic): runs on tag push, builds all targets, uploads binaries to the matching GitHub Release.

### Stable release runbook

1. Update `package.json` version to the next stable version.
2. Merge to `main`.
3. Trigger **Actions → release-manual**:
   - Leave `version` empty (recommended), or provide the exact same version as `package.json`.
   - Set `prerelease=false`.
4. Wait for tag creation (`vX.Y.Z`).
5. Confirm `release-on-tag` completes and assets appear under **Releases**.

### Prerelease runbook (RC/Beta)

1. Set `package.json` version to prerelease (example: `2.2.0-rc.1`).
2. Merge to `main`.
3. Trigger **Actions → release-manual** with:
   - `version` empty (recommended)
   - `prerelease=true`
4. Verify release appears as prerelease with expected assets.

### Expected safeguards

The workflow fails fast if:

- `version` is not valid semver.
- `version` and `package.json` differ.
- prerelease flag and version suffix are inconsistent.
- target tag already exists (prevents accidental overwrite/reuse).

If you see a tag-exists failure when using empty input, bump `package.json` version and rerun.

### Token rotation checklist (`RELEASE_PAT`)

- [ ] Create a new fine-grained PAT (scope: this repo only, **Contents: Read and write**).
- [ ] Set an expiration date (recommended: 30–90 days).
- [ ] Update repo secret: **Settings → Secrets and variables → Actions → `RELEASE_PAT`**.
- [ ] Run a dry release test (or workflow validation) to confirm tag push still works.
- [ ] Revoke the old PAT after successful validation.
- [ ] Record rotation date/owner in team notes.

**If release-on-tag does not trigger after rotation:**
- Verify secret name is exactly `RELEASE_PAT`.
- Verify token owner has access to `bemind-search-mcp`.
- Verify token repository permissions include **Contents: Read and write**.
