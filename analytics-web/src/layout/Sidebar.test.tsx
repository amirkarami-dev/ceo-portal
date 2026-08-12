import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { i18n } from "@/i18n";
import { Sidebar } from "./Sidebar";

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("Sidebar", () => {
  it("shows Ask AI as a primary entry and navigates to /ask", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboards"]}>
            <Sidebar onNavigate={onNavigate} />
            <LocationProbe />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    );

    const ask = screen.getByText(/Ask AI|گزارش‌ساز هوشمند/i);
    expect(ask.closest("li")).toHaveClass("app-sidebar__featured");

    await user.click(ask);

    expect(screen.getByTestId("location")).toHaveTextContent("/ask");
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  // The words «محتوا», «داده» and «خروجی» have nowhere to go in an 80px rail, so they are
  // dropped and a rule carries the grouping instead. This guards the swap, not the styling —
  // jsdom does no layout, so the rail's geometry is checked in a browser, not here.
  it("drops the group titles for dividers when collapsed", () => {
    const shell = (collapsed: boolean) => (
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboards"]}>
            <Sidebar collapsed={collapsed} />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    );

    const open = render(shell(false));
    const titles = open.container.querySelectorAll(".ant-menu-item-group-title");
    expect(titles.length).toBeGreaterThan(0);
    expect(open.container.querySelectorAll(".ant-menu-item-divider")).toHaveLength(0);
    const itemsWhenOpen = open.container.querySelectorAll(".ant-menu-item").length;
    open.unmount();

    const rail = render(shell(true));
    expect(rail.container.querySelectorAll(".ant-menu-item-group-title")).toHaveLength(0);
    expect(rail.container.querySelectorAll(".ant-menu-item-divider").length).toBeGreaterThan(0);
    // Nothing may be lost on the way into the rail — same destinations, fewer words.
    expect(rail.container.querySelectorAll(".ant-menu-item")).toHaveLength(itemsWhenOpen);
  });
});