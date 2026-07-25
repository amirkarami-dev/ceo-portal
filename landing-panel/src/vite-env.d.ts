/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API origin. All CMS routes live under `${VITE_API_BASE}/api/kurdnezam`. */
  readonly VITE_API_BASE: string;
  /** Central OIDC IdP (OpenIddict) — the `authority` handed to oidc-client-ts. */
  readonly VITE_AUTH_ISSUER: string;
  /** Public PKCE client id registered on the IdP for this panel. */
  readonly VITE_OIDC_CLIENT_ID: string;
  /** Optional; defaults to "openid profile email roles mabhas19.api". */
  readonly VITE_AUTH_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
