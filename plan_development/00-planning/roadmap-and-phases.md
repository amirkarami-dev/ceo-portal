# Roadmap & Phases — Reference (Mabhas19) build order

This is the **real order** the reference project was built in, generalised so a fresh project can
follow it. Build back-to-front of the dependency chain: domain correctness first, then a thin
working slice per client, then the cross-cutting features, then sharing, then mobile, then deploy.

**Each phase was verified before moving on** (`dotnet build` with warnings-as-errors, `dotnet test`,
`npm run build`, and a manual smoke test). Treat the Exit criteria as a gate — do not start the next
phase until the current one is green.

Global Entry criterion for phase 1: charter signed (`project-charter.template.md`), stack agreed (`tech-stack.md`).

---

## Phase 1 — Backend core: Domain → Application → Infrastructure → Web
**Goal.** A running API with the domain calculation, persistence, and CRUD for the core entities — no auth yet.

**Steps.**
1. Scaffold the Clean Architecture solution (Jason Taylor template + Aspire): `Domain`, `Application`, `Infrastructure`, `Web`, `AppHost`, `ServiceDefaults`, `Shared`, test projects. Set up `Directory.Build.props` (strict build, artifacts path) and `Directory.Packages.props` (central versions).
2. **Domain first:** port the calculation into `Domain/Services` (faithful port of `<reference source>`); define entities (`<Project>`, `<Assessment>`, `<Subscription>`, `<Report>`). Write **unit tests asserting numeric parity** with the reference.
3. **Application:** CQRS commands/queries (MediatR) for the core entity CRUD; FluentValidation validators; AutoMapper DTOs; service interfaces in `Application/Common/Interfaces`.
4. **Infrastructure:** EF Core + `<DB provider>`; `ApplicationDbContext`; `ApplicationDbContextInitialiser` (migrate-on-startup); first migration. Store `<Assessment>` input/result as a **text column** + scalar scores.
5. **Web:** minimal-API endpoint groups auto-mapped at `/api/{ClassName}`; Scalar docs at `/scalar`; health checks. Bring up backing services with `deploy/docker-compose.dev.yml`.

**Entry criteria.** Charter + stack agreed; .NET SDK pinned via `global.json`; `dotnet-ef` matches EF Core version.

**Exit / verification.**
- [ ] `dotnet build <Solution>.slnx` passes with `TreatWarningsAsErrors=true`.
- [ ] Domain parity unit tests pass.
- [ ] `dotnet run --project src/Web` starts; migrations apply automatically; `/scalar` lists the endpoints.
- [ ] Core entity CRUD works via Scalar/curl against a real DB.

---

## Phase 2 — Web shell: routes + design system
**Goal.** A Next.js app that builds and renders the route skeleton with the design system — no real features yet.

**Steps.**
1. Create `web/` (Next.js App Router, TypeScript, `output: "standalone"`). Set `NEXT_PUBLIC_API_BASE` in `.env.local`.
2. Wire **i18n** (next-intl): locales `<primary RTL>` (default) + `<secondary LTR>`, `localePrefix: "as-needed"`, real `<html lang dir>` in `app/[locale]/layout.tsx`, message catalogs, locale-aware `Link`/`useRouter`.
3. Build the **design system**: Tailwind v4, CSS-variable tokens (shadcn-style, `<primary colour>`), light/dark theme provider, shared UI primitives in `components/ui` (stable export surface), self-hosted font.
4. Stub the route groups: public landing `/`, `(auth)` login/register, `(dashboard)` protected shell.
5. Build the `lib/` API layer: `api.ts` (fetch wrapper), `endpoints.ts`, `tokens.ts`, `auth-context.tsx` (stubs OK).

**Entry criteria.** Phase 1 API reachable locally.

**Exit / verification.**
- [ ] `npm run build` (web) passes; `npm run lint` clean.
- [ ] All routes render; locale switch flips `dir`/`lang`; dark mode works.
- [ ] Dashboard routes redirect to login when unauthenticated (stub guard).

---

## Phase 3 — Assessment scoring engine (frontend)
**Goal.** The interactive multi-checklist scoring runs in the browser with live results, matching the domain.

**Steps.**
1. Port the scoring engine into `web/src/features/assessment` (verbatim from the legacy app): the checklist modules + lookup data tables + types.
2. Build the interactive UI: each checklist section, live total/max score.
3. Wire **save**: POST input + computed result + scores to the Phase-1 endpoints; load existing assessments.
4. Add unit tests asserting the frontend engine matches the backend Domain (same fixtures).

**Entry criteria.** Phase 2 shell + Phase 1 assessment endpoints exist.

**Exit / verification.**
- [ ] Completing the checklists updates the score live, with no per-keystroke server calls.
- [ ] Saving persists; reloading restores inputs/results.
- [ ] Frontend ↔ backend parity tests pass.

---

## Phase 4 — Auth (password / OTP / Google) + roles + admin area
**Goal.** Real sign-in by all committed methods, role-aware UI, and a working admin area.

