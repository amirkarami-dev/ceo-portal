import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import type { ReactNode } from "react";
import { i18n } from "../i18n";
import type { QueryResult } from "@/contracts";
import type { ReportDefinition } from "@/contracts/report-definition";
import { useColumnLabel } from "./labels";

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
