/**
 * SAP OData tools: get_abap_source, run_abap_atc_check, read_sap_table
 */

import { z } from "zod";
import type { SapConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basicAuth(config: SapConfig): string {
  return "Basic " + Buffer.from(`${config.user}:${config.password}`).toString("base64");
}

function sapBaseUrl(config: SapConfig): string {
  const host = config.host.startsWith("http") ? config.host : `https://${config.host}`;
  return host.replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const getAbapSourceSchema = {
  object_name: z.string().describe("ABAP object name"),
  object_type: z
    .enum(["CLAS", "PROG", "FUNC"])
    .default("CLAS")
    .describe("Object type: CLAS, PROG, or FUNC"),
};

export const runAbapAtcCheckSchema = {
  object_name: z.string().describe("ABAP object name"),
  object_type: z
    .enum(["CLAS", "PROG", "FUNC"])
    .default("CLAS")
    .describe("Object type: CLAS, PROG, or FUNC"),
  atc_variant: z.string().describe("ATC check variant name"),
};

export const readSapTableSchema = {
  table: z.string().max(30).describe("SAP table name (e.g. MARA, VBAK)"),
  fields: z.string().optional().describe("Comma-separated field list"),
  where_clause: z.string().optional().describe("ABAP WHERE clause"),
  max_rows: z.number().int().min(1).max(1000).default(100).describe("Max rows (1-1000, default 100)"),
};

// ---------------------------------------------------------------------------
// get_abap_source
// ---------------------------------------------------------------------------

export async function getAbapSource(
  config: SapConfig,
  args: { object_name: string; object_type?: string },
) {
  const base = sapBaseUrl(config);
  const objectType = args.object_type || "CLAS";
  const params = new URLSearchParams({
    "sap-client": config.client,
    ProgramID: "'HEAD'",
    ObjectType: `'${objectType}'`,
    ObjectName: `'${args.object_name}'`,
    Dummy: "'X'",
    $format: "json",
  });

  const url = `${base}/sap/opu/odata/sap/ZUI_REPOSITORY_OBJECTS_O2/get_object_source_code?${params}`;
  const resp = await fetch(url, {
    headers: { Authorization: basicAuth(config) },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SAP OData returned ${resp.status}: ${text}`);
  }

  return await resp.json();
}

// ---------------------------------------------------------------------------
// run_abap_atc_check
// ---------------------------------------------------------------------------

export async function runAbapAtcCheck(
  config: SapConfig,
  args: { object_name: string; object_type?: string; atc_variant: string },
) {
  const base = sapBaseUrl(config);
  const objectType = args.object_type || "CLAS";
  const params = new URLSearchParams({
    "sap-client": config.client,
    ProgramID: "'HEAD'",
    ObjectType: `'${objectType}'`,
    ObjectName: `'${args.object_name}'`,
    Variant: `'${args.atc_variant}'`,
    $format: "json",
  });

  const url = `${base}/sap/opu/odata/sap/ZUI_REPOSITORY_OBJECTS_O2/run_atc_check?${params}`;
  const resp = await fetch(url, {
    headers: { Authorization: basicAuth(config) },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SAP ATC check returned ${resp.status}: ${text}`);
  }

  return await resp.json();
}

// ---------------------------------------------------------------------------
// read_sap_table
// ---------------------------------------------------------------------------

export async function readSapTable(
  config: SapConfig,
  args: { table: string; fields?: string; where_clause?: string; max_rows?: number },
) {
  const base = sapBaseUrl(config);
  const tableName = args.table.toUpperCase();
  const maxRows = Math.min(Math.max(args.max_rows ?? 100, 1), 1000);

  const params = new URLSearchParams({
    "sap-client": config.client,
    Table: `'${tableName}'`,
    Fields: `'${args.fields ?? ""}'`,
    WhereClause: `'${args.where_clause ?? ""}'`,
    MaxRows: `'${maxRows}'`,
    $format: "json",
  });

  const url = `${base}/sap/opu/odata/sap/Z_EXECUTE_API_SRV_SRV/ReadTable?${params}`;
  const resp = await fetch(url, {
    headers: { Authorization: basicAuth(config) },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SAP ReadTable returned ${resp.status}: ${text}`);
  }

  const raw = (await resp.json()) as any;
  const d = raw?.d ?? raw;

  // Parse the ResultData JSON string
  let data: any[] = [];
  let fields: Record<string, string> = {};
  let success = false;
  let message = "";

  try {
    if (d.ResultData) {
      const parsed = JSON.parse(d.ResultData);
      data = parsed.Data ?? parsed.data ?? [];
      fields = parsed.Fields ?? parsed.fields ?? {};
    }
    success = d.Success === "X" || d.Success === true;
    message = d.Messages ?? d.Message ?? "";
  } catch {
    // Return raw if parsing fails
    return { table: tableName, success: false, message: "Failed to parse response", raw: d };
  }

  return {
    table: tableName,
    success,
    message,
    fields, // field name → description map
    data,
    row_count: data.length,
  };
}
