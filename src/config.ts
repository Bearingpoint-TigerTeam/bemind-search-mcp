/**
 * Configuration — zod-validated env vars.
 * Loads from ~/.bmind/.env and ./.env, then validates.
 */

import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { log } from "./logging.js";

// ---------------------------------------------------------------------------
// .env loader (simple key=value, supports quotes, # comments)
// ---------------------------------------------------------------------------

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Load .env files (home first, then cwd — existing env takes precedence)
loadEnvFile(join(homedir(), ".bmind", ".env"));
loadEnvFile(join(process.cwd(), ".env"));

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const AzureSearchConfigSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  defaultIndex: z.string().default("sap"),
});

export const SapConfigSchema = z.object({
  host: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  client: z.string().default("900"),
});

export const SapAiCoreConfigSchema = z.object({
  tokenUrl: z.string().url().default("https://sap-genai.authentication.eu20.hana.ondemand.com/oauth/token"),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  apiUrl: z.string().url().default("https://api.ai.prod-eu20.westeurope.azure.ml.hana.ondemand.com/v2/lm/document-grounding/retrieval/search"),
});

export const GraphConfigSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AzureSearchConfig = z.infer<typeof AzureSearchConfigSchema>;
export type SapConfig = z.infer<typeof SapConfigSchema>;
export type SapAiCoreConfig = z.infer<typeof SapAiCoreConfigSchema>;
export type GraphConfig = z.infer<typeof GraphConfigSchema>;

// ---------------------------------------------------------------------------
// Parse from env
// ---------------------------------------------------------------------------

function tryParse<T>(label: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e: any) {
    log.warn(`${label} config not available: ${e.message ?? e}`);
    return undefined;
  }
}

export function loadAzureSearchConfig(): AzureSearchConfig | undefined {
  return tryParse("AzureSearch", () =>
    AzureSearchConfigSchema.parse({
      endpoint: process.env.AZURE_SEARCH_ENDPOINT,
      apiKey: process.env.AZURE_SEARCH_KEY,
      defaultIndex: process.env.AZURE_SEARCH_DEFAULT_INDEX || "sap",
    }),
  );
}

export function loadSapConfig(): SapConfig | undefined {
  return tryParse("SAP", () =>
    SapConfigSchema.parse({
      host: process.env.SAP_HOST,
      user: process.env.SAP_USER,
      password: process.env.SAP_PASSWD,
      client: process.env.SAP_CLIENT || "900",
    }),
  );
}

export function loadSapAiCoreConfig(): SapAiCoreConfig | undefined {
  return tryParse("SapAiCore", () =>
    SapAiCoreConfigSchema.parse({
      tokenUrl: process.env.SAP_AICORE_TOKEN_URL || "https://sap-genai.authentication.eu20.hana.ondemand.com/oauth/token",
      clientId: process.env.SAP_AICORE_CLIENT_ID,
      clientSecret: process.env.SAP_AICORE_CLIENT_SECRET,
      apiUrl: process.env.SAP_AICORE_API_URL || "https://api.ai.prod-eu20.westeurope.azure.ml.hana.ondemand.com/v2/lm/document-grounding/retrieval/search",
    }),
  );
}

export function loadGraphConfig(): GraphConfig | undefined {
  return tryParse("Graph", () =>
    GraphConfigSchema.parse({
      tenantId: process.env.AZURE_TENANT_ID,
      clientId: process.env.AZURE_CLIENT_ID,
    }),
  );
}
