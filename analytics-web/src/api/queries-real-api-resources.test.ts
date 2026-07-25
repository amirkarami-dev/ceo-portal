// analytics-web/src/api/queries-real-api-resources.test.ts
// Verifies that dashboard/provider/audit hooks delegate to their HTTP APIs when
// VITE_USE_MOCK_API="false", and stay on mockApi for all other values.
// Uses vi.mock to stub both backends; no localStorage or network I/O.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── stub mockApi ──────────────────────────────────────────────────────────────

const mockDashboardsList = vi.fn().mockResolvedValue([
  { id: "mock-dash", name: "Mock Dashboard", widgets: [], layout: [],
    ownerName: "Mock", tenantId: "t1", createdAt: "", updatedAt: "" },
]);
const mockProvidersList = vi.fn().mockResolvedValue([
  { id: "mock-prov", tenantId: "t1", type: "OpenAI", model: "gpt-4o-mini", status: "active" },
]);
const mockAuditList = vi.fn().mockResolvedValue([
  { id: "mock-ev", tenantId: "t1", actorId: "u-1", type: "ai.generate", ts: "2026-06-01T00:00:00Z" },
]);

vi.mock("./mockApi", () => ({
  mockApi: {
    reports: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue({ id: "mock-saved" }),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    dashboards: {
      list: mockDashboardsList,
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue({ id: "mock-dash-saved" }),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    providers: { list: mockProvidersList },
    users: { list: vi.fn().mockResolvedValue([]), save: vi.fn() },
    tenants: { list: vi.fn().mockResolvedValue([]), save: vi.fn() },
    audit: { list: mockAuditList },
  },
}));

// ── stub HTTP APIs ────────────────────────────────────────────────────────────

const httpDashboardsList = vi.fn().mockResolvedValue([
  { id: "http-dash", name: "HTTP Dashboard", widgets: [], layout: [],
    ownerName: "HTTP", tenantId: "", createdAt: "", updatedAt: "" },
]);
const httpDashboardsGet = vi.fn().mockResolvedValue({
  id: "http-dash", name: "HTTP Dashboard", widgets: [], layout: [],
  ownerName: "HTTP", tenantId: "", createdAt: "", updatedAt: "",
});

vi.mock("./dashboardsHttpApi", () => ({
  dashboardsHttpApi: {
    list: httpDashboardsList,
    get: httpDashboardsGet,
    create: vi.fn().mockResolvedValue({ id: "http-dash-new", name: "New", widgets: [], layout: [], ownerName: "", tenantId: "", createdAt: "", updatedAt: "" }),
    save: vi.fn().mockResolvedValue({ id: "http-dash", name: "Saved", widgets: [], layout: [], ownerName: "", tenantId: "", createdAt: "", updatedAt: "" }),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}));

const httpProvidersList = vi.fn().mockResolvedValue([
  { id: "http-prov", tenantId: "", type: "OpenAI", model: "gpt-4o", status: "active" },
]);

vi.mock("./aiProvidersHttpApi", () => ({
  aiProvidersHttpApi: {
    list: httpProvidersList,
    upsert: vi.fn().mockResolvedValue(undefined),
  },
}));

const httpAuditList = vi.fn().mockResolvedValue([
  { id: "http-ev", tenantId: "", actorId: "Alice", type: "ai.generate", ts: "2026-06-01T00:00:00Z" },
]);

vi.mock("./auditHttpApi", () => ({
  auditHttpApi: {
    list: httpAuditList,
  },
}));

vi.mock("./reportsHttpApi", () => ({
  reportsHttpApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({ id: "http-rep-saved" }),
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

// ── useDashboards ─────────────────────────────────────────────────────────────

describe("useDashboards", () => {
  it("calls mockApi when VITE_USE_MOCK_API is not 'false' (default)", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    const { useDashboards } = await import("./queries");
    const { result } = renderHook(() => useDashboards(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDashboardsList).toHaveBeenCalled();
    expect(httpDashboardsList).not.toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("mock-dash");
  });

  it("calls dashboardsHttpApi when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");

    const { useDashboards } = await import("./queries");
    const { result } = renderHook(() => useDashboards(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpDashboardsList).toHaveBeenCalled();
    expect(mockDashboardsList).not.toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("http-dash");
  });
});

// ── useDashboard ──────────────────────────────────────────────────────────────

describe("useDashboard", () => {
  it("calls mockApi.dashboards.get when VITE_USE_MOCK_API is not 'false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    const { mockApi } = await import("./mockApi");

    const { useDashboard } = await import("./queries");
    const { result } = renderHook(() => useDashboard("dash-1"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(mockApi.dashboards.get)).toHaveBeenCalledWith("dash-1");
    expect(httpDashboardsGet).not.toHaveBeenCalled();
  });

  it("calls dashboardsHttpApi.get when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");

    const { useDashboard } = await import("./queries");
    const { result } = renderHook(() => useDashboard("http-dash"), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpDashboardsGet).toHaveBeenCalledWith("http-dash");
  });
});

// ── useProviders ──────────────────────────────────────────────────────────────

describe("useProviders", () => {
  it("calls mockApi when VITE_USE_MOCK_API is not 'false' (default)", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    const { useProviders } = await import("./queries");
    const { result } = renderHook(() => useProviders(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockProvidersList).toHaveBeenCalled();
    expect(httpProvidersList).not.toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("mock-prov");
  });

  it("calls aiProvidersHttpApi when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");

    const { useProviders } = await import("./queries");
    const { result } = renderHook(() => useProviders(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpProvidersList).toHaveBeenCalled();
    expect(mockProvidersList).not.toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("http-prov");
  });
});

// ── useAudit ──────────────────────────────────────────────────────────────────

describe("useAudit", () => {
  it("calls mockApi when VITE_USE_MOCK_API is not 'false' (default)", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    const { useAudit } = await import("./queries");
    const { result } = renderHook(() => useAudit(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAuditList).toHaveBeenCalled();
    expect(httpAuditList).not.toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("mock-ev");
  });

  it("calls auditHttpApi when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");

    const { useAudit } = await import("./queries");
    const { result } = renderHook(() => useAudit(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpAuditList).toHaveBeenCalled();
    expect(mockAuditList).not.toHaveBeenCalled();
    expect(result.current.data?.[0]?.id).toBe("http-ev");
  });
});

// ── useAuditEvents ────────────────────────────────────────────────────────────

describe("useAuditEvents", () => {
  it("calls mockApi when VITE_USE_MOCK_API is not 'false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    const { useAuditEvents } = await import("./queries");
    const { result } = renderHook(() => useAuditEvents({ type: "ai.generate" }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAuditList).toHaveBeenCalled();
    expect(httpAuditList).not.toHaveBeenCalled();
  });

  it("calls auditHttpApi.list with type/status filters when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");

    const { useAuditEvents } = await import("./queries");
    const { result } = renderHook(
      () => useAuditEvents({ type: "ai.generate", status: "success" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpAuditList).toHaveBeenCalledWith({ type: "ai.generate", status: "success" });
    expect(mockAuditList).not.toHaveBeenCalled();
  });
});

// ── useUsers — stays on mock regardless ───────────────────────────────────────

describe("useUsers (stays on mock)", () => {
  it("calls mockApi.users.list even when VITE_USE_MOCK_API='false'", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    const { mockApi } = await import("./mockApi");

    const { useUsers } = await import("./queries");
    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(mockApi.users.list)).toHaveBeenCalled();
  });
});
