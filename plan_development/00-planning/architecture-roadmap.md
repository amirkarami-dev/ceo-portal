# Mabhas19 — Architecture Roadmap (living)

> **Updated:** 2026-06-04. The committed direction + current status. Companion to
> `architecture-decisions.md` (ADRs) and `01-development/sso-oidc.md` (the SSO design/contract).

## Chosen architecture (best + most standard for this project)

**Modular monolith backend + the OIDC auth service already extracted + a multi-app frontend
unified by SSO and shared packages.** Explicitly **not** microservices for the core domain, and
**not** runtime microfrontends.

Rationale: small team, single focused product evolving into a portal of a few apps (`mabhas19`,
`plan`, …). The 2026 consensus for that shape is "modular monolith first; extract a service only on
measured pressure; grow the portal as separate apps sharing packages + one login." The OIDC IdP is
the one justified extraction (shared cross-cutting concern, clean contract). Everything else stays in
the monolith until a real pressure (independent scaling / team ownership) appears.

### Explicitly NOT doing (and why)
- ❌ **Microservices** for projects/assessments/subscriptions — one consistency boundary; splitting buys distributed-transaction pain with no scaling/team driver.
- ❌ **Runtime microfrontends** (Module Federation / single-spa) — solves a many-teams problem we don't have. If one domain must compose many apps later, use **Next.js Multi-Zones** (build-time, lightweight), not federation.

## Workflow / branching
- **Trunk-based, no CI.** The GitHub Actions workflow was removed (commit `607db97`); the owner pushes
  directly to `main`. Verification is local (`dotnet build`/`dotnet test`, `npm run build`/`lint`, the
  `@mabhas19/assessment-core` vitest suite) before pushing. See ADR-014.
- **Short-lived feature branches** are used for risky multi-commit work, merged to `main` after local
  verification. The current one is **`feat/server-auth-ssr`** (see below).

---

## Current status

### ✅ Done — merged to `main` and in production
- **Central OIDC SSO** (OpenIddict IdP at `auth.myceo.ir`): Authorization Code + PKCE, signed JWTs,
  JWKS. The `mabhas19` API is a JWT **resource server**; web uses **Auth.js v5** (generic OIDC),
  mobile uses **expo-auth-session**. Users migrated (IDs preserved). Deployed (`f8e597a` + fixes).
  ADR-013. Contract: `01-development/sso-oidc.md`.
- **Secrets — SOPS + age.** `deploy/prod.enc.env` (AES-256-GCM, committed), `deploy/decrypt-env.sh`
  regenerates `deploy/.env` on the server at deploy time, `.sops.yaml` holds the age recipient. The
  age **private key lives only on the server** (`/srv/mabhas19/secrets/age.key`); `sops`/`age`
  binaries were hand-transferred to `/srv/mabhas19/bin` (the server can't reach GitHub). ADR-015.
- **Frontend data layer — TanStack Query v5 + bounded RSC.** All dashboard pages + `AuthProvider` use
  query/mutation hooks (mutations invalidate keys); server-prefetch + `HydrationBoundary` on the read
  pages (`lib/api-server.ts` via `auth()`); `IntegratedMgmtChecklist` now calls the tested pure
  `scoreIntegrated()` from `@mabhas19/assessment-core`. Merged (`8c90d02`, `cbd9859`, `e5561d6`).
  ADR-016.
- **Shared design-system package** (`packages/ui`) and **typed API SDK** (`packages/api-types`,
  generated from the OpenAPI doc) — done.
- **MediatR** pinned to free **12.5.0** (Apache-2.0); commercial-license requirement removed (ADR-002).

### 🚧 In-flight — `feat/server-auth-ssr` (NOT merged; deployed to prod for owner testing)
The auth boundary moved **client → server**, enabling SSR-first rendering with no client auth flicker.
This branch is **deployed to production for the owner to test** (the live web image is built from it),
but is **not yet merged to `main`** — pending the owner's login verification, then merge. Rollback to
the previous image is one command (`mabhas19-web:rollback`).
- **Middleware**: `next-intl` owns every response + a cheap **session-cookie presence gate** for
  protected routes (locale-aware redirect to `/login`). **Do NOT wrap `next-intl` in Auth.js's
  `auth()` helper** — behind Traefik it rebases the `/`→`/fa` rewrite to an absolute URL the standalone
  server proxies (`EAI_AGAIN`), breaking the default-locale site. (Learned the hard way; see
  `01-development/gotchas.md`.)
- **Identity from the OIDC token**: the `jwt` callback lifts `role`/`email`/`name` into the Auth.js
  session JWT; `isAdmin` is derived. The dashboard layout is a Server Component that resolves identity
  via `auth()` and seeds `<AuthProvider initialUser>`. The client `<RequireAuth>` is **removed**.
- **`/admin` role gate** is a **Server Component layout** (`(dashboard)/admin/layout.tsx` via `auth()`).
- **SSR-first prefetch** extended to `subscription` + `projects/[id]`.
- ADR-017.

### 📋 Decided (no code, or standing policy)
- **AutoMapper licensing** — owner **accepts** the vendor commercial-license model as a **non-blocker**;
  stays on 16.x, no migration. (Supersedes the earlier "resolve before go-live" tracking.) ADR-018.
- **ArvanCloud CDN** — keep the CDN **ON** (orange) for `mabhas19.myceo.ir` (static web); **DNS-only**
  (grey) for `api.*`/`auth.*`/`s3.*` (dynamic/auth/storage). The `auth.myceo.ir → 185.143.234.234`
  IP pin (`extra_hosts`) is **kept** (update only if the edge IP rotates). ADR-019.

### ⏭️ Deferred follow-ups (tracked, not blocking)
- **Token refresh rotation** — the OIDC access token has a 30-min lifetime; today expiry forces a
  re-auth redirect (same as before). Add silent refresh in the Auth.js `jwt` callback when wanted.
- **Phase 3 — checklist state machines.** Refactor the `set-state-in-effect` effects in the scoring
  checklists, **test-first** (pin behavior, then refactor). The score math is already the tested pure
  function; only the effect-driven orchestration remains.
- **Full RSC** for the `admin/users` and `assessment` pages (left client-fetch — role-gated/heavy and
  fully interactive, respectively; low value to split).
- **Observability** — OTel collector + `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **Image hardening** — pin base images by digest + Trivy CVE scan (now a manual pre-deploy step, no CI).
- **Admin user-management** — move into the IdP (`src/Auth`) rather than the API.

---

## Roadmap ahead
- **Portal — `plan.myceo.ir`** (when it arrives): a **separate** Next.js app in the monorepo (client
  `plan-web` already seeded in the IdP), consuming the shared packages + SSO. Not a microfrontend.
  It will inherit the server-auth-SSR pattern from `mabhas19` web.
- **Backend** — keep the modular monolith; enforce module boundaries; extract **reporting/PDF** (or
  **notifications**) to a service **only on measured pressure**, never preemptively.
