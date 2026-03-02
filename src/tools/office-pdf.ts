/**
 * render_pdf — Create PDF documents.
 * Uses pdfkit.
 */

import { z } from "zod";
import PDFDocument from "pdfkit";
import { createWriteStream, statSync } from "fs";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const pdfContentSchema = z.object({
  type: z.enum(["heading", "paragraph", "bullet_list", "table"]),
  text: z.string().optional(),
  level: z.number().int().min(1).max(3).optional().describe("Heading level 1-3"),
  items: z.array(z.string()).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  table: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .optional(),
});

export const renderPdfSchema = {
  output_path: z.string().describe("Output file path"),
  title: z.string().optional(),
  content: z.array(pdfContentSchema).describe("PDF content elements"),
  font_size: z.number().default(12).describe("Base font size (default 12)"),
  page_size: z.enum(["A4", "Letter"]).default("A4").describe("Page size"),
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function renderPdf(args: {
  output_path: string;
  title?: string;
  content: Array<{
    type: string;
    text?: string;
    level?: number;
    items?: string[];
    bold?: boolean;
    italic?: boolean;
    table?: { headers: string[]; rows: string[][] };
  }>;
  font_size?: number;
  page_size?: string;
}): Promise<{
  success: boolean;
  output_path: string;
  elements_written: number;
  file_size_bytes: number;
}> {
  const baseFontSize = args.font_size ?? 12;
  const pageSize = args.page_size === "Letter" ? "LETTER" : "A4";

  const doc = new PDFDocument({ size: pageSize, margin: 50 });
  const stream = createWriteStream(args.output_path);
  doc.pipe(stream);

  let elementsWritten = 0;

  // Title
  if (args.title) {
    doc.fontSize(baseFontSize + 8).font("Helvetica-Bold").text(args.title);
    doc.moveDown();
    elementsWritten++;
  }

  // Content
  for (const el of args.content) {
    switch (el.type) {
      case "heading": {
        const level = el.level ?? 1;
        const sizeOffset = level === 1 ? 6 : level === 2 ? 4 : 2;
        doc
          .fontSize(baseFontSize + sizeOffset)
          .font("Helvetica-Bold")
          .text(el.text ?? "");
        doc.moveDown(0.5);
        elementsWritten++;
        break;
      }

      case "paragraph": {
        const fontName =
          el.bold && el.italic
            ? "Helvetica-BoldOblique"
            : el.bold
              ? "Helvetica-Bold"
              : el.italic
                ? "Helvetica-Oblique"
                : "Helvetica";
        doc.fontSize(baseFontSize).font(fontName).text(el.text ?? "");
        doc.moveDown(0.5);
        elementsWritten++;
        break;
      }

      case "bullet_list": {
        if (el.items) {
          doc.fontSize(baseFontSize).font("Helvetica");
          for (const item of el.items) {
            doc.text(`\u2022  ${item}`, { indent: 20 });
          }
          doc.moveDown(0.5);
          elementsWritten += el.items.length;
        }
        break;
      }

      case "table": {
        if (el.table) {
          const { headers, rows } = el.table;
          const colCount = headers.length;
          const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const colWidth = pageWidth / colCount;
          const startX = doc.page.margins.left;
          let y = doc.y;

          // Header row
          doc.fontSize(baseFontSize).font("Helvetica-Bold");
          for (let i = 0; i < headers.length; i++) {
            doc.text(headers[i]!, startX + i * colWidth, y, {
              width: colWidth,
              continued: false,
            });
          }
          y = doc.y;

          // Draw header underline
          doc
            .moveTo(startX, y)
            .lineTo(startX + pageWidth, y)
            .stroke();
          y += 5;

          // Data rows
          doc.font("Helvetica");
          for (const row of rows) {
            const rowY = y;
            let maxH = 0;
            for (let i = 0; i < row.length; i++) {
              const h = doc.heightOfString(row[i]!, { width: colWidth - 5 });
              maxH = Math.max(maxH, h);
              doc.text(row[i]!, startX + i * colWidth, rowY, {
                width: colWidth - 5,
              });
            }
            y = rowY + maxH + 5;
            doc.y = y;
          }
          doc.moveDown();
          elementsWritten++;
        }
        break;
      }
    }
  }

  doc.end();

  // Wait for stream to finish
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  const fileSize = statSync(args.output_path).size;

  return {
    success: true,
    output_path: args.output_path,
    elements_written: elementsWritten,
    file_size_bytes: fileSize,
  };
}