> **Superseded in production.** The reference project replaced this single-service
> bearer-token model with **central OIDC SSO** (ADR-013) and a **server-side auth-SSR
> boundary** (ADR-017): no client `<RequireAuth>`; `AuthProvider` is server-seeded;
> route protection is a `middleware.ts` session-cookie gate; `/admin` is gated by a Server
> Component layout; sign-in redirects to the IdP (the API exposes **no** auth endpoints — no
> `MapIdentityApi`, no OTP/Google). Token-refresh rotation is deferred. See Phase 12,
> `01-development/sso-oidc.md`, and `01-development/auth-and-roles.md` (historical).

**Steps.**
1. Backend: confirm Identity API under `/api/Users/*`; add **OTP** (`/api/Auth/otp/request|verify`) and **Google** (`/api/Auth/google`) endpoints that issue Identity bearer tokens via the bearer scheme. Seed `Administrator`/`User` roles + admin user on startup. `GET /api/Users/me` → `{ roles, isAdmin }`.
2. Backend admin: `/api/Admin/*` gated with `RequireRole(Administrator)` (list users, change role/plan).
3. Web: implement real `auth-context.tsx` (`useAuth` → `user`/`isAdmin`), token storage + **auto-refresh** in `api.ts`, login/register screens for all methods, `<RequireAuth>` guard.
4. Web admin: `admin/users` route shown only when `isAdmin`.

**Entry criteria.** Phases 1–2 done.

**Exit / verification.**
- [ ] Sign in via password, OTP, and Google → bearer token; session survives refresh (auto-refresh works).
- [ ] Non-admin gets 403 from `/api/Admin/*` and sees no admin UI; admin can list users and change a plan/role.
- [ ] `dotnet test` (incl. auth) and `npm run build` pass.

---

## Phase 5 — Public landing page
**Goal.** A polished public marketing/landing page at `/` in both locales.

**Steps.**
1. Build `components/landing/*` (hero, features, CTA to sign-up) using the design system.
2. Fully localise (RTL primary + LTR secondary); ensure SEO basics (title/description per locale).
3. Verify it's public (no auth) and links into `(auth)`.

**Entry criteria.** Phases 2 & 4 (so CTAs route to real auth).

**Exit / verification.**
- [ ] `/` renders for anonymous users in both locales with correct `dir`.
- [ ] Lighthouse/quick a11y pass acceptable; `npm run build` passes.

---

## Phase 6 — Subscriptions + PDF / object storage
**Goal.** Subscription record + active-account gate, and downloadable server-rendered reports.

