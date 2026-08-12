import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpClient } from "./httpClient";
import { reportsHttpApi } from "./reportsHttpApi";

/** What GET /api/Reports actually sends: SavedReportDto has `int Id`, so this is a number. */
const backendRow = {
  id: 2,
  name: "تعداد مهندسان هر رشته",
  ownerName: "کاربر سازمان",
  visibility: "private" as const,
  updatedAt: "2026-08-12T00:00:00Z",
  definition: { name: "", dataset: "oz_info" },
};

describe("reportsHttpApi", () => {
  beforeEach(() => {
    vi.spyOn(httpClient, "get").mockResolvedValue([backendRow] as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The bug: opening a report from the library answered «گزارش یافت نشد» while the
  // same report rendered inside a dashboard widget. A route param is a string, the
  // backend id is a number, and `2 === "2"` is false.
  it("finds a report when the route param is a string and the id is a number", async () => {
    await expect(reportsHttpApi.get("2")).resolves.toMatchObject({ id: "2" });
  });

  // Dashboards saved before the fix hold their widget's reportId as a number, and
  // WidgetFrame passes it straight to useReport. Those must keep resolving.
  it("still finds it when asked with the number a saved widget holds", async () => {
    await expect(reportsHttpApi.get(2 as unknown as string)).resolves.toMatchObject({ id: "2" });
  });

  it("returns null for an id that is not there, rather than the first row", async () => {
    await expect(reportsHttpApi.get("999")).resolves.toBeNull();
  });

  // Everything downstream — route links, table keys, widget reportIds — expects a
  // string, so the number is converted at the one place it arrives.
  it("hands out string ids from the list", async () => {
    const list = await reportsHttpApi.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("2");
    expect(typeof list[0].id).toBe("string");
  });

  it("reads the bare number POST /api/Reports returns, not a wrapper object", async () => {
    // The endpoint is Task<Ok<int>>: the body is `7`, not `{ id: 7 }`.
    vi.spyOn(httpClient, "post").mockResolvedValue(7 as never);

    const saved = await reportsHttpApi.save({
      definition: { name: "تازه", dataset: "oz_info" } as never,
    });

    expect(saved.id).toBe("7");
  });
});
