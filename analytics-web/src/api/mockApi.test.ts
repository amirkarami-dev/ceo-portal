import { describe, it, expect, beforeEach } from "vitest";
import { mockApi } from "./mockApi";

describe("mockApi", () => {
  beforeEach(() => {
    localStorage.clear();
    mockApi.resetDemoData();
  });

  it("seeds and lists reports (SavedReport envelopes) scoped by tenant", async () => {
    const acme = await mockApi.reports.list("tenant-acme");
    expect(acme.length).toBeGreaterThan(0);
    expect(acme.every((r) => r.tenantId === "tenant-acme")).toBe(true);
    // each row is a SavedReport: a definition envelope, not a bare ReportDefinition
    expect(acme[0].definition).toBeDefined();
    expect(acme[0].definition.dataset).toBeDefined();
    const beta = await mockApi.reports.list("tenant-beta");
    expect(beta.every((r) => r.tenantId === "tenant-beta")).toBe(true);
  });

  it("save inserts new and updates existing; remove deletes", async () => {
    const created = await mockApi.reports.save({
      id: "",
      tenantId: "tenant-acme",
      ownerName: "آرش مدیری",
      visibility: "tenant",
      updatedAt: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      definition: { id: "", schemaVersion: "1.0", name: "نو", dataset: "projects", columns: [], presentation: { views: [] } } as any,
    });
    expect(created.id).not.toBe("");
    const fetched = await mockApi.reports.get(created.id);
    expect(fetched?.definition.name).toBe("نو");
    await mockApi.reports.save({ ...created, definition: { ...created.definition, name: "ویرایش‌شده" } });
    expect((await mockApi.reports.get(created.id))?.definition.name).toBe("ویرایش‌شده");
    await mockApi.reports.remove(created.id);
    expect(await mockApi.reports.get(created.id)).toBeNull();
  });

  it("save() update branch returns stamped entity (non-empty updatedAt matching stored record)", async () => {
    // Insert
    const created = await mockApi.reports.save({
      id: "",
      tenantId: "tenant-acme",
      ownerName: "تست",
      visibility: "tenant",
      updatedAt: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      definition: { id: "", schemaVersion: "1.0", name: "اولیه", dataset: "projects", columns: [], presentation: { views: [] } } as any,
    });
    // Update with stale/empty updatedAt — the returned value MUST have a fresh stamp
    const updated = await mockApi.reports.save({ ...created, updatedAt: "" });
    expect(updated.updatedAt).not.toBe("");
    // The returned stamp must equal what is actually stored
    const stored = await mockApi.reports.get(created.id);
    expect(updated.updatedAt).toBe(stored?.updatedAt);
  });

  it("tenants/users/providers/audit collections seed", async () => {
    expect((await mockApi.tenants.list()).length).toBe(2);
    expect((await mockApi.users.list("tenant-acme")).length).toBeGreaterThan(0);
    expect((await mockApi.providers.list("tenant-acme")).length).toBeGreaterThan(0);
    expect((await mockApi.audit.list("tenant-acme")).length).toBeGreaterThan(0);
  });
});
