# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Before you start — load the project context

**Read [`docs/ai/START-HERE.md`](docs/ai/START-HERE.md) first.** It is the entry point for any
assistant and points at:

- [`docs/ai/PROJECT-MAP.md`](docs/ai/PROJECT-MAP.md) — what exists, which app owns what, live URLs
- [`docs/ai/GOTCHAS.md`](docs/ai/GOTCHAS.md) — **traps that already cost hours; read in full**
- [`docs/worklog/`](docs/worklog/README.md) — what was done recently, and why
- [`docs/ai/OPERATIONS.md`](docs/ai/OPERATIONS.md) — build / deploy / verify on the server

**And when you finish a task, you MUST write `docs/worklog/YYYY-MM-DD-<slug>.md`**
from `docs/worklog/TEMPLATE.md`, add it to the worklog index, and update `GOTCHAS.md` /
`PROJECT-MAP.md` / `OPERATIONS.md` if the task taught something reusable. A task is not
finished until that file exists.

## What this is

This repo (`ceo-portal`) is a **Persian/RTL monorepo**: one .NET 10 Clean Architecture
backend + a central OIDC identity provider serving **several front ends**. The flagship app is
**Mabhas19 (مبحث ۱۹)** — Iran's National Building Code **Section 19, Appendix 5 (5th ed.)**
building‑energy assessment (Next.js 16, SQL Server, MinIO/S3). Most commands and gotchas below
are Mabhas19‑specific; for the full app‑by‑app map and live URLs see
[`docs/ai/PROJECT-MAP.md`](docs/ai/PROJECT-MAP.md).

### Apps at a glance (see PROJECT-MAP for details)

| Folder | App | Stack |
|---|---|---|
| `src/` | API (all features) + `src/Auth` OIDC IdP | .NET 10 Clean Architecture |
| `web/` | Mabhas19 energy assessment | Next.js 16 |
| `kurdnezam-web/` | Kurdnezam public site | Next.js (own `AGENTS.md`/`CLAUDE.md`) |
| `analytics-web/`, `admin-web/`, `landing-panel/`, `mun-sanandaj-web/`, `walfare-web/` | analytics / user admin / CMS / municipality / engineers' welfare | Vite SPAs (shared shape) |
| `mobile/` | mobile app | Expo / React Native |
| `packages/` | `assessment-core` (scoring), `ui`, `api-types` | shared TS packages |

**Shared SPA convention** (`analytics-web`, `admin-web`, `landing-panel`, `mun-sanandaj-web`,
`walfare-web`): identical `src/{api,auth,query,theme,layout,pages,components/ui}` shape, and the
app launcher `src/layout/AppSwitcher.tsx` is **byte‑identical across all five** — change one,
copy to all five and rebuild all five, or the others serve a stale list.

## Commands

### Backend (.NET 10, solution `ceo-portal.slnx`)
```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # SQL Server (sa) + MinIO (minioadmin) — needed to run the API
dotnet build ceo-portal.slnx                            # build all
dotnet run --project src/Web                            # API on http://localhost:5000  (Scalar docs at /scalar)
dotnet test                                             # all tests
dotnet test tests/Domain.UnitTests/Domain.UnitTests.csproj   # one project
dotnet test --filter "FullyQualifiedName~ClimateDataTests"   # one test/class
```
Build output goes to `./artifacts/` (not `bin/obj`, via `ArtifactsPath` in `Directory.Build.props`).

EF Core migrations (the `dotnet-ef` global tool MUST match EF Core 10 — `dotnet tool update -g dotnet-ef --version "10.0.*"`):
```bash
dotnet ef migrations add <Name> --project src/Infrastructure --startup-project src/Web --output-dir Data/Migrations
```
Migrations are applied automatically on API startup (every environment) by `ApplicationDbContextInitialiser`, which also seeds the `Administrator`/`User` roles and an admin user from `AdminUser:Email`/`AdminUser:Password` config.

### Frontend (`web/`, Next.js 16)
```bash
cd web && npm install
npm run dev      # http://localhost:3000
npm run build    # production build (must pass before deploy)
npm run lint
```
`web/.env.local` sets `NEXT_PUBLIC_API_BASE` (dev `http://localhost:5000`). This is baked at build time. `next.config.ts` must keep `output: "standalone"` for the Docker image.

## Architecture

