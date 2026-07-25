/** System-wide settings managed by Super Admin. */
export interface SystemSettings {
  defaultLocale: "fa-IR" | "en-US";
  defaultTheme: "light" | "dark";
  dateSystem: "jalali" | "gregorian";
  flags: { advancedECharts: boolean; dashboardSharing: boolean; exportFormats: boolean };
  ai: {
    defaultProvider: string;
    defaultModel: string;
    globalTokenBudget: number;
    defaultCacheTtl: number;
    promptVersionPin: string;
  };
  security: {
    sessionPolicy: string;
    allowedExportFormats: string[];
    piiRedaction: boolean;
  };
  integrations: { oidcIssuer: string };
}
