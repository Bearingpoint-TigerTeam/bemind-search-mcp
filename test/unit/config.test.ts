import { describe, it, expect } from "bun:test";
import { AzureSearchConfigSchema, SapConfigSchema, GraphConfigSchema, SapAiCoreConfigSchema } from "../../src/config.js";

describe("AzureSearchConfigSchema", () => {
  it("parses valid config", () => {
    const result = AzureSearchConfigSchema.parse({
      endpoint: "https://test.search.windows.net",
      apiKey: "test-key",
      defaultIndex: "my-index",
    });
    expect(result.endpoint).toBe("https://test.search.windows.net");
    expect(result.apiKey).toBe("test-key");
    expect(result.defaultIndex).toBe("my-index");
  });

  it("uses default index", () => {
    const result = AzureSearchConfigSchema.parse({
      endpoint: "https://test.search.windows.net",
      apiKey: "test-key",
    });
    expect(result.defaultIndex).toBe("sap");
  });

  it("rejects missing endpoint", () => {
    expect(() =>
      AzureSearchConfigSchema.parse({ apiKey: "key" }),
    ).toThrow();
  });
});

describe("SapConfigSchema", () => {
  it("parses valid config", () => {
    const result = SapConfigSchema.parse({
      host: "sap-host",
      user: "admin",
      password: "secret",
      client: "100",
    });
    expect(result.host).toBe("sap-host");
    expect(result.client).toBe("100");
  });

  it("uses default client", () => {
    const result = SapConfigSchema.parse({
      host: "sap-host",
      user: "admin",
      password: "secret",
    });
    expect(result.client).toBe("900");
  });
});

describe("GraphConfigSchema", () => {
  it("parses valid config", () => {
    const result = GraphConfigSchema.parse({
      tenantId: "tenant-123",
      clientId: "client-456",
    });
    expect(result.tenantId).toBe("tenant-123");
  });

  it("rejects empty tenantId", () => {
    expect(() =>
      GraphConfigSchema.parse({ tenantId: "", clientId: "x" }),
    ).toThrow();
  });
});

describe("SapAiCoreConfigSchema", () => {
  it("uses default URLs", () => {
    const result = SapAiCoreConfigSchema.parse({
      clientId: "id",
      clientSecret: "secret",
    });
    expect(result.tokenUrl).toContain("sap-genai.authentication");
    expect(result.apiUrl).toContain("document-grounding");
  });
});
