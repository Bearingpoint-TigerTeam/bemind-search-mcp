/**
 * Configuration — zod-validated env vars.
 * Env vars are injected by the MCP client via the "env" block in its config.
 */

import { z } from "zod";
import { log } from "./logging.js";

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
      defaultIndex: process.env.AZURE_SEARCH_DEFAULT_INDEX,
    }),
  );
}

export function loadSapConfig(): SapConfig | undefined {
  return tryParse("SAP", () =>
    SapConfigSchema.parse({
      host: process.env.SAP_HOST,
      user: process.env.SAP_USER,
      password: process.env.SAP_PASSWD,
      client: process.env.SAP_CLIENT,
    }),
  );
}

export function loadSapAiCoreConfig(): SapAiCoreConfig | undefined {
  return tryParse("SapAiCore", () =>
    SapAiCoreConfigSchema.parse({
      tokenUrl: process.env.SAP_AICORE_TOKEN_URL,
      clientId: process.env.SAP_AICORE_CLIENT_ID,
      clientSecret: process.env.SAP_AICORE_CLIENT_SECRET,
      apiUrl: process.env.SAP_AICORE_API_URL,
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
