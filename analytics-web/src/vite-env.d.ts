/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  /** R6: "mock" = offline dev user; "oidc" = real PKCE at auth.myceo.ir. */
  readonly VITE_AUTH_MODE: "mock" | "oidc";
  readonly VITE_AUTH_AUTHORITY: string;
  readonly VITE_AUTH_CLIENT_ID: string;
  readonly VITE_AUTH_SCOPE: string;
  /** Data seam: "true" = localStorage mock backend + seed; "false" = real HTTP API. */
  readonly VITE_USE_MOCK_API: string;
  /** AI seam: "mock" = MockReportAIService; "gateway" = HTTP-backed AI gateway. */
  readonly VITE_AI_MODE: "mock" | "gateway";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
