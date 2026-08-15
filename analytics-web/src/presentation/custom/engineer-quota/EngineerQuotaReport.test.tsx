import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@/i18n";
import * as echarts from "echarts";
import { EngineerQuotaReport } from "./EngineerQuotaReport";
import { MOCK_QUOTA_ROW } from "./fetch";
import { chartColors } from "../../../theme/tokens";

/**
 * The report body. It renders what it is handed — the arithmetic is `quota.test.ts` — so these check
 * the layout, the order, and that the rings say the same thing the table does.
 */

const params = { cityId: 25, reshte: 4 };

/**
 * With the real i18n, not a stub. The headers and the note are the point of two of these tests, and a
 * missing key would otherwise pass as the key's own name.
 */
function mount() {
  return render(
    <I18nextProvider i18n={i18n}>
      <EngineerQuotaReport data={MOCK_QUOTA_ROW} params={params} />
    </I18nextProvider>,
  );
}

/**
 * Every data row's cells as text.
 *
 * The `:not(.ant-table-measure-row)` is kept although the table no longer sets `scroll.x`. With that
 * prop antd prepends an `aria-hidden` row of zero-height cells to measure column widths — invisible
 * in a screenshot, so the only symptom was the first entry of three assertions silently becoming
 * `undefined`. Anyone who adds `scroll.x` back should not have to rediscover that.
 */
function tableRows(container: HTMLElement): string[][] {
  return [...container.querySelectorAll("tbody tr:not(.ant-table-measure-row)")].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => td.textContent ?? ""),
  );
}

beforeEach(() => {
  document.documentElement.dir = "ltr";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
const startingLanguage = i18n.language;
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.dir = "ltr";
  // The language is global state; leaving it changed would make these tests order-dependent.
  await i18n.changeLanguage(startingLanguage);
});

describe("EngineerQuotaReport — the table", () => {
  it("lists the four bases in display order, ارشد first", () => {
    const { container } = mount();
    expect(tableRows(container).map((r) => r[0])).toEqual([
      "پایه ارشد",
      "پایه یک",
      "پایه دو",
      "پایه سه",
    ]);
  });

  it("shows design, supervision, engineers, remaining and total for each base", () => {
    const { container } = mount();

    // The fixture table from the design doc, as it reaches the screen.
    expect(tableRows(container)).toEqual([
      ["پایه ارشد", "2,357.45", "0", "2", "17,642.55", "20,000"],
      ["پایه یک", "9,034.42", "1,111.56", "16", "149,854.02", "160,000"],
      ["پایه دو", "6,362.96", "2,617.29", "21", "63,019.75", "72,000"],
      ["پایه سه", "2,348.91", "9,405.64", "55", "36,245.45", "48,000"],
    ]);
  });

  it("names the selected city and discipline in the headers", () => {
    // So a printed or exported table still says what it is about, not only the picker above it.
    const { container } = mount();
    const head = container.querySelector("thead")!.textContent ?? "";

    expect(head).toContain("بیجار");
    expect(head).toContain("مکانیک");
  });

  it("carries the note explaining what «پایه» means here, in both languages", async () => {
    // Without it the figures look wrong: they are per-city and use the highest grade active in that
    // city, not the engineer's grade in general. Asserted in both, because the note only does its
    // job if it is translated — an untranslated key would still render, and still say nothing.
    await i18n.changeLanguage("fa");
    mount();
    expect(screen.getByRole("alert").textContent).toContain("بالاترین پایه فعال");

    cleanup();
    await i18n.changeLanguage("en");
    mount();
    expect(screen.getByRole("alert").textContent).toContain("highest active level");
  });

  it("formats numbers the way the rest of the app does, in rtl", () => {
    document.documentElement.dir = "rtl";
    const { container } = mount();

    // Persian digits and the Persian thousands separator, via the shared formatter.
    expect(tableRows(container)[1][4]).toBe("۱۴۹٬۸۵۴٫۰۲".replace("٫", "."));
  });
});

describe("EngineerQuotaReport — the donuts", () => {
  const instances = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>("[data-testid='quota-donuts'] figure div[_echarts_instance_]")]
      .map((el) => echarts.getInstanceByDom(el))
      .filter(Boolean);

  it("draws one ring per base, in the table's order", () => {
    const { container } = mount();
    const titles = [...container.querySelectorAll("figcaption")].map((f) => f.textContent);

    expect(titles).toEqual(["پایه ارشد", "پایه یک", "پایه دو", "پایه سه"]);
  });

  it("gives each ring two slices — consumed and remaining, not design and supervision", () => {
    const { container } = mount();
    const first = instances(container)[0]!.getOption() as unknown as {
      series: { data: { name: string; value: number }[] }[];
    };

    // Base 4: 2357.45 design + 0 supervision = 2357.45 used, 17642.55 remaining.
    expect(first.series[0].data.map((d) => d.value)).toEqual([2357.45, 17_642.55]);
    expect(first.series[0].data).toHaveLength(2);
  });

  it("paints REMAINING in the brand colour and CONSUMED in the accent", () => {
    /**
     * The other way round put orange on the majority of every ring, so a base with 12% consumed
     * looked alarming at a glance. On a capacity gauge the bulk is the calm colour.
     */
    const { container } = mount();
    const opt = instances(container)[0]!.getOption() as unknown as {
      series: { data: { itemStyle: { color: string } }[] }[];
    };
    const palette = chartColors("light").series;

    const [used, remaining] = opt.series[0].data;
    expect(remaining.itemStyle.color).toBe(palette[0]);
    expect(used.itemStyle.color).toBe(palette[1]);
  });

  it("puts the engineer count in the hole, never in the ring", () => {
    const { container } = mount();
    const figures = container.querySelectorAll("[data-testid='quota-donuts'] figure");

    // 55 engineers on base 3 — a count of people, not an area. A third slice would make the ring
    // mean nothing.
    expect(within(figures[3] as HTMLElement).getByText("55")).toBeInTheDocument();
    const opt = instances(container)[3]!.getOption() as unknown as {
      series: { data: unknown[] }[];
    };
    expect(opt.series[0].data).toHaveLength(2);
  });

  it("hides the canvases from assistive tech, because the table already says it", () => {
    /**
     * Every number in a ring is a column in the table above — used is design + supervision, and
     * remaining and total are columns. That is what makes `aria-hidden` honest here rather than a
     * shortcut, and it is why a future custom report without a table needs its own alternative.
     */
    const { container } = mount();
    const canvases = container.querySelectorAll("[data-testid='quota-donuts'] div[_echarts_instance_]");

    expect(canvases).toHaveLength(4);
    for (const c of canvases) expect(c.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("table")).not.toBeNull();
  });
});
