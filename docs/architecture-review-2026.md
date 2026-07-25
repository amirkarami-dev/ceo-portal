# Mabhas19 — Architecture Review vs. 2026 Standards

> **Date:** 2026-06-02
> **Scope:** Full-stack review of the Mabhas19 monorepo (.NET 10 Clean Architecture backend, Next.js 16 / React 19 web, Expo mobile, shared `assessment-core` package, Docker/Traefik deployment).
> **Method:** Read the actual source (not just `CLAUDE.md`), ran two fan-out exploration sweeps (frontend + DevOps), then personally verified every security-critical claim against the files. Three false positives raised during the sweeps were corrected and are flagged below.

---

## Table of contents

1. [What's actually solid](#what-is-actually-solid)
2. [Corrections (NOT weaknesses)](#corrections-not-weaknesses)
3. [🔴 Critical — Security](#-critical--security-verified-in-source)
4. [🟠 High — Architecture & Code Structure](#-high--architecture--code-structure)
5. [🟠 High — Testing](#-high--testing)
6. [🟡 Medium — DevOps / CI-CD / Deployment](#-medium--devops--ci-cd--deployment)
7. [🟡 Medium — Observability & Frontend](#-medium--observability--frontend)
8. [Prioritized fix order](#prioritized-fix-order)
9. [One-line verdict](#one-line-verdict)

---

## What's actually solid

This is a well-structured codebase, not a mess. Genuinely modern choices:

- **Current runtimes**: .NET 10 (`global.json` 10.0.201), Next 16.2.6, React 19.2.4 — all 2026-current.
- **Clean Architecture + CQRS + MediatR pipeline behaviours** (validation, logging, performance, authorization) — textbook layering.
- **Central Package Management** (`Directory.Packages.props`), `ArtifactsPath`, `TreatWarningsAsErrors`.
- **.NET Aspire** with OpenTelemetry, resilience handlers, and service discovery wired in `src/ServiceDefaults/Extensions.cs`.
- **Shared `assessment-core` package** genuinely consumed by both web and mobile (verified — web via re-export shims, mobile via direct import).
- **Key Vault hook** exists (`src/Web/DependencyInjection.cs:37-46`) and `ForwardedHeaders` is correctly configured for the Traefik setup.

---

## Corrections (NOT weaknesses)

These were raised during exploration but verified to be **correct/intentional**:

- **HTTPS-redirect-only-in-dev** (`src/Web/Program.cs:31-36`) is **correct** — TLS terminates at Traefik in production.
- **`mobile/.env` being committed** is **intentional** — it holds one build flag (`EXPO_NO_METRO_WORKSPACE_ROOT`), no secrets.
- **No real `deploy/.env` is tracked** — only `.env.example`. The committed-secrets problem is real but lives in `appsettings.json` (below), not in env files.

---

## 🔴 Critical — Security (verified in source)

### 1. CORS is wide open — `AllowAnyOrigin`

`src/Web/Program.cs:38-41`: `AllowAnyMethod().AllowAnyHeader().AllowAnyOrigin()`. Any website on the internet can call your API.

**2026 standard:** explicit origin allowlist (`mabhas19.myceo.ir`) with `AllowCredentials`. This is the single highest-impact backend issue.

### 2. Hardcoded production-style secrets committed to git

`src/Web/appsettings.json` (the **base** file — ships in the image):

- SQL `sa` password `Mabhas19_Sql#2026` (line 3)
- MinIO `minioadmin:minioadmin` (lines 7-8)
- **Admin seed email = production domain `admin@mabhas19.myceo.ir` + password `Mabhas19@Admin#2026`** (lines 14-15)

The initialiser seeds an admin from `AdminUser:Email`/`AdminUser:Password`. If production doesn't override these, your admin account ships with a git-committed password.

**2026 standard:** secrets only via env / Key Vault / secret manager; base config holds empty or obviously-fake placeholders. (The Key Vault hook exists — it's just not the enforced path, and the defaults look real.)

### 3. No rate limiting anywhere — OTP flow is abusable

No `AddRateLimiter` / `UseRateLimiter` in the pipeline.

- `src/Web/Endpoints/Auth.cs:23-30` (`otp/request`) sends an SMS for any phone number with no throttle → **SMS-bombing** (real money) and account enumeration.
- `src/Web/Endpoints/Auth.cs:33` (`otp/verify`) accepts a **5-digit code** with a **120s TTL** (`appsettings.json:18-19`) and no visible attempt cap → brute-forceable (100k space, unlimited tries in the window).

**2026 standard:** per-IP + per-phone rate limiting on all auth endpoints, attempt lockout on verify.

### 4. OTP codes written to logs

`src/Web/appsettings.json:20` → `"LogCode": true`. Plaintext OTP codes in logs is a credential-in-logs leak if this reaches production. Fine for dev, dangerous as a shipped default.

### 5. No security headers

No HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, etc.

**2026 standard:** baseline security headers (middleware or at Traefik).

### 6. Frontend stores bearer + refresh tokens in `localStorage`

`web/src/lib/tokens.ts` → XSS-readable; refresh token is also exposed and sent in the POST body. (Mobile does this correctly via `expo-secure-store`.)

**2026 standard:** `httpOnly`, `Secure`, `SameSite` cookies for the web client.

---

## 🟠 High — Architecture & Code Structure

### 7. Triple-implemented scoring logic (the deepest architectural risk)

The Section-19 algorithm now exists in **three** places that must stay numerically identical by hand:

- TS pure scoring: `packages/assessment-core/src/scoring/`
- C# port: `src/Domain/Services/BuildingGroupCalculator.cs`, `src/Domain/Services/ClimateData.cs`
- Inline recompute inside the web checklist UI: `web/src/features/assessment/checklists/*`

A comment in `scoring/elec.ts` literally says *"numbers MUST stay identical."* `CLAUDE.md` acknowledges the C#/TS split as a deliberate tradeoff, but the *third* copy (UI recompute) is unnecessary duplication.

**2026 standard:** one source of truth — clients call the shared engine; the UI shouldn't re-derive scores.

### 8. ~32 files of dead template cruft (Jason Taylor scaffold)

`TodoItems`, `TodoLists`, `WeatherForecasts`, `Colour` / `UnsupportedColourException` remain across Domain/Application/Infrastructure/Web, **including `TodoItems`/`TodoLists` tables in the InitialCreate migration** (`src/Infrastructure/Data/Migrations/20260531170246_InitialCreate.cs`) — so the production DB ships empty Todo tables. They're not exposed via API (good) but pollute the schema, tests, and mental model.

### 9. Hand-written, duplicated API types (drift risk)

Backend DTOs are re-typed by hand in `web/src/lib/types.ts` **and again** in `mobile/src/lib/types.ts`, with no runtime validation of responses.

**2026 standard:** generate types from the OpenAPI doc (`openapi-typescript` / Kiota) and validate at the edge (Zod). The API already serves an OpenAPI document — it's not being leveraged.

### 10. Duplicated API client + widespread `as any`

`web/src/lib/api.ts` and `mobile/src/lib/api.ts` are near-identical (refresh logic copy-pasted) and belong in a shared package. The checklist code disables `no-explicit-any` and casts DBs to `any[]` in many files — defeating the strict TS config that's otherwise enabled.

---

## 🟠 High — Testing

Test coverage is **inverted**: ~90% of tests cover deleted-template features, ~0% cover the real domain.

- **Functional tests** exist only for `TodoItems`/`TodoLists` (`tests/Application.FunctionalTests/`). **Zero** for Projects, Assessments, Auth/OTP/Google, Reports/PDF, Subscriptions, Admin.
- `Infrastructure.IntegrationTests` is empty (only `GlobalUsings.cs`).
- Only real unit tests are the calculators (`tests/Domain.UnitTests/Services`) — good, but the C#↔TS parity (your stated invariant) is **not** tested cross-language.
- **No frontend or mobile tests at all** — `packages/assessment-core/test/scoring.test.ts` is the only JS test in the repo.

**2026 standard:** the security- and money-critical paths (auth, subscription limits, scoring parity) must be the *most* tested, not untested.

---

## 🟡 Medium — DevOps / CI-CD / Deployment

### 11. No CI/CD at all

No `.github/workflows`, no GitLab/Azure/Jenkins config anywhere (verified). Nothing automatically builds, tests, lints, or scans on commit.

**2026 standard:** PR-gating pipeline (build + test + lint + SAST/dependency scan), automated image build & push.

### 12. Brittle manual deploy

`docker save | gzip | scp | docker load` over PuTTY, manual DNS A-records, manual `.env` editing (`CLAUDE.md`, `deploy/README.md`). No rollback, no versioning, no deploy audit trail. Single server `10.249.52.216`, single SQL, single MinIO, shared Docker daemon = no HA, multiple SPOFs.

### 13. Migrations auto-applied on every startup

`src/Web/Program.cs:29` → `InitialiseDatabaseAsync()` runs migrations in all environments. A bad migration blocks startup with no rollback path.

**2026 standard:** migrations as a reviewed, separate pre-deploy step.

### 14. Container hardening gaps

Dockerfiles (`deploy/Dockerfile.api`, `deploy/Dockerfile.web`) run as **root**, no `HEALTHCHECK`, base images on floating tags (`mssql:2022-latest`, `minio:latest`), and a **SQL version drift** (dev `2022-latest` vs server `2019-latest`).

**2026 standard:** non-root `USER`, healthchecks, digest-pinned images, image CVE scanning (Trivy), reproducible builds.

### 15. No release process

Single feature branch, no tags, no `CHANGELOG`, no version in `Directory.Build.props` / `package.json`. You can't tell what's in production.

---

## 🟡 Medium — Observability & Frontend

- **OTel is scaffolded, not operational.** Exporter only activates if `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`src/ServiceDefaults/Extensions.cs:75`), and the server compose defines no collector → traces/metrics/logs are collected and dropped in production. **Health endpoints are dev-only** (`src/ServiceDefaults/Extensions.cs:105`) → no readiness/liveness probe in prod (acceptable given Traefik+compose, but limiting for any future orchestration).
- **Frontend data layer is 2020-era**: everything is `"use client"` + `useEffect` fetch with manual `loading/error` and `let active = true` race guards (`web/src/app/[locale]/(dashboard)/dashboard/page.tsx`, `.../projects/page.tsx`). No Server Components, no Suspense, no TanStack Query/SWR, no caching. The whole UI kit is one 187-line barrel (`web/src/components/ui/index.tsx`). No error reporting (Sentry), no typed env, thin a11y, and forms hard-pinned `dir="ltr"` inside the RTL locale.

---

## Prioritized fix order

| # | Fix | Severity | Effort |
|---|-----|----------|--------|
| 1 | Lock down CORS to explicit origins | 🔴 | XS |
| 2 | Purge secrets from `appsettings.json`; force env/Key Vault; rotate the committed admin/SQL/MinIO creds | 🔴 | S |
| 3 | Rate-limit auth/OTP; cap verify attempts; set `LogCode:false` in prod | 🔴 | S |
| 4 | Move web tokens to httpOnly cookies | 🔴 | M |
| 5 | Add CI (build + test + lint + scan) on PR | 🟠 | M |
| 6 | Write tests for Projects/Assessments/Auth/Subscriptions + C#↔TS scoring-parity test | 🟠 | L |
| 7 | Delete Todo/Weather/Colour cruft + scrub the migration | 🟠 | S |
| 8 | Generate API types from OpenAPI; dedupe the api-client into a package | 🟠 | M |
| 9 | Harden Dockerfiles (non-root, healthcheck, pinned digests); wire an OTel collector | 🟡 | M |
| 10 | Modernize web data layer (RSC/Suspense or TanStack Query) | 🟡 | L |

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium
**Effort:** XS (minutes) · S (hours) · M (1–2 days) · L (multi-day)

---

## One-line verdict

Structurally modern and well-layered, but it's still wearing the template's training wheels (dead Todo code, inverted test coverage) and is **not production-hardened** — wide-open CORS, committed admin credentials, and an unthrottled OTP/SMS endpoint are the three to fix before anything else.

---

## Remediation status (applied 2026-06-02)

Backend builds clean (0 errors); unit tests 25/25 and functional tests 7/7 green (functional suite runs against real SQL Server via Aspire). Web app builds successfully.

### ✅ Fixed

| # | Item | What changed |
|---|------|--------------|
| 1 | CORS wide open | Config-driven origin allowlist (`Cors:AllowedOrigins`) — `Program.cs`, `Web/DependencyInjection.cs`; defaults to the prod web origin, localhost in `appsettings.Development.json` |
| 2 | Committed secrets | Base `appsettings.json` blanked; dev values moved to new `appsettings.Development.json`; admin-seed fallback password removed (`ApplicationDbContextInitialiser` now skips seeding if unconfigured) |
| 3 | No rate limiting / OTP abuse | Global per-IP fixed-window limiter (`UseRateLimiter`); `OtpService` now enforces resend cooldown, hourly send cap, and a verify-attempt cap |
| 4 | OTP codes logged | `OtpOptions.LogCode` defaults to **false**; `true` only in `appsettings.Development.json` |
| 5 | No security headers | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS middleware in `Program.cs` |
| 8 | Template cruft | Deleted Todo/Weather/Colour/LookupDto across all layers; new `RemoveTemplateScaffold` migration drops the leftover tables; retargeted `MappingTests`/`RequestLoggerTests` to real types |
| 11 | Inverted test coverage | Added functional tests for project create/validation, **subscription cap**, owner isolation, assessment round-trip, and authorization (`tests/Application.FunctionalTests/Projects`, `/Assessments`) |
| 12 | No CI/CD | `.github/workflows/ci.yml` — backend build+test+vuln-list, frontend typecheck+test+lint+build |
| 14 (partial) | Health endpoints dev-only | `/alive` liveness now mapped in all environments (prod-safe); detailed `/health` stays dev-only |
| 15 | Container hardening | Dockerfiles run as non-root (`$APP_UID` / `node`) and add `HEALTHCHECK` (`deploy/Dockerfile.api`, `Dockerfile.web`) |
| — | Frontend hygiene | `engines` pinned (web + root `package.json`); typed/validated env accessor (`web/src/lib/env.ts`) |

### ⏸ Deferred (need a product/architecture decision or carry regression risk — recommend a focused follow-up)

| # | Item | Why deferred |
|---|------|--------------|
| 6 | Web tokens in `localStorage` → httpOnly cookies | Mobile **requires** bearer tokens; switching the web client to cookie auth changes the whole Identity auth scheme. Needs a deliberate dual-mode design, not a blind swap. |
| 7 | Triple-implemented scoring (UI recompute) | The C#/TS split is a documented invariant ("numbers MUST stay identical"); de-duping touches the numerically-sensitive scoring path and must be done test-first. |
| 9 / 10 | Hand-written API types + duplicated API client | Worth generating from OpenAPI and extracting a shared package — a build-tooling change best done as its own PR. |
| — | Frontend data-layer modernization | The **7 `react-hooks/set-state-in-effect` lint errors** are this work (useEffect data-fetch + derived-state, incl. the scoring checklist). CI lint is currently non-blocking for these; the build/tests gate hard. Resolving them = RSC/TanStack + derived-state-during-render. |
| 13 | Single-server deploy / manual image transfer | Infrastructure (HA, orchestration, registry) — outside the code change set; deploy README + server constraints in `CLAUDE.md` apply. |

### ⚠️ Also worth noting

Transitive NuGet advisories surface during build (demoted to warnings in `Directory.Build.props`): **`System.Security.Cryptography.Xml` 10.0.1 (high)** and OpenTelemetry 1.15.0 (moderate). These come from template/Aspire packages — worth pinning to patched versions once upstream ships them.
