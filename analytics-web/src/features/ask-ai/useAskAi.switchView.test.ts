// report-web/src/features/ask-ai/useAskAi.switchView.test.ts
//
// TDD RED → GREEN for Bug A: switching to a chart view after a Table view is active
// results in undefined x/y mapping because the code blindly copies base.mapping
// (which is { columns: [...] } for a table) instead of deriving from result.columns.
//
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAskAi } from "./useAskAi";

describe("useAskAi.switchView — Bug A regression", () => {
  beforeEach(() => {
    // Nothing to reset — each renderHook gets a fresh hook instance.
  });

  it("switchView('bar') after Table sets mapping.x to the dimension key and mapping.y to the metric key", async () => {
    const { result } = renderHook(() => useAskAi());

    // Submit the top-10 customers example: single-dimension (customerName) + metrics.
    await act(async () => {
      await result.current.submit("۱۰ مشتری برتر بر اساس فروش", "model-sales");
    });

    // Confirm we're in the result phase with data.
    expect(result.current.state.phase).toBe("result");
    const resultColumns = result.current.state.result?.columns;
    expect(resultColumns).toBeDefined();

    // Identify the dimension and metric keys from the actual result columns.
    const dimCol = resultColumns!.find((c) => !c.isMetric);
    const metricCol = resultColumns!.find((c) => c.isMetric);
    expect(dimCol).toBeDefined();
    expect(metricCol).toBeDefined();

    // Switch to table view first (this sets a mapping with only `columns`, no x/y).
    act(() => {
      result.current.switchView("table");
    });

    const tableViewIndex = result.current.state.activeViewIndex;
    const tableView = result.current.state.views[tableViewIndex];
    expect(tableView.type).toBe("table");
    // Confirm the table mapping has no x or y.
    expect(tableView.mapping.x).toBeUndefined();
    expect(tableView.mapping.y).toBeUndefined();

    // Now switch to bar — this is the failing case before the fix.
    act(() => {
      result.current.switchView("bar");
    });

    const barViewIndex = result.current.state.activeViewIndex;
    const barView = result.current.state.views[barViewIndex];

    // The bar chart view should have type "chart" and component "BarChart".
    expect(barView.type).toBe("chart");
    expect(barView.component).toBe("BarChart");

    // CRITICAL: x and y must be bound to real column keys, not undefined.
    expect(barView.mapping.x).toBe(dimCol!.key);
    expect(barView.mapping.y).toBe(metricCol!.key);
  });

  it("switchView('pie') after Table sets mapping.category and mapping.measure", async () => {
    const { result } = renderHook(() => useAskAi());

    await act(async () => {
      await result.current.submit("۱۰ مشتری برتر بر اساس فروش", "model-sales");
    });

    expect(result.current.state.phase).toBe("result");
    const resultColumns = result.current.state.result?.columns;
    const dimCol = resultColumns!.find((c) => !c.isMetric);
    const metricCol = resultColumns!.find((c) => c.isMetric);

    // Switch to table first, then pie.
    act(() => { result.current.switchView("table"); });
    act(() => { result.current.switchView("pie"); });

    const pieViewIndex = result.current.state.activeViewIndex;
    const pieView = result.current.state.views[pieViewIndex];

    expect(pieView.type).toBe("chart");
    expect(pieView.component).toBe("PieChart");
    expect(pieView.mapping.category).toBe(dimCol!.key);
    expect(pieView.mapping.measure).toBe(metricCol!.key);
  });
});
