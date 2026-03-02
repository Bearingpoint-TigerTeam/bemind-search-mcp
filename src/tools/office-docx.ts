/**
 * render_docx — Create Word documents with full formatting.
 * Uses the docx npm package.
 */

import { z } from "zod";
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  PageBreak,
  Packer,
  BorderStyle,
  ShadingType,
} from "docx";
import { writeFileSync, statSync } from "fs";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const docxTextFormatSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  font_size: z.number().optional().describe("Font size in points"),
  font_color: z.string().optional().describe("Hex color (e.g. FF0000)"),
  highlight: z.string().optional(),
  align: z.enum(["left", "center", "right", "justify"]).optional(),
});

const docxTableDefSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  column_widths: z.array(z.number()).optional().describe("Column widths in twips"),
  header_bg_color: z.string().optional(),
  alternate_row_color: z.string().optional(),
  borders: z.boolean().optional().default(true),
});

const docxContentSchema = z.object({
  type: z.enum([
    "title",
    "heading1",
    "heading2",
    "heading3",
    "paragraph",
    "bullet_list",
    "numbered_list",
    "table",
    "page_break",
  ]),
  text: z.string().optional(),
  items: z.array(z.string()).optional(),
  format: docxTextFormatSchema.optional(),
  table: docxTableDefSchema.optional(),
});

export const renderDocxSchema = {
  output_path: z.string().describe("Output file path"),
  content: z.array(docxContentSchema).optional().describe("Rich content (new mode)"),
  // Legacy mode
  title: z.string().optional(),
  sections: z
    .array(z.object({ heading: z.string(), content: z.string() }))
    .optional(),
  table: docxTableDefSchema.optional(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseHexColor(hex: string): string {
  return hex.replace(/^#/, "");
}

function getAlignment(
  align?: string,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (align) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    case "left":
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
}

function makeTextRun(
  text: string,
  fmt?: z.infer<typeof docxTextFormatSchema>,
): TextRun {
  const opts: any = { text };
  if (fmt?.bold) opts.bold = true;
  if (fmt?.italic) opts.italics = true;
  if (fmt?.underline) opts.underline = {};
  if (fmt?.font_size) opts.size = fmt.font_size * 2; // half-points
  if (fmt?.font_color) opts.color = parseHexColor(fmt.font_color);
  if (fmt?.highlight) opts.highlight = fmt.highlight;
  return new TextRun(opts);
}

function buildTable(tableDef: z.infer<typeof docxTableDefSchema>): Table {
  const colWidths = tableDef.column_widths ?? tableDef.headers.map(() => 2000);
  const hasBorders = tableDef.borders !== false;

  const borderStyle = hasBorders
    ? {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
      }
    : undefined;

  // Header row
  const headerCells = tableDef.headers.map(
    (h, i) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: h, bold: true })],
          }),
        ],
        width: { size: colWidths[i] ?? 2000, type: WidthType.DXA },
        shading: tableDef.header_bg_color
          ? {
              type: ShadingType.SOLID,
              color: parseHexColor(tableDef.header_bg_color),
              fill: parseHexColor(tableDef.header_bg_color),
            }
          : undefined,
        borders: borderStyle,
      }),
  );
  const headerRow = new TableRow({ children: headerCells });

  // Data rows
  const dataRows = tableDef.rows.map((row, ri) => {
    const isAlt = ri % 2 === 1 && tableDef.alternate_row_color;
    const cells = row.map(
      (val, ci) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun(val)] })],
          width: { size: colWidths[ci] ?? 2000, type: WidthType.DXA },
          shading: isAlt
            ? {
                type: ShadingType.SOLID,
                color: parseHexColor(tableDef.alternate_row_color!),
                fill: parseHexColor(tableDef.alternate_row_color!),
              }
            : undefined,
          borders: borderStyle,
        }),
    );
    return new TableRow({ children: cells });
  });

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function renderDocx(args: z.infer<z.ZodObject<typeof renderDocxSchema>>) {
  const children: (Paragraph | Table)[] = [];
  let elementsWritten = 0;

  if (args.content && args.content.length > 0) {
    // New rich content mode
    for (const el of args.content) {
      const align = getAlignment(el.format?.align);

      switch (el.type) {
        case "title":
          children.push(
            new Paragraph({
              children: [
                makeTextRun(el.text ?? "", {
                  bold: true,
                  font_size: 32,
                  ...el.format,
                }),
              ],
              alignment: align,
            }),
          );
          elementsWritten++;
          break;

        case "heading1":
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [makeTextRun(el.text ?? "", el.format)],
              alignment: align,
            }),
          );
          elementsWritten++;
          break;

        case "heading2":
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [makeTextRun(el.text ?? "", el.format)],
              alignment: align,
            }),
          );
          elementsWritten++;
          break;

        case "heading3":
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [makeTextRun(el.text ?? "", el.format)],
              alignment: align,
            }),
          );
          elementsWritten++;
          break;

        case "paragraph":
          children.push(
            new Paragraph({
              children: [makeTextRun(el.text ?? "", el.format)],
              alignment: align,
            }),
          );
          elementsWritten++;
          break;

        case "bullet_list":
          if (el.items) {
            for (const item of el.items) {
              children.push(
                new Paragraph({
                  children: [new TextRun(`\u2022 ${item}`)],
                }),
              );
            }
            elementsWritten += el.items.length;
          }
          break;

        case "numbered_list":
          if (el.items) {
            el.items.forEach((item, i) => {
              children.push(
                new Paragraph({
                  children: [new TextRun(`${i + 1}. ${item}`)],
                }),
              );
            });
            elementsWritten += el.items.length;
          }
          break;

        case "table":
          if (el.table) {
            children.push(buildTable(el.table));
            elementsWritten++;
          }
          break;

        case "page_break":
          children.push(
            new Paragraph({
              children: [new PageBreak()],
            }),
          );
          elementsWritten++;
          break;
      }
    }
  } else {
    // Legacy mode
    if (args.title) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: args.title, bold: true, size: 64 })],
        }),
      );
      elementsWritten++;
    }

    if (args.sections) {
      for (const sec of args.sections) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: sec.heading, bold: true })],
          }),
        );
        children.push(
          new Paragraph({
            children: [new TextRun(sec.content)],
          }),
        );
        elementsWritten += 2;
      }
    }

    if (args.table) {
      children.push(buildTable(args.table));
      elementsWritten++;
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(args.output_path, buffer);
  const fileSize = statSync(args.output_path).size;

  return {
    success: true,
    output_path: args.output_path,
    elements_written: elementsWritten,
    file_size_bytes: fileSize,
  };
}
