import { useEffect } from "react";
import { ConfigProvider } from "antd";
import faIR from "antd/locale/fa_IR";
import enUS from "antd/locale/en_US";
import { buildAntdTheme, applyCssVars, type ThemeMode, type BrandTokens } from "./theme";
import { buildTheme } from "./tokens";

export function ThemeProvider(props: {
  mode: ThemeMode;
  brand: BrandTokens;
  dir: "rtl" | "ltr";
  locale: "fa" | "en";
  children: React.ReactNode;
}) {
  const { mode, brand, dir, locale, children } = props;
  useEffect(() => {
    applyCssVars(mode, brand);
  }, [mode, brand]);

  // Merge the canonical token overrides from buildTheme (tokens.ts) on top of
  // buildAntdTheme so both the brand-aware layout tokens and the new design-system
  // tokens (colorBgLayout, colorBgContainer, borderRadius, cssVar …) are active.
  const { direction: _dir, ...antdBaseTheme } = buildAntdTheme(mode, brand, dir);
  const tokenOverrides = buildTheme(mode);
  const mergedTheme = {
    ...antdBaseTheme,
    token: { ...tokenOverrides.token, ...antdBaseTheme.token },
    cssVar: tokenOverrides.cssVar,
  };

  return (
    <ConfigProvider
      theme={mergedTheme}
      locale={locale === "fa" ? faIR : enUS}
      direction={_dir}
    >
      {children}
    </ConfigProvider>
  );
}
