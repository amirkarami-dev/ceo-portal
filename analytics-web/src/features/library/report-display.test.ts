import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/auth/useAuth";
import { reportOwnerLabel } from "./report-display";

const user: SessionUser = {
  id: "748ec011-1476-4aa6-bfac-24837ca6076a",
  name: "Analytics User",
  email: "user@example.com",
  roles: ["Viewer"],
  tenantId: "default",
};

describe("reportOwnerLabel", () => {
  it("uses the current user's display name instead of their subject id", () => {
    expect(reportOwnerLabel(user.id, user, "Organization user")).toBe("Analytics User");
  });

  it("does not expose another user's subject id", () => {
    expect(
      reportOwnerLabel("0986f66d-c70b-42d2-881a-7cc49b2d91ec", user, "Organization user"),
    ).toBe("Organization user");
  });

  it("keeps an existing human-readable owner name", () => {
    expect(reportOwnerLabel("Sara Ahmadi", user, "Organization user")).toBe("Sara Ahmadi");
  });
});