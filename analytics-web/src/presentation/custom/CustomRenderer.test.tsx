import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportViewRenderer } from "../ReportView";
import { registerCustomReport } from "./registry";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type { QueryResult } from "../../contracts/dataset";

/**
 * The custom-report path: `library: "custom"` → registry lookup → the entry's own fetch → its own
 * component. See `docs/design/2026-08-15-custom-reports-engineer-quota.md`.
 */

const def = { id: "r1", dataset: "oz_info", columns: [], presentation: { views: [] } } as unknown as ReportDefinition;
const emptyResult = { columns: [], rows: [], total: 0 } as unknown as QueryResult;

const fetchSpy = vi.fn();

registerCustomReport({
  id: "TestReport",
  title: { "fa-IR": "آزمایشی", "en-US": "Test" },
  params: [{ key: "cityId", label: { "en-US": "City" }, options: [{ value: 1, label: "A" }] }],
  defaults: { cityId: 1 },
  fetch: async (p) => {
    fetchSpy(p);
    return { seen: p.cityId };
  },
  Component: ({ data }) => <div data-testid="test-body">{String((data as { seen: number }).seen)}</div>,
});

function view(partial: Partial<ReportView>): ReportView {
  return { type: "chart", library: "custom", component: "TestReport", mapping: {}, ...partial };
}

function mount(v: ReportView) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReportViewRenderer view={v} def={def} result={emptyResult} />
    </QueryClientProvider>,
  );
}

beforeEach(() => fetchSpy.mockClear());
afterEach(() => cleanup());

describe("CustomRenderer", () => {
  it("dispatches a custom view to its registered component", async () => {
    mount(view({}));
    expect(await screen.findByTestId("test-body")).toBeInTheDocument();
  });

  it("calls the entry's own fetch, with the entry's defaults", async () => {
    mount(view({}));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith({ cityId: 1 }));
  });

  it("prefers parameters stored on the view over the defaults", async () => {
    // A saved report reopens on what it was saved with.
    mount(view({ options: { cityId: 25 } }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith({ cityId: 25 }));
  });

  it("ignores stored keys the entry does not declare", async () => {
    // A stale `options` bag from an older version of a report must not smuggle arguments into fetch.
    mount(view({ options: { cityId: 25, leftover: "junk" } }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith({ cityId: 25 }));
  });

  it("shows an empty state for an unknown component, NOT a chart", async () => {
    /**
     * `chartKind` deliberately defaults an unrecognised chart component to a bar; there is a sensible
     * chart to fall back to. Here there is nothing, and drawing something anyway would hide a typo'd
     * or deleted registry id behind a plausible screen.
     */
    const { container } = mount(view({ component: "NoSuchReport" }));

    expect(screen.queryByTestId("test-body")).not.toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".ant-empty")).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