### Backend layering (`src/`, from the Jason Taylor Clean Architecture template + .NET Aspire)
- **Domain** — entities (`Project`, `Assessment`, `Subscription`, `AssessmentReport`) and the Section 19 calculators in `Domain/Services`: `BuildingGroupCalculator` and `ClimateData`. **These are faithful ports of the legacy JS calculator — keep them numerically identical; they're covered by unit tests.**
- **Application** — CQRS use cases (MediatR), FluentValidation validators, AutoMapper profiles (defined as nested `Mapping : Profile` classes inside DTOs). Service contracts live in `Application/Common/Interfaces`.
- **Infrastructure** — EF Core + **Microsoft SQL Server** and the implementations: `MinioFileStorage` (IFileStorage), `QuestPdfReportGenerator` (IReportGenerator), `SubscriptionService`, `UserAdminService`, `NezamMohandesiProjectProvider`. Auth is **JWT bearer validation** (`AddJwtBearer`) against the central OIDC IdP — the old ASP.NET Identity + OTP/Google sign‑in moved to the separate IdP app **`src/Auth`** (its own `Mabhas19AuthDb`).
- **Web** — Minimal‑API endpoints. Each `IEndpointGroup` class is auto‑mapped at **`/api/{ClassName}`**. The API is a **JWT resource server** — **no `MapIdentityApi`**; it validates IdP tokens and exposes only `GET /api/Users/me` (claims) + `/api/Admin/*`. The DI extension lives in `Infrastructure/DependencyInjection.cs` → `AddMabhas19Services`.

### Key architectural decision: where scoring lives
The interactive **6‑checklist scoring engine runs in the FRONTEND**. The pure scoring logic lives in the shared package **`@mabhas19/assessment-core`** (`packages/assessment-core`, no React, vitest‑tested); the web UI in `web/src/features/assessment` renders it. The **backend is the system of record**: `Assessment.InputJson`/`ResultJson` are stored as SQL Server **`nvarchar(max)`** plus denormalised `TotalScore`/`MaxScore`, and the PDF is generated from the stored result. So scoring changes go in `packages/assessment-core/*` (math) / `web/src/features/assessment/*` (UI), **not** the backend.

### Auth & roles — central OIDC SSO
- Auth is a **central OIDC Identity Provider** (OpenIddict, app `src/Auth`, live at `auth.myceo.ir`, own `Mabhas19AuthDb`). All sign‑in methods — username/password, **mobile OTP**, **Google ID‑token** — live in the IdP, the sole token issuer. The API (`src/Web`) is a **JWT resource server** (`AddJwtBearer`, authority = `auth.myceo.ir`, audience = `mabhas19.api`, `RoleClaimType="role"`, `NameClaimType="name"`); it has **no `MapIdentityApi` / no `/api/Auth/*`**.
- **Web** signs in with **Auth.js v5** generic OIDC (Authorization Code + PKCE, httpOnly session cookie); **mobile** with **expo-auth-session** (PKCE, expo-secure-store).
- Roles: **`Administrator`** (manage users + subscriptions) and **`User`** (default). `/api/Admin/*` is gated with `RequireRole(Administrator)`; `GET /api/Users/me` returns `{ roles, isAdmin }`.
- **Subscriptions** — every user gets a Free plan, but the per‑user project cap is **no longer enforced** (active users create **unlimited** projects). `ISubscriptionService.EnsureCanCreateProjectAsync` only throws a `ValidationException` (under the `Subscription` field) when the account is **inactive**; `MaxProjects` is retained on the record for admin display only. **User‑facing subscription UI is hidden** (no pricing/plans on the landing page, no dashboard subscription nav/cards, `/subscription` redirects to the dashboard) — admins still manage plans under `/api/Admin/*`.
- **Web auth boundary is server-side** (branch `feat/server-auth-ssr` — deployed to prod for testing, not yet merged): route protection is a `middleware.ts` **session-cookie presence gate**; `(dashboard)/layout.tsx` (Server Component) reads `auth()` and seeds `<AuthProvider initialUser>`; `/admin` is gated by `(dashboard)/admin/layout.tsx` (server). The old client `<RequireAuth>` is **removed**. Identity (role/email/name → isAdmin) is lifted from the OIDC token into the Auth.js session JWT.

