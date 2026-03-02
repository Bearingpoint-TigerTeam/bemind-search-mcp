import { describe, it, expect } from "bun:test";
import { renderXlsx } from "../../src/tools/office-xlsx.js";
import { readXlsx } from "../../src/tools/office-read.js";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("render_xlsx + read_xlsx roundtrip", () => {
  const outPath = join(tmpdir(), `test-${Date.now()}.xlsx`);

  it("creates an xlsx file with legacy mode", async () => {
    const result = await renderXlsx({
      output_path: outPath,
      title: "Test Report",
      headers: ["Name", "Value", "Status"],
      rows: [
        ["Item A", "100", "OK"],
        ["Item B", "200", "Warn"],
        ["Item C", "300", "Error"],
      ],
    } as any);

    expect(result.success).toBe(true);
    expect(result.file_size_bytes).toBeGreaterThan(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it("reads the created xlsx file", async () => {
    const result = await readXlsx({ file_path: outPath });
    expect(result.success).toBe(true);
    expect(result.sheet_names).toContain("Sheet1");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("creates multi-sheet xlsx", async () => {
    const multiPath = join(tmpdir(), `test-multi-${Date.now()}.xlsx`);
    const result = await renderXlsx({
      output_path: multiPath,
      sheets: [
        {
          name: "Sales",
          data: [
            ["Region", "Q1", "Q2"],
            ["North", 100, 150],
            ["South", 200, 250],
          ],
          freeze_panes: { row: 1, col: 0 },
          auto_filter: true,
        },
        {
          name: "Summary",
          data: [["Total", 650]],
        },
      ],
    } as any);

    expect(result.success).toBe(true);
    expect(result.sheets_created).toBe(2);

    // Read back
    const read = await readXlsx({ file_path: multiPath, sheet_name: "__all__" });
    expect(read.success).toBe(true);

    // Cleanup
    unlinkSync(multiPath);
  });

  // Cleanup
  it("cleanup", () => {
    if (existsSync(outPath)) unlinkSync(outPath);
  });
});
