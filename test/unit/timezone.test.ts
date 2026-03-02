import { describe, it, expect } from "bun:test";
import { detectTimezone } from "../../src/util/timezone.js";

describe("detectTimezone", () => {
  it("returns a non-empty string", () => {
    const tz = detectTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("respects GRAPH_TIMEZONE env var", () => {
    const orig = process.env.GRAPH_TIMEZONE;
    process.env.GRAPH_TIMEZONE = "Europe/Berlin";
    try {
      expect(detectTimezone()).toBe("Europe/Berlin");
    } finally {
      if (orig === undefined) delete process.env.GRAPH_TIMEZONE;
      else process.env.GRAPH_TIMEZONE = orig;
    }
  });
});
