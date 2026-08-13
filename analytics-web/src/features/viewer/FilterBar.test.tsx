import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@/i18n";
import type { Filter, SemanticModel } from "@/contracts";
import { FilterBar } from "./FilterBar";

const semantic = {
  id: "m",
  entities: [
    {
      id: "e",
      source: "e",
      fields: [
        // A Jalali date is TEXT in the warehouse, so `type` is "string"; `format.kind` is what says
        // the string is a date and earns it a Persian calendar.
        { id: "RegDate", column: "RegDate", type: "string", role: "dimension",
          label: { "fa-IR": "تاریخ درج در ظرفیت", "en-US": "Capacity Entry Date" },
          format: { kind: "date", pattern: "YYYY/MM/DD", locale: "fa-IR" } },
        // Same type, no date hint — this one stays a plain box.
        { id: "Note", column: "Note", type: "string", role: "dimension",
          label: { "fa-IR": "یادداشت", "en-US": "Note" } },
        { id: "ProjectNo", column: "ProjectNo", type: "string", role: "dimension",
          label: { "fa-IR": "شماره پرونده", "en-US": "File No" } },
      ],
    },
  ],
} as unknown as SemanticModel;

const renderBar = (filters: Filter[], onChange = vi.fn()) => {
  render(
    <I18nextProvider i18n={i18n}>
      <FilterBar filters={filters} semantic={semantic} onChange={onChange} />
    </I18nextProvider>,
  );
  return onChange;
};

const between: Filter = {
  field: "RegDate",
  operator: "between",
  value: ["1405/01/01", "1405/12/30"],
};

describe("FilterBar — a range needs both of its bounds", () => {
  it("gives a between filter two boxes, filled with the bounds it already has", () => {
    renderBar([between]);
    const boxes = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(boxes).toHaveLength(2);
    expect(boxes[0].value).toBe("1405/01/01");
    expect(boxes[1].value).toBe("1405/12/30");
  });

  it("keeps the other bound when one is edited", () => {
    const onChange = renderBar([between]);
    const boxes = screen.getAllByRole("textbox");

    fireEvent.change(boxes[0], { target: { value: "1404/01/01" } });

    // One box used to replace BOTH bounds with a single string, leaving half a range: the query
    // returned nothing, and once the engine started refusing half a range it became
    // «خطا در بارگذاری گزارش» the moment anyone typed.
    expect(onChange).toHaveBeenCalledWith(0, ["1404/01/01", "1405/12/30"]);
  });

  it("clears to nothing at all, not to half a range", () => {
    const onChange = renderBar([{ field: "RegDate", operator: "between", value: ["1405/01/01", ""] }]);
    const boxes = screen.getAllByRole("textbox");

    fireEvent.change(boxes[0], { target: { value: "" } });

    // Both boxes empty → null, which the viewer drops. Emitting [""] instead would be half a
    // range again.
    expect(onChange).toHaveBeenCalledWith(0, null);
  });

  it("still gives an ordinary filter a single box", () => {
    renderBar([{ field: "ProjectNo", operator: "contains", value: "140" }]);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});

describe("FilterBar — a Jalali date gets a Persian calendar", () => {
  it("offers two pickers for a date range, not two text boxes", () => {
    renderBar([between]);
    // Typing «1405/03/17» by hand means knowing the exact format and the Persian digits. The model
    // says this string is a date, so the field offers the calendar walfare-web already uses.
    expect(screen.getAllByTestId("jalali-picker")).toHaveLength(2);
  });

  it("passes the bounds straight through as the warehouse's own strings", () => {
    const onChange = renderBar([between]);
    const pickers = screen.getAllByTestId("jalali-picker");

    fireEvent.change(pickers[0], { target: { value: "1404/01/01" } });

    // No Gregorian round trip: the column is nvarchar holding Jalali text, so the picker reads and
    // writes exactly what the filter already contains.
    expect(onChange).toHaveBeenCalledWith(0, ["1404/01/01", "1405/12/30"]);
  });

  it("leaves a string field WITHOUT the date hint as a plain box", () => {
    renderBar([{ field: "Note", operator: "contains", value: "x" }]);
    expect(screen.queryByTestId("jalali-picker")).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});
