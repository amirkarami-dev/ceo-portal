import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { i18n } from "../../../i18n";
import { AIRoutingRules } from "./AIRoutingRules";

const mutate = vi.fn();

vi.mock("../../../api/queries", () => ({
  useTenantAIConfig: () => ({
    data: {
      tenantId: "acme",
      defaultModelId: "openai-gpt4o-mini",
      fallbackChain: ["openai-gpt4o-mini", "deepseek-chat"],
      promptVersion: "report-gen@3",
      cache: { enabled: true, ttlSeconds: 86400 },
      quota: { monthlyTokenLimit: 5000000, monthlyCostUsdLimit: 200 },
      providers: [
        {
          id: "openai-gpt4o-mini",
          type: "openai",
          model: "gpt-4o-mini",
          keyRef: "x",
          params: { temperature: 0.1, maxTokens: 2048 },
          enabled: true,
        },
        {
          id: "deepseek-chat",
          type: "deepseek",
          model: "deepseek-chat",
          keyRef: "x",
          params: { temperature: 0.1, maxTokens: 2048 },
          enabled: true,
        },
      ],
    },
    isLoading: false,
  }),
  useUpdateTenantAIConfig: () => ({ mutate, isPending: false }),
}));

vi.mock("../usePromptVersions", () => ({
  usePromptVersions: () => ({
    data: [
      {
        id: "report-gen",
        name: "report-gen",
        activeVersion: "report-gen@3",
        versions: [{ version: "report-gen@3", createdAt: "", note: "", active: true }],
      },
    ],
  }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>{ui}</MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("AIRoutingRules", () => {
  it("moves a fallback entry up and persists the new order", () => {
    wrap(<AIRoutingRules />);
    // deepseek is second; move it up
    const upButtons = screen.getAllByRole("button", { name: /move up/i });
    fireEvent.click(upButtons[1]);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackChain: ["deepseek-chat", "openai-gpt4o-mini"] }),
    );
  });
});
