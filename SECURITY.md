# Security

## Transport Security

### stdio (default)
- **stdout** must contain only newline-delimited JSON-RPC messages
- **stderr** is used for all logging output
- No network ports are opened

### Streamable HTTP (future)
If HTTP transport is added:
- Validate `Origin` header on all requests
- Bind to `127.0.0.1` for local mode
- Require authentication for remote access
- Protect against DNS rebinding attacks

## Secrets Management
- Never hardcode secrets in source code
- Read secrets from environment variables or `.env` files
- `.env` files should never be committed to version control
- Graph tokens are cached at `~/.bmind/.graph_token` with `0600` permissions

## Dependencies
- Pin dependency versions in `bun.lock`
- Audit dependencies regularly
