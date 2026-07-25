// analytics-web/src/api/executeApi.test.ts
// Verifies executeReport:
//  - REAL mode  (VITE_USE_MOCK_API="false"): POSTs to /api/Reports/execute and maps response.
//  - MOCK mode  (default / any other value): falls back to in-browser runQuery.
// No real network calls; httpClient and runQuery are mocked.

import { describe, it, expect, vi, afterEach } from "vitest";

// ── stub httpClient ──────────────────────────────────────────────────────────
vi.mock("./httpClient", () => ({
  httpClient: {
    post: vi.fn(),
  },
}));

// ── stub query engine (used by mock path) ─────────────────────────────────
vi.mock("../query/engine", () => ({
  runQuery: vi.fn(),
}));

// ── stub registry (used by mock path to get dataset + semantic model) ─────
vi.mock("../semantic/registry", () => ({
  getDataset: vi.fn().mockReturnValue([]),
  getModelForDataset: vi.fn().mockReturnValue({
    id: "model-sales",
    tenantId: "global",
    name: { "fa-IR": "فروش", "en-US": "Sales" },
    defaultLocale: "fa-IR",
    version: 1,
    entities: [],
  }),
}));

import { httpClient } from "./httpClient";
import { runQuery } from "../query/engine";

const mockPost = vi.mocked(httpClient.post);
const mockRunQuery = vi.mocked(runQuery);

const MINIMAL_DEF = {
  id: "rep-1",
  schemaVersion: "1" as const,
  name: "Test",
  dataset: "ds-sales",
  columns: [],
  presentation: { views: [] as [] },
} as Parameters<typeof import("./executeApi")["executeReport"]>[0];

const BACKEND_RESULT = {
  columns: [
    { key: "status", label: "وضعیت", type: "string", isMetric: false },
    { key: "count_id", label: "تعداد", type: "number", isMetric: true },
  ],
  rows: [{ status: "active", count_id: 10 }],
  total: 1,
};

const ENGINE_RESULT = {
  columns: [
    { key: "cat", label: "Cat", type: "string" as const, isMetric: false },
  ],
  rows: [{ cat: "A" }],
  total: 1,
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// ── REAL mode ────────────────────────────────────────────────────────────────

describe("executeReport — REAL mode (VITE_USE_MOCK_API='false')", () => {
  it("POSTs to /api/Reports/execute with the definition", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    mockPost.mockResolvedValue(BACKEND_RESULT);

    const { executeReport } = await import("./executeApi");
    await executeReport(MINIMAL_DEF);

    expect(mockPost).toHaveBeenCalledWith("/api/Reports/execute", MINIMAL_DEF);
  });

  it("maps backend columns/rows/total to QueryResult", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    mockPost.mockResolvedValue(BACKEND_RESULT);

    const { executeReport } = await import("./executeApi");
    const result = await executeReport(MINIMAL_DEF);

    expect(result.total).toBe(1);
    expect(result.columns).toHaveLength(2);
    expect(result.columns[0]).toMatchObject({ key: "status", label: "وضعیت", isMetric: false });
    expect(result.columns[1]).toMatchObject({ key: "count_id", label: "تعداد", isMetric: true });
    expect(result.rows).toEqual([{ status: "active", count_id: 10 }]);
  });

  it("does NOT call runQuery in real mode", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    mockPost.mockResolvedValue(BACKEND_RESULT);

    const { executeReport } = await import("./executeApi");
    await executeReport(MINIMAL_DEF);

    expect(mockRunQuery).not.toHaveBeenCalled();
  });
});

// ── MOCK mode (default) ──────────────────────────────────────────────────────

describe("executeReport — MOCK mode (default / VITE_USE_MOCK_API not 'false')", () => {
  it("does NOT call httpClient.post in mock mode", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    mockRunQuery.mockReturnValue(ENGINE_RESULT);

    const { executeReport } = await import("./executeApi");
    await executeReport(MINIMAL_DEF);

    expect(mockPost).not.toHaveBeenCalled();
  });

  it("calls runQuery with dataset and semantic model from registry", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    mockRunQuery.mockReturnValue(ENGINE_RESULT);

    const { executeReport } = await import("./executeApi");
    const result = await executeReport(MINIMAL_DEF);

    expect(mockRunQuery).toHaveBeenCalledTimes(1);
    expect(result).toEqual(ENGINE_RESULT);
  });

  it("uses mock path when VITE_USE_MOCK_API is undefined (default)", async () => {
    // Do NOT stub the env — should behave same as mock mode
    mockRunQuery.mockReturnValue(ENGINE_RESULT);

    const { executeReport } = await import("./executeApi");
    await executeReport(MINIMAL_DEF);

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockRunQuery).toHaveBeenCalled();
  });
});
