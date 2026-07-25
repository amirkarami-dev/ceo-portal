import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AuthProvider } from "../auth/AuthProvider";
import { i18n } from "../i18n";
import { tokens } from "../theme/theme";
import { ForbiddenScreen, RequireAuth, RequireRole } from "../auth/routes";
import { PagePlaceholder } from "./PagePlaceholder";
import { setMockUser } from "../auth/mock-user";

// Minimal provider wrapper that avoids the full Providers (which adds RouterProvider).
// We use MemoryRouter directly so that Navigate/Outlet work without data-router concerns.
function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  return (
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider mode="light" brand={{ primary: tokens.primary }} dir="rtl" locale="fa">
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

describe("router guards", () => {
  beforeEach(() => localStorage.clear());

  it("renders /ask for an authed PowerUser", async () => {
    setMockUser(["PowerUser"]);
    render(
      <TestWrapper>
        <MemoryRouter initialEntries={["/ask"]}>
          <Routes>
            <Route path="/403" element={<ForbiddenScreen />} />
            <Route path="/login" element={<div>LoginScreen</div>} />
            <Route element={<RequireAuth />}>
              <Route path="ask" element={<PagePlaceholder name="AskAIScreen" />} />
              <Route
                path="admin"
                element={<RequireRole allow={["SuperAdmin", "TenantAdmin", "AIManager"]} />}
              >
                <Route index element={<PagePlaceholder name="AdminOverview" />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </TestWrapper>,
    );
    await waitFor(
      () => expect(screen.getByText("AskAIScreen")).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it("redirects a Viewer away from /admin to /403", async () => {
    setMockUser(["Viewer"]);
    render(
      <TestWrapper>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route path="/403" element={<ForbiddenScreen />} />
            <Route path="/login" element={<div>LoginScreen</div>} />
            <Route element={<RequireAuth />}>
              <Route path="ask" element={<PagePlaceholder name="AskAIScreen" />} />
              <Route
                path="admin"
                element={<RequireRole allow={["SuperAdmin", "TenantAdmin", "AIManager"]} />}
              >
                <Route index element={<PagePlaceholder name="AdminOverview" />} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </TestWrapper>,
    );
    // ForbiddenScreen renders an Antd Result with title "403"
    await waitFor(
      () => expect(screen.getByText("403")).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
