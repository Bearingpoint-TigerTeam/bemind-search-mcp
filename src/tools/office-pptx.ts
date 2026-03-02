/**
 * render_pptx — Create PowerPoint presentations.
 * Uses pptxgenjs.
 */

import { z } from "zod";
import PptxGenJS from "pptxgenjs";
import { statSync } from "fs";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const pptxChartSchema = z.object({
  type: z.enum(["bar", "line", "pie"]).describe("Chart type"),
  title: z.string().optional(),
  categories: z.array(z.string()).describe("X-axis labels"),
  series: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.number()),
    }),
  ),
});

const pptxTableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  header_color: z.string().optional().describe("Header background hex color (without #)"),
});

const pptxSlideSchema = z.object({
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  table: pptxTableSchema.optional(),
  chart: pptxChartSchema.optional(),
});

export const renderPptxSchema = {
  output_path: z.string().describe("Output file path"),
  title: z.string().optional().describe("Presentation title"),
  subtitle: z.string().optional(),
  slides: z.array(pptxSlideSchema).describe("Slide definitions"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chartTypeStr(type: string): PptxGenJS.CHART_NAME {
  switch (type) {
    case "bar": return "bar" as PptxGenJS.CHART_NAME;
    case "line": return "line" as PptxGenJS.CHART_NAME;
    case "pie": return "pie" as PptxGenJS.CHART_NAME;
    default: return "bar" as PptxGenJS.CHART_NAME;
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function renderPptx(args: {
  output_path: string;
  title?: string;
  subtitle?: string;
  slides: Array<{
    title?: string;
    bullets?: string[];
    table?: {
      headers: string[];
      rows: string[][];
      header_color?: string;
    };
    chart?: {
      type: string;
      title?: string;
      categories: string[];
      series: Array<{ name: string; values: number[] }>;
    };
  }>;
}) {
  const pptx = new PptxGenJS();
  let slidesCreated = 0;
  let hasTables = false;
  let hasCharts = false;

  // Title slide
  if (args.title) {
    const slide = pptx.addSlide();
    slide.addText(args.title, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1.5,
      fontSize: 36,
      bold: true,
      align: "center",
    });
    if (args.subtitle) {
      slide.addText(args.subtitle, {
        x: 0.5,
        y: 3.0,
        w: 9,
        h: 1,
        fontSize: 20,
        align: "center",
        color: "666666",
      });
    }
    slidesCreated++;
  }

  // Content slides
  for (const slideDef of args.slides) {
    const slide = pptx.addSlide();
    let yPos = 0.5;

    // Slide title
    if (slideDef.title) {
      slide.addText(slideDef.title, {
        x: 0.5,
        y: yPos,
        w: 9,
        h: 0.8,
        fontSize: 24,
        bold: true,
      });
      yPos += 1.0;
    }

    // Bullets
    if (slideDef.bullets && slideDef.bullets.length > 0) {
      const bulletItems = slideDef.bullets.map((b) => ({
        text: b,
        options: { bullet: true, fontSize: 16 },
      }));
      slide.addText(bulletItems as any, {
        x: 0.5,
        y: yPos,
        w: 9,
        h: 4,
      });
      yPos += Math.min(slideDef.bullets.length * 0.5, 4);
    }

    // Table
    if (slideDef.table) {
      hasTables = true;
      const headerColor = slideDef.table.header_color ?? "4472C4";
      const colCount = slideDef.table.headers.length;
      const colW = 9 / colCount;

      const tableRows: any[][] = [];

      // Header
      tableRows.push(
        slideDef.table.headers.map((h) => ({
          text: h,
          options: {
            bold: true,
            color: "FFFFFF",
            fill: { color: headerColor },
          },
        })),
      );

      // Data
      for (const row of slideDef.table.rows) {
        tableRows.push(row.map((val) => ({ text: val })));
      }

      slide.addTable(tableRows, {
        x: 0.5,
        y: yPos,
        w: 9,
        colW: new Array(colCount).fill(colW),
        border: { type: "solid", pt: 0.5, color: "CCCCCC" },
        fontSize: 12,
      });
    }

    // Chart
    if (slideDef.chart) {
      hasCharts = true;
      const chartType = chartTypeStr(slideDef.chart.type);
      const chartData = slideDef.chart.series.map((s) => ({
        name: s.name,
        labels: slideDef.chart!.categories,
        values: s.values,
      }));

      slide.addChart(chartType, chartData, {
        x: 0.5,
        y: yPos,
        w: 9,
        h: 4,
        showTitle: !!slideDef.chart.title,
        title: slideDef.chart.title,
        showLegend: true,
      });
    }

    slidesCreated++;
  }

  await pptx.writeFile({ fileName: args.output_path });
  const fileSize = statSync(args.output_path).size;

  return {
    success: true,
    output_path: args.output_path,
    slides_created: slidesCreated,
    used_template: false,
    has_tables: hasTables,
    has_charts: hasCharts,
    file_size_bytes: fileSize,
  };
}
