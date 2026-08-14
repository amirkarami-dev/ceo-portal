import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import type { ReactNode } from "react";
import { i18n } from "../i18n";
import type { QueryResult } from "@/contracts";
import type { ReportDefinition } from "@/contracts/report-definition";
import {
  labelLocaleOf,
  resolveColumnLabel,
  resolveReportTitle,
  useColumnLabel,
} from "./labels";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

/** What the engine returns: the metric column is named after its own alias. */
const result = {
  columns: [
    { key: "province", label: "استان", type: "string", isMetric: false },
    { key: "sum_amount", label: "sum_amount", type: "number", isMetric: true },
  ],
  rows: [],
  total: 0,
} as unknown as QueryResult;

const def = {
  id: "r1",
  dataset: "sales",
  columns: [],
  groupBy: [{ field: "province" }],
  metrics: [{ field: "amount", aggregation: "sum", alias: "sum_amount" }],
  presentation: { views: [] },
} as unknown as ReportDefinition;

const render = (d = def, r = result) =>
  renderHook(() => useColumnLabel(d, r), { wrapper }).result.current;

describe("useColumnLabel", () => {
  it("names a metric from its aggregation and its field, not its alias", async () => {
    await i18n.changeLanguage("fa");
    const label = render();

    // This is the bug the user saw: a chart legend reading «sum_amount».
    expect(label("sum_amount")).toBe("مجموع درآمد");
  });

  it("follows the selected language", async () => {
    await i18n.changeLanguage("en");
    expect(render()("sum_amount")).toBe("Sum Revenue");

    await i18n.changeLanguage("fa");
    expect(render()("sum_amount")).toBe("مجموع درآمد");
  });

  it("prefers the composed name over a stored one, because a stored one has no language", async () => {
    const withLabel = {
      ...def,
      metrics: [{ field: "amount", aggregation: "sum", alias: "sum_amount", label: "مجموع درآمد" }],
    } as unknown as ReportDefinition;

    // A saved report carries one fixed string. Honouring it left an English reader looking at
    // Persian — which is the whole complaint.
    await i18n.changeLanguage("en");
    expect(render(withLabel)("sum_amount")).toBe("Sum Revenue");
    await i18n.changeLanguage("fa");
    expect(render(withLabel)("sum_amount")).toBe("مجموع درآمد");
  });

  it("falls back to the stored label when there is nothing to compose from", async () => {
    await i18n.changeLanguage("fa");
    const unknownField = {
      ...def,
      metrics: [{ field: "not_in_model", aggregation: "none", alias: "x", label: "شاخص ویژه" }],
    } as unknown as ReportDefinition;

    // No field in the model and no aggregation word: the author's string is all there is.
    expect(render(unknownField)("x")).toBe("شاخص ویژه");
  });

  it("says «تعداد» alone for a count of rows", async () => {
    await i18n.changeLanguage("fa");
    const counting = {
      ...def,
      metrics: [{ field: "*", aggregation: "count", alias: "cnt" }],
    } as unknown as ReportDefinition;

    // "Count of *" reads like a bug.
    expect(render(counting)("cnt")).toBe("تعداد");
  });

  it("names a dimension from the semantic model", async () => {
    await i18n.changeLanguage("en");
    expect(render()("province")).toBe("Province");
  });

  it("never returns a blank for a key it cannot place", async () => {
    await i18n.changeLanguage("fa");
    expect(render()("mystery_column")).toBe("mystery_column");
  });

  it("survives a dataset the registry does not know", async () => {
    await i18n.changeLanguage("fa");
    const orphan = { ...def, dataset: "no-such-dataset" } as unknown as ReportDefinition;

    // A drill-down child can carry a source with no bundled model. It must not throw.
    expect(() => render(orphan)("sum_amount")).not.toThrow();
    expect(render(orphan)("sum_amount")).toBe("مجموع");
  });
});

// ── What a person typed ──────────────────────────────────────────────────────
// The distinction that makes this safe: a stored `metric.label` is one string with no language, and
// the AI writes a Persian one onto every report it generates — so it must NOT beat composition (the
// test above pins that). A `labelOverrides` entry is per language, so it can.

const overridden = (overrides: Record<string, { "fa-IR"?: string; "en-US"?: string }>) =>
  ({ ...def, labelOverrides: overrides }) as unknown as ReportDefinition;

