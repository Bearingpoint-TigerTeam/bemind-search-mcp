/**
 * BeMind Search MCP Server — stdio transport.
 * Registers all tools and connects via StdioServerTransport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { log } from "./logging.js";
import {
  loadAzureSearchConfig,
  loadSapConfig,
  loadSapAiCoreConfig,
  loadGraphConfig,
} from "./config.js";

// Tool implementations
import { sapSearch, listIndexes, sapSearchSchema } from "./tools/sap-search.js";
import {
  getAbapSource,
  runAbapAtcCheck,
  readSapTable,
  getAbapSourceSchema,
  runAbapAtcCheckSchema,
  readSapTableSchema,
} from "./tools/sap-odata.js";
import { sapHelpSearch, sapHelpSearchSchema } from "./tools/sap-help.js";
import {
  graphWhoami,
  graphListEmails,
  graphReadEmail,
  graphSendEmail,
  graphListEvents,
  graphCreateEvent,
  graphListEmailsSchema,
  graphReadEmailSchema,
  graphSendEmailSchema,
  graphListEventsSchema,
  graphCreateEventSchema,
} from "./tools/graph.js";
import { readXlsx, readXlsxSchema } from "./tools/office-read.js";
import { renderXlsx, renderXlsxSchema } from "./tools/office-xlsx.js";
import { renderDocx, renderDocxSchema } from "./tools/office-docx.js";
import { renderPdf, renderPdfSchema } from "./tools/office-pdf.js";
import { renderPptx, renderPptxSchema } from "./tools/office-pptx.js";

// ---------------------------------------------------------------------------
// Load configurations
// ---------------------------------------------------------------------------

const azureConfig = loadAzureSearchConfig();
const sapConfig = loadSapConfig();
const aiCoreConfig = loadSapAiCoreConfig();
const graphConfig = loadGraphConfig();

// ---------------------------------------------------------------------------
// Create MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "bemind-search",
  version: "2.0.0",
});

// ---------------------------------------------------------------------------
// Helper: wrap tool handler with error handling
// ---------------------------------------------------------------------------

function textResult(data: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(msg: string) {
  return {
    content: [{ type: "text" as const, text: msg }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Register SAP Search tools
// ---------------------------------------------------------------------------

if (azureConfig) {
  server.tool(
    "sap_search",
    "Search Azure AI Search indexes for SAP knowledge, project documentation",
    sapSearchSchema,
    async (args) => {
      try {
        const result = await sapSearch(azureConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`sap_search error: ${e.message}`);
      }
    },
  );

  server.tool(
    "list_indexes",
    "List available search indexes in Azure AI Search",
    {},
    async () => {
      try {
        const result = await listIndexes(azureConfig);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`list_indexes error: ${e.message}`);
      }
    },
  );
} else {
  log.warn("Azure Search tools disabled (missing config)");
}

// ---------------------------------------------------------------------------
// Register SAP OData tools
// ---------------------------------------------------------------------------

if (sapConfig) {
  server.tool(
    "get_abap_source",
    "Fetch ABAP object source code from SAP system via OData",
    getAbapSourceSchema,
    async (args) => {
      try {
        const result = await getAbapSource(sapConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`get_abap_source error: ${e.message}`);
      }
    },
  );

  server.tool(
    "run_abap_atc_check",
    "Run ABAP Test Cockpit (ATC) checks on SAP objects",
    runAbapAtcCheckSchema,
    async (args) => {
      try {
        const result = await runAbapAtcCheck(sapConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`run_abap_atc_check error: ${e.message}`);
      }
    },
  );

  server.tool(
    "read_sap_table",
    "Read SAP tables via RFC_READ_TABLE OData endpoint (with field descriptions)",
    readSapTableSchema,
    async (args) => {
      try {
        const result = await readSapTable(sapConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`read_sap_table error: ${e.message}`);
      }
    },
  );
} else {
  log.warn("SAP OData tools disabled (missing config)");
}

// ---------------------------------------------------------------------------
// Register SAP Help Search
// ---------------------------------------------------------------------------

if (aiCoreConfig) {
  server.tool(
    "sap_help_search",
    "Search SAP help documentation via AI Core Document Grounding",
    sapHelpSearchSchema,
    async (args) => {
      try {
        const result = await sapHelpSearch(aiCoreConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`sap_help_search error: ${e.message}`);
      }
    },
  );
} else {
  log.warn("SAP Help Search disabled (missing AI Core config)");
}

// ---------------------------------------------------------------------------
// Register Microsoft Graph tools
// ---------------------------------------------------------------------------

if (graphConfig) {
  server.tool(
    "graph_whoami",
    "Get current user identity from Microsoft Graph",
    {},
    async () => {
      try {
        const result = await graphWhoami(graphConfig);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`graph_whoami error: ${e.message}`);
      }
    },
  );

  server.tool(
    "graph_list_emails",
    "List emails from Outlook mailbox",
    graphListEmailsSchema,
    async (args) => {
      try {
        const result = await graphListEmails(graphConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`graph_list_emails error: ${e.message}`);
      }
    },
  );

  server.tool(
    "graph_read_email",
    "Read full email content by ID",
    graphReadEmailSchema,
    async (args) => {
      try {
        const result = await graphReadEmail(graphConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`graph_read_email error: ${e.message}`);
      }
    },
  );

  server.tool(
    "graph_send_email",
    "Send email via Outlook",
    graphSendEmailSchema,
    async (args) => {
      try {
        const result = await graphSendEmail(graphConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`graph_send_email error: ${e.message}`);
      }
    },
  );

  server.tool(
    "graph_list_events",
    "List calendar events",
    graphListEventsSchema,
    async (args) => {
      try {
        const result = await graphListEvents(graphConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`graph_list_events error: ${e.message}`);
      }
    },
  );

  server.tool(
    "graph_create_event",
    "Create calendar event",
    graphCreateEventSchema,
    async (args) => {
      try {
        const result = await graphCreateEvent(graphConfig, args);
        return textResult(result);
      } catch (e: any) {
        return errorResult(`graph_create_event error: ${e.message}`);
      }
    },
  );
} else {
  log.warn("Microsoft Graph tools disabled (missing config)");
}

// ---------------------------------------------------------------------------
// Register Office document tools (always available)
// ---------------------------------------------------------------------------

server.tool(
  "read_xlsx",
  "Read Excel/spreadsheet files (.xlsx, .xls, .xlsm, .xlsb, .ods)",
  readXlsxSchema,
  async (args) => {
    try {
      const result = await readXlsx(args);
      return textResult(result);
    } catch (e: any) {
      return errorResult(`read_xlsx error: ${e.message}`);
    }
  },
);

server.tool(
  "render_xlsx",
  "Create Excel spreadsheets with formulas, charts, images, conditional formatting",
  renderXlsxSchema,
  async (args) => {
    try {
      const result = await renderXlsx(args as any);
      return textResult(result);
    } catch (e: any) {
      return errorResult(`render_xlsx error: ${e.message}`);
    }
  },
);

server.tool(
  "render_docx",
  "Create Word documents with headings, lists, tables, page breaks",
  renderDocxSchema,
  async (args) => {
    try {
      const result = await renderDocx(args as any);
      return textResult(result);
    } catch (e: any) {
      return errorResult(`render_docx error: ${e.message}`);
    }
  },
);

server.tool(
  "render_pdf",
  "Create PDF documents with title, headings, paragraphs, bullet lists, tables",
  renderPdfSchema,
  async (args) => {
    try {
      const result = await renderPdf(args as any);
      return textResult(result);
    } catch (e: any) {
      return errorResult(`render_pdf error: ${e.message}`);
    }
  },
);

server.tool(
  "render_pptx",
  "Create PowerPoint presentations with slides, tables, charts",
  renderPptxSchema,
  async (args) => {
    try {
      const result = await renderPptx(args as any);
      return textResult(result);
    } catch (e: any) {
      return errorResult(`render_pptx error: ${e.message}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  log.info("Starting BeMind Search MCP server v2.0.0...");
  log.info(`Tools: Azure Search=${!!azureConfig}, SAP=${!!sapConfig}, AI Core=${!!aiCoreConfig}, Graph=${!!graphConfig}, Office=true`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("Server connected via stdio transport");
}

main().catch((err) => {
  log.error(`Fatal: ${err}`);
  process.exit(1);
});