### Frontend structure (`web/src`)
- Next.js App Router under `app/[locale]`. **i18n via next-intl**: `fa-IR` (default, **RTL**) + `en-US` (LTR), `localePrefix: "as-needed"` → fa is served at `/`, en at `/en/...`. The real `<html lang/dir>` + providers are in `app/[locale]/layout.tsx`.
- Route groups: **root `/` = public landing page** (`components/landing/*`); `(auth)` = public login (redirects to the IdP); `(dashboard)` = **protected server-side** — `middleware.ts` does the session-cookie presence gate, and `(dashboard)/layout.tsx` (Server Component) resolves identity via `auth()` and seeds `<AuthProvider initialUser>`. The admin area (`admin/users`) is gated by `(dashboard)/admin/layout.tsx` (server). **No client `<RequireAuth>`.**
- **Design system**: shadcn‑style CSS variable tokens in `app/globals.css` (emerald primary) with light/dark via `components/theme-provider.tsx`. Shared UI primitives in `components/ui` — **keep its export surface stable (restyle, don't rename)** since every page imports from it.
- Data layer is **TanStack Query + RSC server-prefetch** (`lib/queries.ts` hooks; `lib/api-server.ts` prefetches read pages via `auth()`). API layer in `lib/`: `api.ts` (fetch wrapper; attaches the bearer from Auth.js `getSession()`), `endpoints.ts` (`projectsApi`/`subscriptionApi`/`adminApi`), `auth-context.tsx` (`useAuth` → `{ user, roles, isAdmin, ready, logout }`, **server-seeded**, no `me` fetch). Tokens are an **httpOnly Auth.js session cookie** — `lib/tokens.ts` / localStorage are **gone**. Use locale‑aware `Link`/`useRouter` from `@/i18n/navigation`, not `next/link`.

## Gotchas

- **Build is strict**: `TreatWarningsAsErrors=true`. NuGet‑audit advisories on transitive template packages (`OpenTelemetry`, `System.Security.Cryptography.Xml`) are demoted to warnings via `WarningsNotAsErrors` (`NU1608;NU1902;NU1903`) in `Directory.Build.props`. `.NET 10` also turns deprecations into errors (e.g. use `KnownIPNetworks`, not `KnownNetworks`).
- **`ValidationException` is ambiguous** between `FluentValidation.ValidationException` (a global using) and the app's `Application.Common.Exceptions.ValidationException` — alias the app one when using it.
- **Aspire namespace clash**: the `Mabhas19.Application.Projects` namespace shadows Aspire's generated global `Projects` namespace in functional tests — qualify as `global::Projects.TestAppHost`.
- **MediatR** is pinned to free **12.5.0** (Apache‑2.0) in `Directory.Packages.props` — 13+ needs a commercial license, so don't bump it. **AutoMapper** uses the same vendor model but its license is **accepted** (stays on 16.x).
- **Don't wrap next-intl in Auth.js's `auth()` middleware.** Behind Traefik it rebases next-intl's `/`→`/fa` rewrite to an absolute URL the standalone server proxies → `EAI_AGAIN` (breaks the fa site — it happened in prod). Keep next-intl owning the response; gate with a cookie-presence check; do role checks server-side (RSC `auth()`).
- Use `Guard.Against.NotFound(...)` (Ardalis) for 404s; `ForbiddenAccessException` → 403 (see `ProblemDetailsExceptionHandler`).

## Deployment (`deploy/`)

- `docker-compose.dev.yml` — local SQL Server + MinIO only. `docker-compose.local.yml` — full stack in containers. `docker-compose.server.yml` — production, **attaches to the server's existing Traefik** (external network `traefik`, cert resolver `myresolver` = ArvanCloud DNS challenge) instead of running its own.
- **Live**: `mabhas19.myceo.ir` (web), `api.mabhas19.myceo.ir`, **`auth.myceo.ir` (OIDC IdP)**, `s3.mabhas19.myceo.ir`, on server `10.249.52.216` under `/srv/mabhas19`. The server compose has 5 services: `sqlserver`, `minio`, `auth` (IdP), `api`, `web`.
- The server is in Iran: **Docker Hub's blob CDN and `mcr.microsoft.com` are blocked**. So: build the `api`/`web`/`auth` images locally (where `mcr` works), `docker save | gzip` → transfer (`pscp`) → `docker load`; the **SQL Server** image is loaded from a transferred tar and **MinIO** is pulled via the **`docker.arvancloud.ir`** mirror. **Do not restart the shared Docker daemon** — it runs other production stacks (mailcow, supabase). Deploy **only** `api`/`web` with `up -d --no-deps <svc>`; tag the current image `:rollback` first for instant revert.
- **Secrets — SOPS + age**: prod secrets are committed **encrypted** as `deploy/prod.enc.env`; `deploy/decrypt-env.sh` regenerates `deploy/.env` on the server (run it before `docker compose up`). The age private key lives only on the server (`/srv/mabhas19/secrets/age.key`); the `sops`/`age` binaries are in `/srv/mabhas19/bin`.
- **CDN / DNS (ArvanCloud)**: CDN **ON** (orange) for the web host only; **DNS-only** (grey) for `api`/`auth`/`s3`. `auth.myceo.ir` is **IP-pinned** (`extra_hosts → 185.143.234.234`) on web+api so Auth.js/JWKS resolution is deterministic (update if the edge IP rotates).
- **No CI** — push directly to `main`; verify locally (`dotnet build`/`test`, `npm run build`/`lint`). The **web image** bakes `NEXT_PUBLIC_*` at build and needs Auth.js env at **runtime**: `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `AUTH_URL`, `AUTH_MABHAS19_ISSUER`/`ID`/`SECRET`.
- SSH uses PuTTY `plink`/`pscp -pw` (no `sshpass` available). In production MinIO is reached via its public host (`Minio__Endpoint=s3.mabhas19.myceo.ir`, `UseSSL=true`) so presigned report URLs are valid for browsers.