describe("useColumnLabel — human overrides", () => {
  it("uses what a person typed, in the language they typed it in", async () => {
    const d = overridden({ sum_amount: { "fa-IR": "فروش خالص" } });

    await i18n.changeLanguage("fa");
    expect(render(d)("sum_amount")).toBe("فروش خالص");
  });

  it("leaves the other language composing, rather than showing it someone else's Persian", async () => {
    const d = overridden({ sum_amount: { "fa-IR": "فروش خالص" } });

    // The whole reason overrides are per language.
    await i18n.changeLanguage("en");
    expect(render(d)("sum_amount")).toBe("Sum Revenue");
  });

  it("keeps both languages when both were typed", async () => {
    const d = overridden({ sum_amount: { "fa-IR": "فروش خالص", "en-US": "Net sales" } });

    await i18n.changeLanguage("fa");
    expect(render(d)("sum_amount")).toBe("فروش خالص");
    await i18n.changeLanguage("en");
    expect(render(d)("sum_amount")).toBe("Net sales");
  });

  it("beats a composed name — otherwise editing a label would appear to do nothing", async () => {
    await i18n.changeLanguage("fa");
    // Without the override this composes «مجموع درآمد».
    expect(render()("sum_amount")).toBe("مجموع درآمد");
    expect(render(overridden({ sum_amount: { "fa-IR": "فروش خالص" } }))("sum_amount")).toBe("فروش خالص");
  });

  it("overrides a dimension too, not only a metric", async () => {
    await i18n.changeLanguage("en");
    expect(render()("province")).toBe("Province");
    expect(render(overridden({ province: { "en-US": "Region" } }))("province")).toBe("Region");
  });

  it("ignores an empty or blank override instead of rendering a nameless column", async () => {
    await i18n.changeLanguage("fa");
    // Clearing the box must restore the automatic name, not leave the legend blank.
    expect(render(overridden({ sum_amount: { "fa-IR": "" } }))("sum_amount")).toBe("مجموع درآمد");
    expect(render(overridden({ sum_amount: { "fa-IR": "   " } }))("sum_amount")).toBe("مجموع درآمد");
  });

  it("touches only the column it names", async () => {
    await i18n.changeLanguage("fa");
    const d = overridden({ sum_amount: { "fa-IR": "فروش خالص" } });
    expect(d.labelOverrides).toBeDefined();
    expect(render(d)("province")).toBe("استان");
  });
});

describe("resolveColumnLabel — the plain function the exporters use", () => {
  // csv.ts / xlsx.ts / pdf.ts are not components, so they cannot call the hook. They must be able to
  // reach the same answer, or a renamed series would change the chart and not the Excel header.
  it("gives the same answer as the hook, without React", async () => {
    await i18n.changeLanguage("fa");
    const d = overridden({ sum_amount: { "fa-IR": "فروش خالص" } });

    expect(resolveColumnLabel(d, result, "sum_amount", "fa-IR", i18n.t)).toBe("فروش خالص");
    expect(resolveColumnLabel(d, result, "sum_amount", "fa-IR", i18n.t)).toBe(render(d)("sum_amount"));
    // and composes when there is no override
    expect(resolveColumnLabel(def, result, "sum_amount", "en-US", i18n.t)).toBe("Sum Revenue");
  });

  it("does not depend on the app's current language, only on the locale it is given", async () => {
    // An export must be able to ask for a specific language regardless of what the UI is showing.
    await i18n.changeLanguage("fa");
    expect(resolveColumnLabel(def, result, "sum_amount", "en-US", i18n.t)).toBe("Sum Revenue");
  });
});

describe("labelLocaleOf", () => {
  it.each([
    ["fa", "fa-IR"],
    ["en", "en-US"],
    ["en-GB", "en-US"],
    [undefined, "fa-IR"],
  ] as const)("maps %s to %s", (lang, expected) => {
    expect(labelLocaleOf(lang)).toBe(expected);
  });
});

describe("resolveReportTitle", () => {
  it("uses the typed title for this language, else the definition's name", () => {
    const d = { name: "Monthly revenue", titleOverrides: { "fa-IR": "درآمد ماهانه" } };

    expect(resolveReportTitle(d, "fa-IR")).toBe("درآمد ماهانه");
    // Not yet typed in English → the original name, not the Persian.
    expect(resolveReportTitle(d, "en-US")).toBe("Monthly revenue");
  });

  it("ignores a blank override and never returns undefined", () => {
    expect(resolveReportTitle({ name: "x", titleOverrides: { "fa-IR": "  " } }, "fa-IR")).toBe("x");
    expect(resolveReportTitle(undefined, "fa-IR")).toBe("");
  });
});
