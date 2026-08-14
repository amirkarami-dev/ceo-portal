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

describe("Topbar — the organisation switcher is gone", () => {
  it("is not shown, however many organisations exist", () => {
    // Hiding it only for a single tenant was not enough: production returns more than one, so the
    // control kept appearing while still changing nothing — in real mode the choice is never sent
    // to the server, which scopes by the tenant claim in the token.
    for (const list of [
      [],
      [{ id: "t1", displayName: "نظام مهندسی کردستان" }],
      [
        { id: "t1", displayName: "نظام مهندسی کردستان" },
        { id: "t2", displayName: "شرکت آلفا" },
      ],
    ]) {
      tenants.list = list;
      const { unmount } = render(<Topbar />, { wrapper });
      expect(
        screen.queryAllByLabelText("انتخاب سازمان"),
        `${list.length} tenant(s)`,
      ).toHaveLength(0);
      unmount();
    }
  });

  it("still draws the rest of the bar", () => {
    tenants.list = [{ id: "t1", displayName: "نظام مهندسی کردستان" }];
    render(<Topbar />, { wrapper });

    // Removing the select must not take the header with it — the language toggle is next to it.
    expect(screen.getByText("EN")).toBeInTheDocument();
  });
});
