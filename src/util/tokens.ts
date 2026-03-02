/**
 * Token management for SAP AI Core and Microsoft Graph APIs.
 * - AI Core: in-memory only, client_credentials flow
 * - Graph: in-memory + disk cache, device code flow + refresh
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { SapAiCoreConfig, GraphConfig } from "../config.js";
import { log } from "../logging.js";

// ---------------------------------------------------------------------------
// SAP AI Core token (in-memory cache)
// ---------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  expiresAt: number; // unix seconds
}

let aiCoreTokenCache: CachedToken | undefined;

export async function getAiCoreToken(config: SapAiCoreConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (aiCoreTokenCache && aiCoreTokenCache.expiresAt > now + 60) {
    return aiCoreTokenCache.accessToken;
  }

  log.info("Fetching new SAP AI Core token...");
  const resp = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI Core token request failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  aiCoreTokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in,
  };
  return aiCoreTokenCache.accessToken;
}

// ---------------------------------------------------------------------------
// Microsoft Graph token (in-memory + disk cache)
// ---------------------------------------------------------------------------

interface CachedGraphToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let graphTokenCache: CachedGraphToken | undefined;

const GRAPH_TOKEN_PATH = join(homedir(), ".bmind", ".graph_token");

function loadGraphTokenFromDisk(): CachedGraphToken | undefined {
  try {
    if (!existsSync(GRAPH_TOKEN_PATH)) return undefined;
    const raw = readFileSync(GRAPH_TOKEN_PATH, "utf-8");
    const data = JSON.parse(raw);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    };
  } catch {
    return undefined;
  }
}

function saveGraphTokenToDisk(token: CachedGraphToken): void {
  try {
    const dir = join(homedir(), ".bmind");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      GRAPH_TOKEN_PATH,
      JSON.stringify({
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
      }),
    );
    if (process.platform !== "win32") {
      chmodSync(GRAPH_TOKEN_PATH, 0o600);
    }
  } catch (e) {
    log.warn(`Failed to save Graph token cache: ${e}`);
  }
}

async function refreshGraphToken(config: GraphConfig, refreshToken: string): Promise<CachedGraphToken> {
  const resp = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph token refresh failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const now = Math.floor(Date.now() / 1000);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + data.expires_in,
  };
}

async function deviceCodeFlow(config: GraphConfig): Promise<CachedGraphToken> {
  // Step 1: Request device code
  const codeResp = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/devicecode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        scope: "Mail.Read Mail.Send Calendars.Read Calendars.ReadWrite User.Read offline_access",
      }),
    },
  );

  if (!codeResp.ok) {
    const text = await codeResp.text();
    throw new Error(`Device code request failed (${codeResp.status}): ${text}`);
  }

  const codeData = (await codeResp.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
    message: string;
  };

  // Print instructions to stderr (user must see this)
  log.info(`\n${codeData.message}\n`);

  // Step 2: Poll for token
  const pollInterval = (codeData.interval || 5) * 1000;
  const deadline = Date.now() + codeData.expires_in * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const tokenResp = await fetch(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: codeData.device_code,
        }),
      },
    );

    if (tokenResp.ok) {
      const data = (await tokenResp.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };
      const now = Math.floor(Date.now() / 1000);
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: now + data.expires_in,
      };
    }

    const errData = (await tokenResp.json()) as { error: string };
    if (errData.error === "authorization_pending") continue;
    if (errData.error === "slow_down") {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    throw new Error(`Device code flow error: ${errData.error}`);
  }

  throw new Error("Device code flow timed out");
}

export async function getGraphToken(config: GraphConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // 1. Check in-memory cache
  if (graphTokenCache && graphTokenCache.expiresAt > now + 60) {
    return graphTokenCache.accessToken;
  }

  // 2. Try disk cache
  if (!graphTokenCache) {
    graphTokenCache = loadGraphTokenFromDisk();
  }

  // 3. Try refresh
  if (graphTokenCache?.refreshToken) {
    try {
      if (graphTokenCache.expiresAt > now + 60) {
        return graphTokenCache.accessToken;
      }
      log.info("Refreshing Graph token...");
      graphTokenCache = await refreshGraphToken(config, graphTokenCache.refreshToken);
      saveGraphTokenToDisk(graphTokenCache);
      return graphTokenCache.accessToken;
    } catch (e) {
      log.warn(`Token refresh failed, falling back to device code flow: ${e}`);
    }
  }

  // 4. Device code flow
  graphTokenCache = await deviceCodeFlow(config);
  saveGraphTokenToDisk(graphTokenCache);
  return graphTokenCache.accessToken;
}
