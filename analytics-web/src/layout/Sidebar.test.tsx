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
});