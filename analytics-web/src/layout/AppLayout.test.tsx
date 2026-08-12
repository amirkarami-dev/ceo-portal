import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { setMockUser } from "@/auth/mock-user";
import { i18n } from "@/i18n";
import { useUiStore } from "@/store/ui-store";
import { AppLayout } from "./AppLayout";

function renderLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/dashboards"]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/dashboards" element={<button type="button">page content</button>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("AppLayout", () => {
  beforeEach(() => {
    setMockUser(["DashboardDesigner"]);
    // The global stub answers `false` to everything, which makes antd's useBreakpoint
    // report a phone — and on a phone there is no sider at all, only the drawer. These
    // tests are about the desktop column order, so say yes to the min-width queries.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The sider used to be rendered *after* the main column in Persian, with
  // flex-direction: row-reverse putting it back on the right — two mechanisms
  // cancelling out. The cost was invisible until you used a keyboard: navigation came
  // after every control on the page. `direction` alone places it now, so the sider is
  // first in both languages, and that is what this guards.
  it.each(["rtl", "ltr"] as const)("renders the sider before the content in %s", (dir) => {
    useUiStore.setState({ dir, locale: dir === "rtl" ? "fa" : "en" });
    const { container } = renderLayout();

    const sider = container.querySelector(".ant-layout-sider");
    const outer = sider?.parentElement;
    const children = [...(outer?.children ?? [])];
    const siderAt = children.indexOf(sider as Element);
    // The inner Layout holding the header and the page.
    const mainAt = children.findIndex((el) => el !== sider && el.querySelector("main"));

    expect(siderAt).toBeGreaterThanOrEqual(0);
    expect(mainAt).toBeGreaterThanOrEqual(0);
    expect(siderAt).toBeLessThan(mainAt);
  });

  it("does not reverse the row any more — direction does the placing", () => {
    useUiStore.setState({ dir: "rtl", locale: "fa" });
    const { container } = renderLayout();
    const outer = container.querySelector(".ant-layout-sider")?.parentElement as HTMLElement;
    expect(outer.style.flexDirection).toBe("");
  });
});