**Steps.**
1. Backend: `ISubscriptionService.EnsureCanCreateProjectAsync` (active-account gate — the project cap is **not enforced**, ADR-020), error surfaced under a `Subscription` field; call it on project create. To enforce a real cap instead, re-add a count check (see `subscriptions.md` §5).
2. Backend: `IReportGenerator` (QuestPDF) renders the PDF from the **stored** result; `IFileStorage` (MinIO) uploads it; return a **presigned URL** against the public storage host.
3. Web: "Download report" action opens the presigned URL. (No user-facing subscription/usage UI — it's hidden.)

**Entry criteria.** Phases 1, 3, 4 done; MinIO running (compose).

**Exit / verification.**
- [ ] An inactive account is blocked with the `Subscription` field error (not a 500); active users create unlimited projects (no cap — ADR-020).
- [ ] A report PDF generates, uploads, and downloads via presigned URL; the RTL/script font renders correctly.

---

## Phase 7 — Extract the shared package (web + mobile consume it)
**Goal.** The scoring engine becomes the single source of truth in `packages/<core>`, consumed by web (mobile follows).

**Steps.**
1. Create the npm-workspaces root (`workspaces: ["packages/*","web","mobile"]`).
2. Move the engine from `web/src/features/assessment` into `packages/<core>` (pure TS, `main/module/types → ./src/index.ts`, `src/scoring/*` + `src/data/*`). Add Vitest parity tests.
3. Point web at it: dependency `"@<scope>/<core>": "*"`, `transpilePackages` in `next.config.ts`, `outputFileTracingRoot` at repo root; replace the in-web copy with imports.

**Entry criteria.** Phase 3 engine is stable and tested.

**Exit / verification.**
- [ ] `npm install` at root links the workspace; web imports from `@<scope>/<core>`.
- [ ] `npm run build` (web) still passes; package Vitest tests pass; **scores unchanged** (no regression vs. Phase 3).

---

## Phase 8 — Mobile app (Expo)
**Goal.** A React Native app that signs in and runs the assessment using the shared package.

**Steps.**
1. Scaffold `mobile/` (Expo SDK 54, expo-router typed routes, `newArchEnabled: true`); add it to workspaces; configure `metro.config.js` to resolve the monorepo root + the shared package.
2. Auth on device: reuse the API layer; store tokens in **expo-secure-store**; OTP/Google via expo-web-browser/linking; `extra.apiBase` → prod API.
3. Build the core screens (project list, assessment, result) consuming `@<scope>/<core>`.

**Entry criteria.** Phase 7 (shared package) + Phase 4 (auth endpoints).

**Exit / verification.**
- [ ] `expo start` runs the app; `tsc --noEmit` passes.
- [ ] Sign-in works on a device/emulator; assessment computes identically to web.

---

## Phase 9 — Deploy behind existing Traefik (image-transfer pipeline)
**Goal.** Production is live on the target host over HTTPS, attached to the host's Traefik, without disturbing other stacks.

**Steps.**
1. Author `deploy/Dockerfile.api`, `Dockerfile.web` and `docker-compose.server.yml` (attach to external `traefik` network; cert resolver `<resolver>`; hostnames web/api/storage). Web image: `output: "standalone"`, API base baked at build.
2. **Build images locally** (where `mcr` works), `docker save | gzip` → `pscp -pw` → `docker load` on the host. Pull `<db>`/`minio` via the **`docker.arvancloud.ir`** mirror.
3. Set prod config/secrets (DB, MinIO public endpoint with SSL, admin user, OTP/Google keys). Bring the stack up **without restarting the shared daemon**.

**Entry criteria.** Phases 1–7 done (a deployable web+API); host access (PuTTY `plink`/`pscp`) and DNS/cert ready.

**Exit / verification.**
- [ ] `https://<web>`, `https://<api>`, `https://<storage>` all serve over valid TLS.
- [ ] Migrations applied; admin user seeded; a full smoke test (sign in → create project → assessment → PDF) passes in prod.
- [ ] Other stacks on the host are unaffected.

---

## Phase 10 — Database migration (e.g. Postgres → SQL Server)
**Goal.** Move to the production DB provider with no data/behaviour loss. *(Skip if you started on the target provider.)*

**Steps.**
1. Swap the EF provider package + `Aspire.Hosting.<DB>`; change `Use<Provider>(...)` and connection string.
2. **Delete and regenerate migrations** for the new provider (`dotnet ef migrations add Initial`). Text columns for JSON stay portable — entity mapping unchanged.
3. Update compose DB service + volume + mirror reference; migrate/seed data; re-run the test suite.

**Entry criteria.** A reason to switch (ops parity with the target environment).

**Exit / verification.**
- [ ] `dotnet build`/`dotnet test` pass on the new provider.
- [ ] Migrate-on-startup creates the schema; the prod smoke test passes against the new DB.

---

## Phase 11 — Release Android APK
**Goal.** A shippable APK of the mobile app.

**Steps.**
1. Configure `eas.json` and `app.json` (package id, version, icons); set `extra.apiBase` to prod.
2. Run the EAS build to produce a release APK; install on a device and smoke-test against prod.

**Entry criteria.** Phases 8 & 9 (mobile works against the live API).

**Exit / verification.**
- [ ] EAS produces an APK (`mobile/<app>.apk`).
- [ ] Installed app signs in and runs the assessment against production.

---

## Phase 12 — Post-build evolution
**Goal.** The architecture changes made after the initial 1–11 build, as the product grew toward a portal. Each is recorded as an ADR.

- **Central OIDC SSO** — extracted a dedicated OpenIddict IdP (`auth.myceo.ir`); the API became a JWT resource server, web uses Auth.js, mobile uses expo-auth-session. **Deployed to production.** (ADR-013; `01-development/sso-oidc.md`.)
- **Production secrets — SOPS + age** — encrypted `deploy/prod.enc.env` committed to git; decrypted on the server at deploy time. (ADR-015.)
- **Frontend data layer — TanStack Query v5 + bounded RSC prefetch** — replaced per-page fetch-in-effect; read pages prefetch server-side with `HydrationBoundary`. (ADR-016.)
- **Server-side auth boundary (SSR)** — route protection moved client → server: `middleware.ts` cookie gate, server-seeded `<AuthProvider>`, RSC `/admin` role gate, no `<RequireAuth>`. **In-flight on `feat/server-auth-ssr` (deployed for testing, not merged).** (ADR-017.)
- **Trunk-based, no CI** — removed the GitHub Actions workflow; push directly to `main`, verify locally. (ADR-014.)

## At-a-glance dependency order
```
1 backend core ─┬─> 2 web shell ─┬─> 3 scoring (web) ──> 7 shared pkg ─┬─> 8 mobile ──> 11 APK
                │                ├─> 4 auth + admin                    │
                │                └─> 5 landing                         │
                └────────────────────> 6 subscriptions + PDF ─────────┘
                                                  │
                                  9 deploy (Traefik + image transfer)
                                                  │
                                  10 DB migration (provider swap)
```
Phases 2–6 share Phase 1; 5 depends on 4; 7 depends on 3; 8 depends on 7+4; 9 needs a deployable web+API (1–7); 10 can run any time there's a reason; 11 needs 8+9.
