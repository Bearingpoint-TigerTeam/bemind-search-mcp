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

type GraphAuthStatus = "authorization_required" | "authorization_pending";

interface GraphDeviceCodePrompt {
  message: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_at: string;
  poll_interval_seconds: number;
}

interface PendingGraphDeviceCode {
  deviceCode: string;
  expiresAtMs: number;
  pollIntervalMs: number;
  nextPollAfterMs: number;
  prompt: GraphDeviceCodePrompt;
}

export class GraphAuthRequiredError extends Error {
  readonly status: GraphAuthStatus;
  readonly prompt: GraphDeviceCodePrompt;

  constructor(status: GraphAuthStatus, prompt: GraphDeviceCodePrompt) {
    super(`Graph authentication ${status.replace("_", " ")}`);
    this.name = "GraphAuthRequiredError";
    this.status = status;
    this.prompt = prompt;
  }
}

export function isGraphAuthRequiredError(value: unknown): value is GraphAuthRequiredError {
  return value instanceof GraphAuthRequiredError;
}

let graphTokenCache: CachedGraphToken | undefined;
let pendingGraphDeviceCode: PendingGraphDeviceCode | undefined;
let deviceCodeRequestInFlight: Promise<PendingGraphDeviceCode> | undefined;

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

function graphAuthEnabled(): boolean {
  return process.env.GRAPH_DEVICE_CODE_FLOW !== "0";
}

async function requestDeviceCode(config: GraphConfig): Promise<PendingGraphDeviceCode> {
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
    verification_uri_complete?: string;
    expires_in: number;
    interval: number;
    message: string;
  };

  const pollIntervalMs = Math.max((codeData.interval || 5) * 1000, 1000);
  const expiresInMs = Math.max(codeData.expires_in || 900, 60) * 1000;
  const nowMs = Date.now();

  return {
    deviceCode: codeData.device_code,
    expiresAtMs: nowMs + expiresInMs,
    pollIntervalMs,
    nextPollAfterMs: nowMs + pollIntervalMs,
    prompt: {
      message: codeData.message,
      user_code: codeData.user_code,
      verification_uri: codeData.verification_uri,
      verification_uri_complete: codeData.verification_uri_complete,
      expires_at: new Date(nowMs + expiresInMs).toISOString(),
      poll_interval_seconds: Math.ceil(pollIntervalMs / 1000),
    },
  };
}

function getPendingDeviceCodeIfValid(): PendingGraphDeviceCode | undefined {
  if (!pendingGraphDeviceCode) return undefined;
  if (pendingGraphDeviceCode.expiresAtMs <= Date.now()) {
    pendingGraphDeviceCode = undefined;
    return undefined;
  }
  return pendingGraphDeviceCode;
}

async function ensurePendingDeviceCode(config: GraphConfig): Promise<PendingGraphDeviceCode> {
  const existing = getPendingDeviceCodeIfValid();
  if (existing) return existing;

  if (!deviceCodeRequestInFlight) {
    deviceCodeRequestInFlight = requestDeviceCode(config);
  }

  try {
    pendingGraphDeviceCode = await deviceCodeRequestInFlight;
    log.info(`Graph auth required. Open ${pendingGraphDeviceCode.prompt.verification_uri} and enter ${pendingGraphDeviceCode.prompt.user_code}`);
    return pendingGraphDeviceCode;
  } finally {
    deviceCodeRequestInFlight = undefined;
  }
}

async function tryPollPendingDeviceCode(config: GraphConfig): Promise<string | undefined> {
  const pending = getPendingDeviceCodeIfValid();
  if (!pending) return undefined;

  const nowMs = Date.now();
  if (nowMs < pending.nextPollAfterMs) return undefined;

  const tokenResp = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: pending.deviceCode,
      }),
    },
  );

  if (tokenResp.ok) {
    const data = (await tokenResp.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const nowSec = Math.floor(Date.now() / 1000);
    graphTokenCache = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: nowSec + data.expires_in,
    };
    saveGraphTokenToDisk(graphTokenCache);
    pendingGraphDeviceCode = undefined;
    return graphTokenCache.accessToken;
  }

  const rawError = await tokenResp.text();
  let errCode = "unknown_error";
  try {
    const errData = JSON.parse(rawError) as { error?: string };
    errCode = errData.error ?? errCode;
  } catch {
    // Keep generic error code when token endpoint doesn't return JSON.
  }

  if (errCode === "authorization_pending") {
    pending.nextPollAfterMs = Date.now() + pending.pollIntervalMs;
    return undefined;
  }

  if (errCode === "slow_down") {
    pending.pollIntervalMs += 5000;
    pending.nextPollAfterMs = Date.now() + pending.pollIntervalMs;
    pending.prompt.poll_interval_seconds = Math.ceil(pending.pollIntervalMs / 1000);
    return undefined;
  }

  if (errCode === "expired_token" || errCode === "authorization_declined" || errCode === "bad_verification_code") {
    log.warn(`Graph device code no longer valid (${errCode}), requesting a new one`);
    pendingGraphDeviceCode = undefined;
    return undefined;
  }

  throw new Error(
    `Graph device code poll failed (${tokenResp.status}): ${errCode}${rawError ? `: ${rawError}` : ""}`,
  );
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

  // 4. Pending device-code flow (if user has already been prompted)
  const pendingToken = await tryPollPendingDeviceCode(config);
  if (pendingToken) return pendingToken;

  const activePrompt = getPendingDeviceCodeIfValid();
  if (activePrompt) {
    throw new GraphAuthRequiredError("authorization_pending", activePrompt.prompt);
  }

  // 5. Start a new device-code flow and return instructions to caller
  if (!graphAuthEnabled()) {
    throw new Error(
      "Graph auth required: no cached token and device code flow is disabled (GRAPH_DEVICE_CODE_FLOW=0).",
    );
  }

  const prompt = await ensurePendingDeviceCode(config);
  throw new GraphAuthRequiredError("authorization_required", prompt.prompt);
}
