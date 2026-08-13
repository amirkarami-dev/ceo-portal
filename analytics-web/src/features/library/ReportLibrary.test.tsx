import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { i18n } from "@/i18n";
import { resetMockDb, seedReports } from "@/api/seed";
import { ReportLibrary } from "./ReportLibrary";

function renderLib() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <MemoryRouter>
            <ReportLibrary />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

/**
 * The global stub answers `false` to every media query, which antd reads as the
 * narrowest breakpoint — a phone. That used to make no difference; now it decides
 * whether the page renders a table or a card list, so each test says which it means.
 */
function viewport(kind: "desktop" | "phone") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: kind === "desktop" ? /min-width/.test(query) : false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe("ReportLibrary", () => {
  beforeEach(() => {
    resetMockDb();
    seedReports();
    viewport("desktop");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists seeded reports in a table", async () => {
    renderLib();
    await waitFor(() =>
      expect(screen.getByRole("table")).toBeInTheDocument(),
    );
    // at least one seeded report name is rendered
    expect(screen.getAllByTestId("report-row").length).toBeGreaterThan(0);
  });

  it("filters rows by the search box — no-match hides all rows", async () => {
    const user = userEvent.setup();
    renderLib();
    await screen.findByRole("table");
    const search = screen.getByRole("searchbox");

    // typing a string that matches nothing should collapse to 0 rows
    await user.type(search, "zzz-no-match");
    await waitFor(() =>
      expect(screen.queryAllByTestId("report-row").length).toBe(0),
    );
  });

  it("filters rows by the search box — positive case keeps matching row", async () => {
    const user = userEvent.setup();
    renderLib();
    await screen.findByRole("table");
    const search = screen.getByRole("searchbox");

    // "درآمد" is a substring of "درآمد ماهانه به تفکیک استان" (rep-revenue only)
    await user.type(search, "درآمد");
    await waitFor(() =>
      expect(screen.getAllByTestId("report-row").length).toBeGreaterThanOrEqual(1),
    );
  });

  describe("on a phone", () => {
    beforeEach(() => viewport("phone"));

    // Six attributes across 375px gave every column a sliver: the report name got 67px
    // and wrapped to 91px-tall rows while an empty tags column took 73.
    it("shows cards instead of the table", async () => {
      const { container } = renderLib();
      await waitFor(() =>
        expect(container.querySelectorAll(".report-card").length).toBeGreaterThan(0),
      );
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("gives every card a link to its report and a menu of its own", async () => {
      const { container } = renderLib();
      await waitFor(() => expect(container.querySelector(".report-card")).toBeTruthy());
      const card = container.querySelector(".report-card") as HTMLElement;
      expect(card.querySelector("a.report-card__open")).toHaveAttribute(
        "href",
        expect.stringContaining("/reports/"),
      );
      // a real button, and a sibling of the link rather than inside it
      const menu = card.querySelector(".report-card__menu") as HTMLElement;
      expect(menu.tagName).toBe("BUTTON");
      expect(menu.closest("a")).toBeNull();
    });

    it("filters the cards too", async () => {
      const user = userEvent.setup();
      const { container } = renderLib();
      await waitFor(() => expect(container.querySelector(".report-card")).toBeTruthy());

      await user.type(screen.getByRole("searchbox"), "zzz-no-match");
      await waitFor(() => expect(container.querySelectorAll(".report-card").length).toBe(0));
    });
  });
});
