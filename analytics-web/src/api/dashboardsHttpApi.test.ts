// analytics-web/src/api/dashboardsHttpApi.test.ts
// Tests for the real-API dashboard fetchers. httpClient is mocked so no
// network calls are made. Verifies correct URL, verb, and response mapping.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./httpClient", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
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
import { dashboardsHttpApi } from "./dashboardsHttpApi";

const mockGet = vi.mocked(httpClient.get);
const mockPost = vi.mocked(httpClient.post);
const mockDelete = vi.mocked(httpClient.delete);

const BACKEND_DASHBOARD = {
  id: "dash-1",
  name: "Executive Dashboard",
  widgets: [{ i: "w1", reportId: "rep-1", viewIndex: 0, title: "Revenue" }],
  layout: [{ i: "w1", x: 0, y: 0, w: 6, h: 4 }],
  ownerName: "Alice",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("dashboardsHttpApi.list()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue([BACKEND_DASHBOARD]);
  });

  it("calls GET /api/Dashboards", async () => {
    await dashboardsHttpApi.list();
    expect(mockGet).toHaveBeenCalledWith("/api/Dashboards");
  });

  it("maps backend items to DashboardRecord shape", async () => {
    const result = await dashboardsHttpApi.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dash-1");
    expect(result[0].name).toBe("Executive Dashboard");
    expect(result[0].ownerName).toBe("Alice");
    expect(result[0].widgets).toHaveLength(1);
    expect(result[0].layout).toHaveLength(1);
  });
});

describe("dashboardsHttpApi.get()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(BACKEND_DASHBOARD);
  });

  it("calls GET /api/Dashboards/{id}", async () => {
    await dashboardsHttpApi.get("dash-1");
    expect(mockGet).toHaveBeenCalledWith("/api/Dashboards/dash-1");
  });

  it("maps backend item to DashboardRecord shape", async () => {
    const result = await dashboardsHttpApi.get("dash-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("dash-1");
  });

  it("returns null on error (e.g. 404)", async () => {
    mockGet.mockRejectedValue(new Error("Not Found"));
    const result = await dashboardsHttpApi.get("does-not-exist");
    expect(result).toBeNull();
  });
});

describe("dashboardsHttpApi.create()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ id: "dash-new" });
  });

  it("calls POST /api/Dashboards with name and empty widgets/layout", async () => {
    await dashboardsHttpApi.create({ name: "My Dashboard" });
    expect(mockPost).toHaveBeenCalledWith("/api/Dashboards", {
      name: "My Dashboard",
      widgets: [],
      layout: [],
    });
  });

  it("returns a DashboardRecord with the server-assigned id", async () => {
    const result = await dashboardsHttpApi.create({ name: "My Dashboard" });
    expect(result.id).toBe("dash-new");
    expect(result.name).toBe("My Dashboard");
    expect(result.widgets).toEqual([]);
  });
});

describe("dashboardsHttpApi.save()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ id: "dash-1" });
  });

  it("calls POST /api/Dashboards with widgets and layout", async () => {
    const dashboard = {
      id: "dash-1",
      tenantId: "t1",
      name: "Updated",
      widgets: [{ i: "w1", reportId: "r1", viewIndex: 0, title: "T" }],
      layout: [{ i: "w1", x: 0, y: 0, w: 4, h: 3 }],
      ownerName: "Alice",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    await dashboardsHttpApi.save(dashboard);
    expect(mockPost).toHaveBeenCalledWith("/api/Dashboards", {
      name: "Updated",
      widgets: dashboard.widgets,
      layout: dashboard.layout,
    });
  });

  it("sends the numeric id so the backend updates instead of duplicating", async () => {
    const dashboard = {
      id: "7",
      tenantId: "t1",
      name: "Updated",
      widgets: [],
      layout: [],
      ownerName: "Alice",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    await dashboardsHttpApi.save(dashboard);
    expect(mockPost).toHaveBeenCalledWith("/api/Dashboards", {
      id: 7,
      name: "Updated",
      widgets: [],
      layout: [],
    });
  });
});

describe("dashboardsHttpApi.remove()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue(undefined);
  });

  it("calls DELETE /api/Dashboards/{id}", async () => {
    await dashboardsHttpApi.remove("dash-1");
    expect(mockDelete).toHaveBeenCalledWith("/api/Dashboards/dash-1");
  });
});
