import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { i18n } from "@/i18n";
import { AuthProvider } from "@/auth/AuthProvider";
import { Topbar } from "./Topbar";

const tenants = vi.hoisted(() => ({ list: [] as { id: string; displayName: string }[] }));
vi.mock("../api/queries", () => ({
  useTenants: () => ({ data: tenants.list }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <I18nextProvider i18n={i18n}>
      <AuthProvider>{children}</AuthProvider>
    </I18nextProvider>
  </MemoryRouter>
);

beforeEach(async () => {
  await i18n.changeLanguage("fa");
  localStorage.clear();
});

describe("Topbar — the organisation switcher", () => {
  it("is hidden when there is only one organisation", () => {
    tenants.list = [{ id: "t1", displayName: "نظام مهندسی کردستان" }];
    render(<Topbar />, { wrapper });

    // With one tenant it looked like it changed organisation and did not: in real mode the choice
    // is never sent to the server, which scopes by the tenant claim in the token.
    expect(screen.queryAllByLabelText("انتخاب سازمان")).toHaveLength(0);
  });

  it("appears as soon as there is a second one", () => {
    tenants.list = [
      { id: "t1", displayName: "نظام مهندسی کردستان" },
      { id: "t2", displayName: "شرکت آلفا" },
    ];
    render(<Topbar />, { wrapper });

    // Data-driven, not a flag: nothing has to be remembered and switched back on later.
    // antd labels both the inner input and the placeholder, so this matches more than once.
    expect(screen.getAllByLabelText("انتخاب سازمان").length).toBeGreaterThan(0);
  });

  it("is hidden when the tenant list has not arrived yet", () => {
    tenants.list = [];
    render(<Topbar />, { wrapper });
    // An empty select that fills in a moment later is its own small annoyance.
    expect(screen.queryAllByLabelText("انتخاب سازمان")).toHaveLength(0);
  });
});
