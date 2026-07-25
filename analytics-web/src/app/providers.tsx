import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "../auth/AuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { i18n, applyLocale } from "../i18n";
import { tokens, type BrandTokens } from "../theme/theme";
import { useUiStore } from "../store/ui-store";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { themeMode, locale, dir } = useUiStore();
  const brand: BrandTokens = { primary: tokens.primary, accent: tokens.accent };

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider mode={themeMode} brand={brand} dir={dir} locale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
