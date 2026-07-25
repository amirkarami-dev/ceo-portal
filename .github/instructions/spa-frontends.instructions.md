---
description: "Conventions for the five shared Vite SPAs (analytics-web, admin-web, landing-panel, mun-sanandaj-web, walfare-web)."
applyTo: "analytics-web/**,admin-web/**,landing-panel/**,mun-sanandaj-web/**,walfare-web/**"
---

# Shared Vite SPA conventions

These five apps share one shape and one design system. Full map + live URLs:
[`docs/ai/PROJECT-MAP.md`](../../docs/ai/PROJECT-MAP.md). Read
[`docs/ai/GOTCHAS.md`](../../docs/ai/GOTCHAS.md) before non-trivial changes.

- **Standard folder shape**: `src/api/` (HTTP client + typed endpoints), `src/auth/` (OIDC
  PKCE + route guards), `src/query/` (TanStack Query keys + hooks), `src/theme/` (design
  tokens, light/dark), `src/layout/` (shell, nav, app switcher), `src/pages/` (screens),
  `src/components/ui/` (shared primitives). Match the existing file's style; keep the
  `components/ui` export surface stable (restyle, don't rename).
- **`src/layout/AppSwitcher.tsx` is byte-identical across all five SPAs.** If you add or rename
  a service in one, copy the exact file to the other four and **rebuild all five** — otherwise
  the un-rebuilt apps keep serving a stale launcher list.
- **Persian / RTL everywhere**; dates are shown in the **Jalali** calendar. Every page must work
  on a phone (fluid grids, wrapping text, scrollable tables, collapsing nav).
- **Auth** is the central OIDC IdP (`auth.myceo.ir`) via Authorization Code + PKCE — never add a
  second token issuer or store tokens outside the app's existing `src/auth/` flow.
- **Before claiming done**: `npm run build` + `npm run lint` (and tests if present) must pass.
- Never commit secrets — reference the variable name from `deploy/.env`, never its value.
