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

    // It used to be a menu row wearing a green pill — a patch for being given the same
    // weight as «تنظیمات». It is a tile now, and the pill is gone with it.
    const ask = screen.getByText(/Ask AI|گزارش‌ساز هوشمند/i);
    const tile = ask.closest("a");
    expect(tile).toHaveClass("sidebar-primary__tile");
    expect(tile).toHaveAttribute("href", "/ask");
    expect(ask.closest("li")).toBeNull();

    await user.click(ask);

    expect(screen.getByTestId("location")).toHaveTextContent("/ask");
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  // The panel used to start with a clickable row against the top edge, which is what
  // made it feel unfinished. These guard the head being there, and being there once.
  it("names the service at the top of the panel", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboards"]}>
            <Sidebar />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    );
    const head = container.querySelector(".sidebar-head");
    expect(head).toBeInTheDocument();
    expect(head).toHaveTextContent(/تحلیل داده|Analytics/);
    // Order matters: the service, then the three destinations, then the rest of the menu.
    // antd's Menu leaves a hidden measurement node at the end; it is not part of the order.
    const shell = [...(head?.parentElement?.children ?? [])]
      .filter((el) => !(el as HTMLElement).hasAttribute("aria-hidden"))
      .map((el) => el.className.toString().split(" ")[0] || el.id);
    expect(shell).toEqual(["sidebar-head", "sidebar-primary", "ant-menu"]);
  });

  it("leaves the head out of the mobile drawer, which has its own title bar", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboards"]}>
            <Sidebar head={false} />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector(".sidebar-head")).toBeNull();
    expect(container.querySelector("#app-sidebar-nav")).toBeInTheDocument();
  });

  it("drops the service name but keeps the mark in the rail", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboards"]}>
            <Sidebar collapsed />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector(".sidebar-head--rail")).toBeInTheDocument();
    expect(container.querySelector(".sidebar-head__name")).toBeNull();
    expect(container.querySelector(".sidebar-head__mark")).toBeInTheDocument();
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