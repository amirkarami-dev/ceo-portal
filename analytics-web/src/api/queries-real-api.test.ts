// analytics-web/src/api/queries-real-api.test.ts
// Verifies that the report hooks delegate to reportsHttpApi when
// VITE_USE_MOCK_API="false", and stay on mockApi for all other values.
// Uses vi.mock to stub both backends; no localStorage or network I/O.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── stub both data backends ──────────────────────────────────────────────────

const mockApiList = vi.fn().mockResolvedValue([
  { id: "mock-rep", ownerName: "Mock", visibility: "private", updatedAt: "", definition: {} },
]);
const httpApiList = vi.fn().mockResolvedValue([
  { id: "http-rep", ownerName: "HTTP", visibility: "tenant", updatedAt: "", definition: {} },
]);
const httpApiGet = vi.fn().mockResolvedValue({
  id: "http-rep", ownerName: "HTTP", visibility: "tenant", updatedAt: "", definition: {},
});
const httpApiSave = vi.fn().mockResolvedValue({
  id: "http-saved", ownerName: "", visibility: "private", updatedAt: "", definition: {},
});

vi.mock("./mockApi", () => ({
  mockApi: {
    reports: {
      list: mockApiList,
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue({ id: "mock-saved" }),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    dashboards: { list: vi.fn().mockResolvedValue([]), get: vi.fn(), save: vi.fn(), remove: vi.fn() },
    providers: { list: vi.fn().mockResolvedValue([]) },
    users: { list: vi.fn().mockResolvedValue([]), save: vi.fn() },
    tenants: { list: vi.fn().mockResolvedValue([]), save: vi.fn() },
    audit: { list: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("./reportsHttpApi", () => ({
  reportsHttpApi: {
    list: httpApiList,
    get: httpApiGet,
    save: httpApiSave,
  },
}));

// Stub tenant store so hooks don't crash
vi.mock("../store/tenant-store", () => ({
  useTenantStore: () => null,
}));

// ── helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// ── useReports ────────────────────────────────────────────────────────────────

describe("useReports", () => {
  it("calls mockApi when VITE_USE_MOCK_API is not 'false' (default)", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    const { useReports } = await import("./queries");
    const { result } = renderHook(() => useReports(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiList).toHaveBeenCalled();
    expect(httpApiList).not.toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("mock-rep");
  });

  it("calls reportsHttpApi when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");

    const { useReports } = await import("./queries");
    const { result } = renderHook(() => useReports(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpApiList).toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("http-rep");
  });
});
