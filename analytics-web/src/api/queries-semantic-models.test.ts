// analytics-web/src/api/queries-semantic-models.test.ts
// Verifies that useSemanticModels delegates to semanticModelsHttpApi when
// VITE_USE_MOCK_API="false" and stays on the static registry otherwise.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const httpModelsList = vi.fn().mockResolvedValue([
  {
    id: "farsnezam-projects",
    tenantId: "global",
    name: { "fa-IR": "FarsNezam", "en-US": "FarsNezam" },
    defaultLocale: "fa-IR",
    version: 1,
    entities: [],
  },
]);

vi.mock("./semanticModelsHttpApi", () => ({
  semanticModelsHttpApi: {
    list: httpModelsList,
  },
}));

// Minimal stubs for unused imports in queries.ts
vi.mock("./mockApi", () => ({
  mockApi: {
    reports: { list: vi.fn().mockResolvedValue([]), get: vi.fn(), save: vi.fn(), remove: vi.fn() },
    dashboards: { list: vi.fn().mockResolvedValue([]), get: vi.fn(), save: vi.fn(), remove: vi.fn() },
    providers: { list: vi.fn().mockResolvedValue([]) },
    users: { list: vi.fn().mockResolvedValue([]), save: vi.fn() },
    tenants: { list: vi.fn().mockResolvedValue([]), save: vi.fn() },
    audit: { list: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("./reportsHttpApi", () => ({ reportsHttpApi: { list: vi.fn(), get: vi.fn(), save: vi.fn() } }));
vi.mock("./dashboardsHttpApi", () => ({ dashboardsHttpApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), save: vi.fn(), remove: vi.fn() } }));
vi.mock("./aiProvidersHttpApi", () => ({ aiProvidersHttpApi: { list: vi.fn() } }));
vi.mock("./auditHttpApi", () => ({ auditHttpApi: { list: vi.fn() } }));
vi.mock("../store/tenant-store", () => ({ useTenantStore: () => null }));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("useSemanticModels", () => {
  it("returns static bundled models when VITE_USE_MOCK_API is not 'false' (default)", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    const { useSemanticModels } = await import("./queries");
    const { result } = renderHook(() => useSemanticModels(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Bundled registry has 3 static models (project, sales, finance)
    expect(result.current.data?.length).toBeGreaterThanOrEqual(1);
    expect(httpModelsList).not.toHaveBeenCalled();
  });

  it("calls semanticModelsHttpApi.list when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");

    const { useSemanticModels } = await import("./queries");
    const { result } = renderHook(() => useSemanticModels(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpModelsList).toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("farsnezam-projects");
  });
});
