import { describe, it, expect } from "bun:test";
import { renderPdf } from "../../src/tools/office-pdf.js";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("render_pdf", () => {
  const outPath = join(tmpdir(), `test-${Date.now()}.pdf`);

  it("creates a PDF document", async () => {
    const result = await renderPdf({
      output_path: outPath,
      title: "Test Report",
      content: [
        { type: "heading", text: "Overview", level: 1 },
        { type: "paragraph", text: "This is a test PDF document." },
        { type: "bullet_list", items: ["First point", "Second point"] },
        {
          type: "table",
          table: {
            headers: ["Col A", "Col B"],
            rows: [
              ["1", "One"],
              ["2", "Two"],
            ],
          },
        },
      ],
      font_size: 12,
      page_size: "A4",
    });

    expect(result.success).toBe(true);
    expect(result.elements_written).toBeGreaterThan(3);
    expect(result.file_size_bytes).toBeGreaterThan(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it("cleanup", () => {
    if (existsSync(outPath)) unlinkSync(outPath);
  });
});
