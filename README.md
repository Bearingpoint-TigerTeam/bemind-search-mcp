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
```

Tools are conditionally registered based on available config. Office tools are always enabled.

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
