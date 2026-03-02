import { describe, it, expect } from "bun:test";
import { renderDocx } from "../../src/tools/office-docx.js";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("render_docx", () => {
  const outPath = join(tmpdir(), `test-${Date.now()}.docx`);

  it("creates a docx with rich content", async () => {
    const result = await renderDocx({
      output_path: outPath,
      content: [
        { type: "title", text: "Test Document" },
        { type: "heading1", text: "Introduction" },
        { type: "paragraph", text: "This is a test paragraph." },
        {
          type: "bullet_list",
          items: ["Item one", "Item two", "Item three"],
        },
        {
          type: "table",
          table: {
            headers: ["Name", "Value"],
            rows: [
              ["Alpha", "100"],
              ["Beta", "200"],
            ],
          },
        },
        { type: "page_break" },
        { type: "heading2", text: "Conclusion" },
        {
          type: "paragraph",
          text: "Done.",
          format: { bold: true, italic: true },
        },
      ],
    } as any);

    expect(result.success).toBe(true);
    expect(result.elements_written).toBeGreaterThan(5);
    expect(result.file_size_bytes).toBeGreaterThan(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it("cleanup", () => {
    if (existsSync(outPath)) unlinkSync(outPath);
  });
});
