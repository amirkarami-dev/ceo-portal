/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Central OIDC IdP (OpenIddict) — the `authority` handed to oidc-client-ts. */
  readonly VITE_AUTH_ISSUER: string;
  /**
   * Admin API origin. The admin endpoints (`/api/admin/*`) are served by the IdP host,
   * so this defaults to `VITE_AUTH_ISSUER` when unset.
   */
  readonly VITE_ADMIN_API_BASE?: string;
  /** Public PKCE client id registered on the IdP for this panel. */
  readonly VITE_OIDC_CLIENT_ID: string;
  /** Optional; defaults to "openid profile email roles mabhas19.api". */
  readonly VITE_AUTH_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
