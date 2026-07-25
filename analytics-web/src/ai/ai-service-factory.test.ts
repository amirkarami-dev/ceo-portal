// analytics-web/src/ai/ai-service-factory.test.ts
// Tests that createAIService() returns the correct implementation based on
// the VITE_AI_MODE env flag.  No network calls — both classes are mocked.

import { describe, it, expect, vi, afterEach } from "vitest";

// Stub the concrete implementations so we don't load their deps.
vi.mock("./mock-ai-service", () => ({
  MockReportAIService: class MockReportAIService {
    readonly _tag = "mock";
    generate = vi.fn();
  },
}));

vi.mock("./http-ai-service", () => ({
  HttpReportAIService: class HttpReportAIService {
    readonly _tag = "http";
    generate = vi.fn();
  },
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("createAIService()", () => {
  it('returns MockReportAIService when VITE_AI_MODE is "mock" (default)', async () => {
    vi.stubEnv("VITE_AI_MODE", "mock");
    const { createAIService } = await import("./index");
    const svc = createAIService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((svc as any)._tag).toBe("mock");
  });

  it("returns MockReportAIService when VITE_AI_MODE is not set", async () => {
    vi.stubEnv("VITE_AI_MODE", "");
    const { createAIService } = await import("./index");
    const svc = createAIService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((svc as any)._tag).toBe("mock");
  });

  it('returns HttpReportAIService when VITE_AI_MODE is "gateway"', async () => {
    vi.stubEnv("VITE_AI_MODE", "gateway");
    const { createAIService } = await import("./index");
    const svc = createAIService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((svc as any)._tag).toBe("http");
  });

  it('returns HttpReportAIService when VITE_AI_MODE is "http"', async () => {
    vi.stubEnv("VITE_AI_MODE", "http");
    const { createAIService } = await import("./index");
    const svc = createAIService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((svc as any)._tag).toBe("http");
  });
});
