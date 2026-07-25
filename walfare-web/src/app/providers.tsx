import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider } from "antd";
import faIR from "antd/locale/fa_IR";
import { JalaliLocaleListener } from "antd-jalali";
import { AuthProvider } from "@/auth/AuthProvider";
import { queryClient } from "@/query/client";
import { buildTheme } from "@/theme/tokens";
import { useUiStore } from "@/store/ui";

/** Applies the persisted light/dark mode to AntD. */
function ThemedApp({ children }: { children: ReactNode }) {
  const themeMode = useUiStore((s) => s.themeMode);
  return (
    <ConfigProvider direction="rtl" locale={faIR} theme={buildTheme(themeMode)}>
      {/* AntApp supplies the context behind App.useApp() -> message/modal/notification,
          which is how every mutation toast in the panel is raised. */}
      {/* Keeps the AntD picker locale in the Jalali calendar (antd-jalali). */}
      <JalaliLocaleListener />
      <AntApp>
        <AuthProvider>{children}</AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedApp>{children}</ThemedApp>
    </QueryClientProvider>
  );
}
