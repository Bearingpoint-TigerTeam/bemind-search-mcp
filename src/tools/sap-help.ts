/**
 * sap_help_search — Search SAP help via AI Core Document Grounding.
 */

import { z } from "zod";
import type { SapAiCoreConfig } from "../config.js";
import { getAiCoreToken } from "../util/tokens.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const sapHelpSearchSchema = {
  query: z.string().describe("Search query for SAP documentation"),
  filters: z
    .array(
      z.object({
        id: z.string(),
        dataRepositoryType: z.string(),
        dataRepositories: z.array(z.string()),
      }),
    )
    .optional()
    .describe("Optional filter configuration for document repositories"),
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function sapHelpSearch(
  config: SapAiCoreConfig,
  args: { query: string; filters?: Array<{ id: string; dataRepositoryType: string; dataRepositories: string[] }> },
) {
  const token = await getAiCoreToken(config);

  const body: Record<string, any> = { query: args.query };
  if (args.filters) body.filters = args.filters;

  const resp = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "AI-Resource-Group": "document-grounding",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SAP AI Core search returned ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;

  // Normalize results
  if (Array.isArray(data.results)) {
    return {
      query: args.query,
      result_count: data.results.length,
      results: data.results.map((r: any) => ({
        content: r.content ?? "",
        score: r.score ?? 0,
        filterId: r.filterId ?? "",
        repository: r.dataRepository ?? "",
        documentId: r.documentId ?? "",
        metadata: r.metadata ?? {},
      })),
    };
  }

  // Return raw if unexpected shape
  return { query: args.query, raw_response: data };
}
