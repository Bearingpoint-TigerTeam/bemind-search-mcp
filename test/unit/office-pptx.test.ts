import { describe, it, expect } from "bun:test";
import { renderPptx } from "../../src/tools/office-pptx.js";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("render_pptx", () => {
  const outPath = join(tmpdir(), `test-${Date.now()}.pptx`);

  it("creates a PowerPoint presentation", async () => {
    const result = await renderPptx({
      output_path: outPath,
      title: "Test Presentation",
      subtitle: "Unit Tests",
      slides: [
        {
          title: "Slide 1",
          bullets: ["Point A", "Point B", "Point C"],
        },
        {
          title: "Data Table",
          table: {
            headers: ["Name", "Score"],
            rows: [
              ["Alice", "95"],
              ["Bob", "87"],
            ],
            header_color: "4472C4",
          },
        },
        {
          title: "Chart",
          chart: {
            type: "bar",
            title: "Sales",
            categories: ["Q1", "Q2", "Q3"],
            series: [{ name: "Revenue", values: [100, 150, 200] }],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.slides_created).toBe(4); // 1 title + 3 content
    expect(result.has_tables).toBe(true);
    expect(result.has_charts).toBe(true);
    expect(result.file_size_bytes).toBeGreaterThan(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it("cleanup", () => {
    if (existsSync(outPath)) unlinkSync(outPath);
  });
});
