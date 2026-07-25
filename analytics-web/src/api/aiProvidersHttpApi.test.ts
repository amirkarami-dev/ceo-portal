// analytics-web/src/api/aiProvidersHttpApi.test.ts
// Tests for the real-API AI Providers fetchers. httpClient is mocked so no
// network calls are made. Verifies correct URL, verb, and response mapping.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./httpClient", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  HttpError: class HttpError extends Error {
    constructor(
      public status: number,
      public body: unknown,
      msg: string,
    ) {
      super(msg);
    }
  },
}));

import { httpClient } from "./httpClient";
import { aiProvidersHttpApi } from "./aiProvidersHttpApi";

const mockGet = vi.mocked(httpClient.get);
const mockPost = vi.mocked(httpClient.post);

const BACKEND_PROVIDERS = [
  { id: "prov-1", type: "OpenAI", enabled: true, config: { model: "gpt-4o-mini" } },
  { id: "prov-2", type: "Ollama", enabled: false, config: { model: "llama3.1" } },
  { id: "prov-3", type: "Azure", enabled: true, config: { model: "gpt-4o" } },
  { id: "prov-4", type: "Claude", enabled: true, config: { model: "claude-3-haiku" } },
];

describe("aiProvidersHttpApi.list()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(BACKEND_PROVIDERS);
  });

  it("calls GET /api/AiProviders", async () => {
    await aiProvidersHttpApi.list();
    expect(mockGet).toHaveBeenCalledWith("/api/AiProviders");
  });

  it("maps backend items to AIProviderRow shape", async () => {
    const result = await aiProvidersHttpApi.list();
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("prov-1");
    expect(result[0].type).toBe("OpenAI");
    expect(result[0].status).toBe("active");
    expect(result[0].model).toBe("gpt-4o-mini");
  });

  it("maps enabled=false to status='inactive'", async () => {
    const result = await aiProvidersHttpApi.list();
    expect(result[1].type).toBe("Ollama");
    expect(result[1].status).toBe("inactive");
  });

  it("maps all known backend type strings to frontend union values", async () => {
    const result = await aiProvidersHttpApi.list();
    expect(result[0].type).toBe("OpenAI");
    expect(result[1].type).toBe("Ollama");
    expect(result[2].type).toBe("Azure");
    expect(result[3].type).toBe("Claude");
  });
});

describe("aiProvidersHttpApi.upsert()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue(undefined);
  });

  it("calls POST /api/AiProviders with the correct body", async () => {
    await aiProvidersHttpApi.upsert({
      id: "prov-1",
      tenantId: "t1",
      type: "OpenAI",
      model: "gpt-4o",
      status: "active",
    });

    expect(mockPost).toHaveBeenCalledWith("/api/AiProviders", {
      id: "prov-1",
      type: "OpenAI",
      enabled: true,
      config: { model: "gpt-4o" },
    });
  });

  it("maps status='inactive' to enabled=false", async () => {
    await aiProvidersHttpApi.upsert({
      id: "prov-2",
      tenantId: "t1",
      type: "Ollama",
      model: "llama3.1",
      status: "inactive",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/AiProviders",
      expect.objectContaining({ enabled: false }),
    );
  });
});
