/**
 * SAP Search tools: sap_search, list_indexes
 * Uses Azure AI Search with semantic query support.
 */

import { z } from "zod";
import type { AzureSearchConfig } from "../config.js";

const API_VERSION = "2024-07-01";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const sapSearchSchema = {
  query: z.string().describe("Search query text"),
  index: z.string().optional().describe("Index name (uses default if omitted)"),
  top: z.number().int().min(1).max(100).default(10).describe("Max results (1-100, default 10)"),
  filter: z.string().optional().describe("OData filter expression"),
};

// ---------------------------------------------------------------------------
// sap_search
// ---------------------------------------------------------------------------

export async function sapSearch(
  config: AzureSearchConfig,
  args: { query: string; index?: string; top?: number; filter?: string },
) {
  const indexName = args.index || config.defaultIndex;
  const url = `${config.endpoint}/indexes/${indexName}/docs/search?api-version=${API_VERSION}`;

  const body: Record<string, any> = {
    search: args.query,
    top: args.top ?? 10,
    count: true,
    queryType: "semantic",
    semanticConfiguration: "default",
    searchMode: "any",
  };
  if (args.filter) body.filter = args.filter;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Azure Search returned ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const totalCount = data["@odata.count"] ?? 0;
  const results = (data.value ?? []).map((doc: any) => {
    const content = doc.chunk ?? doc.content ?? doc.text ?? "";
    return {
      score: doc["@search.score"],
      title: doc.title ?? doc.metadata_storage_name ?? doc.parent_id ?? "",
      snippet: content.slice(0, 1500),
      docId: doc.chunk_id ?? doc.id ?? "",
      uri: doc.uri ?? "",
      parentId: doc.parent_id ?? "",
    };
  });

  return {
    results,
    totalCount,
    query: args.query,
    index: indexName,
  };
}

// ---------------------------------------------------------------------------
// list_indexes
// ---------------------------------------------------------------------------

export async function listIndexes(config: AzureSearchConfig) {
  const url = `${config.endpoint}/indexes?api-version=${API_VERSION}`;
  const resp = await fetch(url, {
    headers: { "api-key": config.apiKey },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Azure Search returned ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const indexes = (data.value ?? []).map((idx: any) => ({ name: idx.name }));

  return {
    indexes,
    count: indexes.length,
    defaultIndex: config.defaultIndex,
  };
}
