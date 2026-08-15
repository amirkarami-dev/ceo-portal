import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { i18n } from "@/i18n";
import { resetMockDb, seedReports } from "@/api/seed";
import { mockApi } from "@/api/mockApi";
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
    // antd asks `(max-width: 575px)` for xs and `(min-width: …)` for everything
    // above it. Answering false to all of them is not a phone — it is no breakpoint
    // at all, and antd then falls back to its default column count.
    matches: kind === "desktop" ? /min-width/.test(query) : /max-width/.test(query),
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


  // ── A renamed report ───────────────────────────────────────────────────────
  /**
   * Renaming a report on its own page writes `titleOverrides[locale]` and deliberately leaves
   * `definition.name` alone: `name` is the neutral original the server keeps in its own column, and
   * overwriting it would push one language's wording onto every reader.
   *
   * This list read `name` directly, so a report renamed on its page kept its old title here — the
   * rename looked like it had not saved, when in fact it had.
   */
  describe("a report renamed on its own page", () => {
    const RENAMED = "مجموع متراژهای ثبت شده در ظرفیت";

    /**
     * Pinned to Persian, because an override is stored per language and the fallback to `name` is
     * correct for a reader in another one. Without this the suite runs in English, the `fa-IR`
     * override is rightly ignored, and these tests fail for a reason that is not the bug.
     */
    beforeEach(async () => {
      await i18n.changeLanguage("fa");
    });
    afterEach(async () => {
      await i18n.changeLanguage("en");
    });

    async function renameFirstSeededReport() {
      const all = await mockApi.reports.list();
      const target = all[0];
      // `save` upserts: an entity that already has an id is updated in place.
      await mockApi.reports.save({
        ...target,
        definition: { ...target.definition, titleOverrides: { "fa-IR": RENAMED } },
      });
      return target;
    }

    it("shows the new title, not the stored name", async () => {
      const target = await renameFirstSeededReport();
      renderLib();

      expect(await screen.findByText(RENAMED)).toBeInTheDocument();
      expect(screen.queryByText(target.definition.name)).not.toBeInTheDocument();
    });

    it("can be found by searching for the new title", async () => {
      // Filtering on `name` while displaying the override meant typing the title you could see
      // returned nothing at all.
      await renameFirstSeededReport();
      renderLib();
      await screen.findByText(RENAMED);

      await userEvent.type(screen.getByRole("searchbox"), "متراژهای ثبت شده");

      await waitFor(() => expect(screen.getByText(RENAMED)).toBeInTheDocument());
    });

    it("leaves reports nobody renamed alone", async () => {
      const all = await mockApi.reports.list();
      const untouched = all[1];
      await renameFirstSeededReport();
      renderLib();

      expect(await screen.findByText(untouched.definition.name)).toBeInTheDocument();
    });
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
