import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { DashboardCanvas } from "./DashboardCanvas";

/**
 * The layout write-back guard.
 *
 * react-grid-layout assigns `w:1, h:1` to any child it has no layout entry for, and reports that
 * through `onLayoutChange` like any other change. While the dashboard's data is still loading the
 * page holds `useState([])`, so *every* child is such a child — and the handler saved RGL's
 * invention over the real design before that design was ever applied.
 *
 * The symptom was every widget on every dashboard rendering **159×40** while the saved layout in
 * storage stayed perfectly correct, which is exactly what made it read as a rendering bug.
 *
 * ## Only the negative case lives here
 *
 * The matching positive — a loaded dashboard still persists what you drag — cannot run in jsdom:
 * `WidthProvider` sizes itself from `offsetWidth` and a ResizeObserver, jsdom reports 0 for the
 * first and the suite stubs the second with a no-op, so the grid resolves to its narrowest
 * breakpoint and the component's own `colsRef` guard swallows every change before this one is
 * reached. Stubbing `offsetWidth` was tried and is not enough.
 *
 * That case is covered where it does run: *"Save button persists both widgets and layout to the mock
 * DB"* in `features/dashboards/DashboardBuilder.test.tsx`.
 */

const child = (i: string) => (
  <div key={i}>
    <span>{i}</span>
  </div>
);

describe("DashboardCanvas", () => {
  it("ignores the layout react-grid-layout invents for an empty one", async () => {
    const onLayoutChange = vi.fn();
    render(
      <DashboardCanvas layout={[]} editing={false} onLayoutChange={onLayoutChange}>
        {[child("w1"), child("w2")]}
      </DashboardCanvas>,
    );

    // RGL still reports its generated layout; the guard is what stops it being written back over a
    // design that has not finished loading.
    await waitFor(() => expect(document.querySelector(".react-grid-layout")).toBeInTheDocument());
    expect(onLayoutChange).not.toHaveBeenCalled();
  });
});
