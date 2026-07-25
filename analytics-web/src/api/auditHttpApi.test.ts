// analytics-web/src/api/auditHttpApi.test.ts
// Tests for the real-API audit fetchers. httpClient is mocked so no
// network calls are made. Verifies correct URL, query params, and response mapping.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./httpClient", () => ({
  httpClient: {
    get: vi.fn(),
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
import { auditHttpApi } from "./auditHttpApi";

const mockGet = vi.mocked(httpClient.get);

const BACKEND_EVENTS = [
  {
    id: "ev-1",
    type: "ai.generate",
    actorName: "Alice",
    detail: "Generated report",
    occurredAtUtc: "2026-06-01T10:00:00Z",
    status: "success",
  },
  {
    id: "ev-2",
    type: "report.run",
    actorName: "Bob",
    detail: "Ran revenue report",
    occurredAtUtc: "2026-06-02T11:00:00Z",
  },
];

describe("auditHttpApi.list()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(BACKEND_EVENTS);
  });

  it("calls GET /api/Audit with no params when no filters given", async () => {
    await auditHttpApi.list();
    expect(mockGet).toHaveBeenCalledWith("/api/Audit");
  });

  it("appends type param when provided", async () => {
    await auditHttpApi.list({ type: "ai.generate" });
    expect(mockGet).toHaveBeenCalledWith("/api/Audit?type=ai.generate");
  });

  it("appends status param when provided", async () => {
    await auditHttpApi.list({ status: "success" });
    expect(mockGet).toHaveBeenCalledWith("/api/Audit?status=success");
  });

  it("appends both type and status params when both provided", async () => {
    await auditHttpApi.list({ type: "ai.generate", status: "success" });
    // URLSearchParams ordering is insertion order
    expect(mockGet).toHaveBeenCalledWith("/api/Audit?type=ai.generate&status=success");
  });

  it("maps backend items to AuditRow shape", async () => {
    const result = await auditHttpApi.list();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("ev-1");
    expect(result[0].type).toBe("ai.generate");
    expect(result[0].actorId).toBe("Alice");
    expect(result[0].ts).toBe("2026-06-01T10:00:00Z");
    expect(result[0].tenantId).toBe("");
  });

  it("maps second item without status", async () => {
    const result = await auditHttpApi.list();
    expect(result[1].id).toBe("ev-2");
    expect(result[1].actorId).toBe("Bob");
  });
});
