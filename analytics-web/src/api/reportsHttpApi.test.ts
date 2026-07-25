// analytics-web/src/api/reportsHttpApi.test.ts
// Tests for the real-API report fetchers.  httpClient is mocked so no network
// calls are made.  Verifies correct URL, request shape, and response mapping.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock httpClient before the module under test is imported.
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
import { reportsHttpApi } from "./reportsHttpApi";
import type { ReportDefinition } from "../contracts/report-definition";

const mockGet = vi.mocked(httpClient.get);
const mockPost = vi.mocked(httpClient.post);

const BACKEND_LIST = [
  {
    id: "rep-1",
    name: "Revenue Report",
    ownerName: "Alice",
    visibility: "tenant" as const,
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

const MINIMAL_DEF: ReportDefinition = {
  id: "rep-1",
  schemaVersion: "1",
  name: "Revenue Report",
  dataset: "ds-sales",
  columns: [],
  presentation: { views: [] },
};

describe("reportsHttpApi.list()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(BACKEND_LIST);
  });

  it("calls GET /api/Reports", async () => {
    await reportsHttpApi.list();
    expect(mockGet).toHaveBeenCalledWith("/api/Reports");
  });

  it("maps backend items to SavedReport shape", async () => {
    const result = await reportsHttpApi.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rep-1");
    expect(result[0].ownerName).toBe("Alice");
    expect(result[0].visibility).toBe("tenant");
  });
});

describe("reportsHttpApi.get()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(BACKEND_LIST);
  });

  it("returns the matching SavedReport by id", async () => {
    const result = await reportsHttpApi.get("rep-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("rep-1");
  });

  it("returns null when id not found", async () => {
    const result = await reportsHttpApi.get("does-not-exist");
    expect(result).toBeNull();
  });
});

describe("reportsHttpApi.save()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ id: "rep-new" });
  });

  it("calls POST /api/Reports with definition + name + visibility", async () => {
    await reportsHttpApi.save({
      definition: MINIMAL_DEF,
      name: "My Report",
      visibility: "private",
    });

    expect(mockPost).toHaveBeenCalledWith("/api/Reports", {
      definition: { ...MINIMAL_DEF, name: "My Report" },
      name: "My Report",
      visibility: "private",
    });
  });

  it("echoes back a SavedReport with the server-assigned id", async () => {
    const result = await reportsHttpApi.save({
      definition: MINIMAL_DEF,
      visibility: "tenant",
    });

    expect(result.id).toBe("rep-new");
    expect(result.visibility).toBe("tenant");
  });

  it("uses definition name when no name override provided", async () => {
    await reportsHttpApi.save({ definition: MINIMAL_DEF });
    expect(mockPost).toHaveBeenCalledWith(
      "/api/Reports",
      expect.objectContaining({ name: "Revenue Report" }),
    );
  });
});
