import { describe, it, expect, expectTypeOf } from "vitest";
import {
  ROLE_PERMISSIONS,
  permissionsFor,
  can,
  isGlobal,
  mapLegacyRoles,
} from "@/contracts";
import type {
  FieldType,
  Aggregation,
  ReportDefinition,
  QueryResult,
  Row,
  ResultRow,
  SessionUser,
  AppRole,
  Permission,
} from "@/contracts";

describe("contracts/common (R1)", () => {
  it("FieldType is the reconciled 4-member union (no dimension/measure)", () => {
    expectTypeOf<FieldType>().toEqualTypeOf<"string" | "number" | "date" | "boolean">();
  });

  it("Aggregation is the R1 7-member union", () => {
    expectTypeOf<Aggregation>().toEqualTypeOf<
      "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "none"
    >();
  });
});

describe("contracts/rbac (§10.5)", () => {
  it("AIManager cannot write reports but can manage AI + read audit", () => {
    const perms = permissionsFor(["AIManager"]);
    expect(can(perms, "ai:manage")).toBe(true);
    expect(can(perms, "audit:read")).toBe(true);
    expect(can(perms, "reports:write")).toBe(false);
    expect(can(perms, "data:export")).toBe(false);
  });

  it("effective permissions are the UNION over multiple roles", () => {
    const perms = permissionsFor(["ReportDesigner", "DashboardDesigner"]);
    expect(can(perms, "reports:write")).toBe(true);
    expect(can(perms, "reports:delete")).toBe(true); // from ReportDesigner
  });

  it("a tenant grant (Viewer export) is merged in", () => {
    const perms = permissionsFor(["Viewer"], ["data:export"]);
    expect(can(perms, "reports:execute")).toBe(true);
    expect(can(perms, "data:export")).toBe(true);
  });

  it("isGlobal is true only for SuperAdmin", () => {
    expect(isGlobal(["SuperAdmin"])).toBe(true);
    expect(isGlobal(["TenantAdmin", "AIManager"])).toBe(false);
  });

  it("every AppRole has an entry in ROLE_PERMISSIONS", () => {
    const roles: AppRole[] = [
      "SuperAdmin",
      "TenantAdmin",
      "AIManager",
      "ReportDesigner",
      "DashboardDesigner",
      "PowerUser",
      "Viewer",
    ];
    for (const r of roles) expect(Array.isArray(ROLE_PERMISSIONS[r])).toBe(true);
  });
});

describe("contracts/rbac mapLegacyRoles (§10.8)", () => {
  it("native report.* claims win and strip the prefix", () => {
    expect(mapLegacyRoles(["report.TenantAdmin", "report.AIManager"])).toEqual([
      "TenantAdmin",
      "AIManager",
    ]);
  });

  it("legacy Administrator → SuperAdmin, User → PowerUser", () => {
    expect(mapLegacyRoles(["Administrator"])).toEqual(["SuperAdmin"]);
    expect(mapLegacyRoles(["User"])).toEqual(["PowerUser"]);
  });

  it("unknown / empty resolves to Viewer (default-deny)", () => {
    expect(mapLegacyRoles([])).toEqual(["Viewer"]);
    expect(mapLegacyRoles(["something-else"])).toEqual(["Viewer"]);
  });
});

describe("contracts/rbac mapLegacyRoles guard (fix #1)", () => {
  it("unknown report.* suffix is silently dropped; result falls back to Viewer", () => {
    // "HackerRole" is not a real AppRole — the unsafe cast would have let it through
    expect(mapLegacyRoles(["report.HackerRole"])).toEqual(["Viewer"]);
  });

  it("known report.* suffix (AIManager) is accepted", () => {
    expect(mapLegacyRoles(["report.AIManager"])).toContain("AIManager");
  });
});

describe("contracts/common type-guards (R1 negative)", () => {
  it('"dimension" is NOT assignable to FieldType', () => {
    expectTypeOf<"dimension">().not.toMatchTypeOf<FieldType>();
  });

  it('"measure" is NOT assignable to FieldType', () => {
    expectTypeOf<"measure">().not.toMatchTypeOf<FieldType>();
  });
});

describe("contracts shapes type-check (R2/R3/R6)", () => {
  it("a fully-formed ReportDefinition literal satisfies the contract", () => {
    const def: ReportDefinition = {
      id: "rep-1",
      schemaVersion: "1.0",
      name: "درآمد ماهانه به تفکیک استان",
      dataset: "sales",
      columns: [
        { field: "province", type: "string" },
        { field: "amount", type: "number" },
      ],
      filters: [{ field: "amount", operator: "gt", value: 0 }],
      groupBy: [{ field: "province" }, { field: "order_date", dateBucket: "month" }],
      metrics: [{ field: "amount", aggregation: "sum", alias: "total_revenue" }],
      sorting: [{ field: "order_date", direction: "asc" }],
      presentation: {
        views: [
          {
            type: "chart",
            library: "recharts",
            component: "LineChart",
            mapping: { x: "order_date", y: ["total_revenue"], series: "province" },
          },
        ],
      },
    };
    expect(def.dataset).toBe("sales");
    expect(def.presentation.views[0].library).toBe("recharts");
  });

  it("Row allows boolean|null but ResultRow does not allow boolean", () => {
    const row: Row = { a: "x", b: 1, c: true, d: null };
    const result: ResultRow = { a: "x", b: 1, d: null };
    expectTypeOf(row.c).toEqualTypeOf<string | number | boolean | null>();
    expectTypeOf(result.a).toEqualTypeOf<string | number | null>();
  });

  it("a QueryResult literal satisfies the R3 contract", () => {
    const qr: QueryResult = {
      columns: [
        { key: "province", label: "استان", type: "string", isMetric: false },
        { key: "total_revenue", label: "درآمد", type: "number", isMetric: true },
      ],
      rows: [{ province: "تهران", total_revenue: 1000 }],
      total: 1,
    };
    expect(qr.total).toBe(1);
    expect(qr.columns[1].isMetric).toBe(true);
  });

  it("SessionUser holds roles + tenant + optional grants (R6)", () => {
    const user: SessionUser = {
      id: "u1",
      name: "کاربر نمونه",
      email: "u1@example.com",
      roles: ["PowerUser"] as AppRole[],
      tenantId: "t-alpha",
      grants: ["data:export"] as Permission[],
    };
    expect(user.roles).toContain("PowerUser");
  });
});
