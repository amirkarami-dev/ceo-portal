import { useEffect, useState } from "react";
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

/** Follows the OS "reduce motion" setting, and keeps following it if it changes. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** Applies the current light/dark theme to AntD; must sit under ThemeModeProvider. */
function ThemedApp({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <ConfigProvider direction="rtl" locale={faIR} theme={buildTheme(mode, reducedMotion)}>
      {/* No antd-jalali here, unlike the other panels: nothing in this app takes a date. Adding it
          "for consistency" would pull in a dayjs prototype patch for no screen that needs it. */}
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
