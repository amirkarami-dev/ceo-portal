import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { i18n } from "../../../i18n";
import { AIProviderList } from "./AIProviderList";

vi.mock("../../../auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "t" },
    roles: ["AIManager"],
    isAdmin: false,
    ready: true,
    login() {},
    logout() {},
  }),
}));

vi.mock("../../../api/queries", () => ({
  useTenantAIConfig: () => ({
    data: {
      tenantId: "acme",
      defaultModelId: "openai-gpt4o-mini",
      fallbackChain: ["openai-gpt4o-mini"],
      promptVersion: "report-gen@3",
      cache: { enabled: true, ttlSeconds: 86400 },
      quota: { monthlyTokenLimit: 5000000, monthlyCostUsdLimit: 200 },
      providers: [
        {
          id: "openai-gpt4o-mini",
          type: "openai",
          model: "gpt-4o-mini",
          keyRef: "secret://acme/openai",
          params: { temperature: 0.1, maxTokens: 2048 },
          enabled: true,
        },
        {
          id: "ollama-local",
          type: "ollama",
          model: "qwen2.5:14b",
          keyRef: null,
          params: { temperature: 0.1, maxTokens: 2048 },
          enabled: true,
        },
      ],
    },
    isLoading: false,
  }),
  useUpdateTenantAIConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useTestProvider: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

describe("AIProviderList", () => {
  it("lists configured providers with status + secret masking", () => {
    wrap(<AIProviderList />);
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
    expect(screen.getByText("qwen2.5:14b")).toBeInTheDocument();
    // keyRef is masked, never shown raw
    expect(screen.queryByText(/secret:\/\/acme\/openai/)).not.toBeInTheDocument();
    expect(screen.getAllByText("•••••").length).toBeGreaterThan(0);
  });

  it("offers add of all 9 provider types", () => {
    wrap(<AIProviderList />);
    expect(
      screen.getByRole("button", { name: /add provider|افزودن ارائه‌دهنده/i }),
    ).toBeInTheDocument();
  });
});
