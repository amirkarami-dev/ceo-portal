import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider } from "antd";
import faIR from "antd/locale/fa_IR";
import { AuthProvider } from "../auth/AuthProvider";
import { ThemeModeProvider } from "../theme/ThemeModeProvider";
import { useThemeMode } from "../theme/useThemeMode";
import { buildTheme } from "../theme/tokens";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, retry: 1 } },
});

/** Applies the current light/dark theme to AntD; must sit under ThemeModeProvider. */
function ThemedApp({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  return (
    <ConfigProvider direction="rtl" locale={faIR} theme={buildTheme(mode)}>
      <AntApp>
        <AuthProvider>{children}</AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <ThemedApp>{children}</ThemedApp>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
