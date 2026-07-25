// report-web/src/features/ask-ai/AskAiBuilder.test.tsx
import { render, screen, waitFor, act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { i18n } from "@/i18n";
import { AuthProvider } from "@/auth/AuthProvider";
import { AskAiBuilder } from "./AskAiBuilder";
import { useAskAi } from "./useAskAi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <AskAiBuilder />
        </AuthProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AskAiBuilder", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the hero prompt box and example chips on first load", () => {
    renderScreen();
    expect(screen.getByRole("textbox", { name: /prompt/i })).toBeInTheDocument();
    // 5-7 seeded example chips
    expect(screen.getAllByTestId("example-chip").length).toBeGreaterThanOrEqual(5);
  });

  it("generates → reveals the definition panel → renders a result canvas", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.type(
      screen.getByRole("textbox", { name: /prompt/i }),
      "فروش هر استان",
    );
    await user.click(screen.getByRole("button", { name: /send|generate|ارسال/i }));
    // collapsible definition panel appears with the generated JSON
    await waitFor(() =>
      expect(screen.getByTestId("definition-panel")).toBeInTheDocument(),
    );
    // result canvas (ReportViewRenderer output) and the view switcher appear
    expect(screen.getByTestId("result-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
  });

  it("clicking an example chip submits the prompt", async () => {
    const user = userEvent.setup();
    renderScreen();
    const chips = screen.getAllByTestId("example-chip");
    await user.click(chips[0]);
    await waitFor(() =>
      expect(screen.getByTestId("definition-panel")).toBeInTheDocument(),
    );
  });

  it("the view switcher swaps views without recomputing the query", async () => {
    const user = userEvent.setup();

    // Spy on the barrel so we can count generate calls.
    const aiModule = await import("@/ai");
    const realService = aiModule.createAIService();
    const generateSpy = vi.fn().mockImplementation(
      // Use the real implementation — just wrap it to count calls.
      (req: Parameters<typeof realService.generate>[0]) => realService.generate(req),
    );
    vi.spyOn(aiModule, "createAIService").mockReturnValue({ generate: generateSpy });

    renderScreen();
    await user.type(
      screen.getByRole("textbox", { name: /prompt/i }),
      "فروش هر استان",
    );
    await user.click(screen.getByRole("button", { name: /send|generate|ارسال/i }));
    await waitFor(() =>
      expect(screen.getByTestId("view-switcher")).toBeInTheDocument(),
    );

    // Record initial view state — the result-canvas should be present.
    expect(screen.getByTestId("result-canvas")).toBeInTheDocument();
    const generateCallCountAfterSubmit = generateSpy.mock.calls.length;
    expect(generateCallCountAfterSubmit).toBe(1);

    // Click the "table" segment in the view switcher (Segmented component).
    // Segmented renders each option as a label element inside a radio.
    const tableOption = screen.getByText(/جدول|Table/i);
    await act(async () => {
      await user.click(tableOption);
    });

    // The result-canvas should still be present (view changed, not re-submitted).
    await waitFor(() =>
      expect(screen.getByTestId("result-canvas")).toBeInTheDocument(),
    );

    // AI generate was NOT called again — still exactly 1 call.
    expect(generateSpy.mock.calls.length).toBe(1);
  });

  it("renders an error alert when the AI service throws", async () => {
    const user = userEvent.setup();

    // Mock the AI barrel module to throw for this test only.
    const aiModule = await import("@/ai");
    const spy = vi.spyOn(aiModule, "createAIService").mockReturnValue({
      generate: () => Promise.reject(new Error("Cannot map intent")),
    });

    renderScreen();
    await user.type(screen.getByRole("textbox", { name: /prompt/i }), "asdkjqwe zzz");
    await user.click(screen.getByRole("button", { name: /send|generate|ارسال/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );

    spy.mockRestore();
  });

  it("save button calls useSaveReport with the definition", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.type(
      screen.getByRole("textbox", { name: /prompt/i }),
      "فروش هر استان",
    );
    await user.click(screen.getByRole("button", { name: /send|generate|ارسال/i }));
    await waitFor(() =>
      expect(screen.getByTestId("save-btn")).toBeInTheDocument(),
    );
    // Clicking save opens the modal.
    await user.click(screen.getByTestId("save-btn"));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
  });

  it("setDataset updates datasetKey in hook state without entering result phase", () => {
    // Test the binding at the hook level — renderHook is the right tool here because
    // Ant Design Select's popup doesn't render in jsdom (portal + no CSS), so DOM-event
    // approaches on the hidden input don't reach rc-select's React onChange.
    const { result } = renderHook(() => useAskAi());

    // Sanity: initial state is "hero" with the default model selected.
    expect(result.current.state.phase).toBe("hero");
    expect(result.current.state.datasetKey).toBe("model-sales");

    // Call setDataset directly — this is the exact function wired to onDataset in
    // PromptHero's <Select onChange={onDataset}>.
    act(() => {
      result.current.setDataset("model-project");
    });

    // datasetKey must have changed.
    expect(result.current.state.datasetKey).toBe("model-project");

    // Phase MUST still be "hero" — setDataset must NOT trigger generation.
    expect(result.current.state.phase).toBe("hero");

    // No definition or result should be present yet.
    expect(result.current.state.def).toBeUndefined();
    expect(result.current.state.result).toBeUndefined();
  });
});
