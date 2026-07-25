# Verification Checklist (per phase)

Hard gates for each phase of building/migrating `<APP_NAME>`. **Do not start a phase until the
previous one is fully checked.** Run the `reviewer` agent at each gate — it RUNS the commands and
reports evidence, not assertions. Mirrors `00-planning/roadmap-and-phases.md`; replace
`<PLACEHOLDER>` tokens per `05-templates/README.md`.

Legend: each box is a command result or an observable outcome you must confirm.

---

## Phase 0 — Planning gate
- [ ] Charter filled (`00-planning/project-charter.template.md`) and stack agreed (`tech-stack.md`).
- [ ] ADRs recorded/appended in `00-planning/architecture-decisions.md` (layering, CQRS/MediatR, EF provider, central OIDC SSO + roles, subscription account-gate (project cap removed — ADR-020), scoring-in-frontend, monorepo + shared package, Expo/APK, Traefik image-transfer deploy).
- [ ] `roadmap-and-phases.md` refreshed with concrete names and per-phase Exit gates.
- [ ] DB provider decided (start on SQL Server to skip Phase 10).

## Phase 1 — Backend core
- [ ] `dotnet build <PROJECT_NAME>.slnx` passes with `TreatWarningsAsErrors=true` (no warnings); output under `./artifacts/`.
- [ ] **Domain parity unit tests pass** (the ported calculator is numerically identical to the reference/legacy).
- [ ] `dotnet test` passes (happy-path + validation-failure coverage on new commands/queries).
- [ ] `dotnet run --project src/Web` starts; **migrations apply automatically** on boot.
- [ ] `/scalar` lists every `IEndpointGroup` under `/api/{ClassName}`.
- [ ] Core entity CRUD works via Scalar/curl against a real DB (dev compose up).
- [ ] New `DbSet`s are on **both** `IApplicationDbContext` and `ApplicationDbContext`; reads use `AsNoTracking().ProjectTo<>`; mappings are nested `Mapping : Profile`.
- [ ] No `jsonb`, no `KnownNetworks`, no un-aliased `ValidationException`; `dotnet-ef` matched EF Core 10 for any migration.

## Phase 2 — Web shell
- [ ] `npm run build` (web) passes.
- [ ] `npm run lint` is clean.
- [ ] All routes render; the locale switch flips `<html dir>`/`lang` (RTL primary, LTR secondary).
- [ ] Dark mode works.
- [ ] Dashboard routes redirect to login when unauthenticated (stub guard OK at this phase).

## Phase 3 — Scoring engine (frontend)
- [ ] Completing the checklists updates total/max score **live**, with **no per-keystroke server calls**.
- [ ] Saving persists input + computed result + scores; reloading restores them.
- [ ] **Frontend <-> backend parity tests pass** (same fixtures, identical results).

## Phase 4 — Auth + roles + admin
Auth is **central OIDC SSO** — an **OpenIddict IdP** owns all login methods (password/OTP/Google);
web is an **Auth.js v5** OIDC client (Authorization Code + PKCE, httpOnly cookie), mobile uses
**expo-auth-session** (PKCE). The IdP issues **signed JWT access tokens** (30-min, **no auto-refresh**
— expiry forces a re-auth redirect). The API is a **JWT resource server** (`AddJwtBearer`,
authority = IdP, audience = `<API_AUDIENCE>`) — it has **no** `/api/Auth/*` (OTP/Google) or
`MapIdentityApi` endpoints.
- [ ] Sign in via **password**, **OTP**, and **Google** through the **IdP** each lands back authenticated (web httpOnly cookie / mobile secure store), and the API accepts the IdP-issued JWT.
- [ ] Identity is **server-resolved**: the Auth.js session JWT carries `role`/`email`/`name` (`isAdmin` derived); the `(dashboard)` layout (Server Component) seeds `<AuthProvider initialUser>` — no client `<RequireAuth>`.
- [ ] A non-admin gets **403** from `/api/Admin/*`; the `/admin` route is gated by `(dashboard)/admin/layout.tsx` (Server Component via `auth()`) and shows **no** admin UI.
- [ ] An admin can list users and change a plan/role.
- [ ] `GET /api/Users/me` returns `{ id, email, phoneNumber, roles, isAdmin }` read from the **JWT claims**.
- [ ] `dotnet test` (auth tests **mock the OIDC JWT scheme**) and `npm run build` pass; frontend tests **mock the Auth.js session / `auth()`**.

## Phase 5 — Landing page
- [ ] `/` renders for anonymous users in **both** locales with the correct `dir`.
- [ ] CTAs route into `(auth)` (real login/register).
- [ ] Quick a11y/Lighthouse pass acceptable; `npm run build` passes.

## Phase 6 — Subscriptions + PDF / object storage
- [ ] An inactive account is blocked with a **`Subscription`-field 400** (not a 500); active users create unlimited projects (no cap — ADR-020); an admin re-activating the account unblocks it.
- [ ] A report PDF **generates from the stored result**, **uploads** to object storage, and **downloads** via a presigned URL.
- [ ] The RTL/script font renders correctly in the PDF.

## Phase 7 — Shared package
- [ ] `npm install` at the repo root links the workspace.
- [ ] Web imports the engine from `@<SCOPE>/<CORE_PACKAGE>` (no in-web copy left).
- [ ] `npm run build` (web) still passes; `transpilePackages` + `outputFileTracingRoot` set.
- [ ] Package **Vitest** parity tests pass; **scores unchanged** vs Phase 3 (no regression).

## Phase 8 — Mobile app
- [ ] `expo start` runs the app.
- [ ] `tsc --noEmit` (mobile) passes.
- [ ] Metro resolves `@<SCOPE>/<CORE_PACKAGE>` and a **single** react/react-native (no "Invalid hook call").
- [ ] Sign-in works on a device/emulator; tokens stored in `expo-secure-store`.
- [ ] The assessment computes **identically to web**.

## Phase 9 — Deploy behind existing Traefik
- [ ] `https://<WEB_DOMAIN>`, `https://<API_DOMAIN>`, `https://<S3_DOMAIN>` all serve over **valid TLS** (cert via `<CERT_RESOLVER>`).
- [ ] `curl -fsS https://<API_DOMAIN>/alive` returns OK.
- [ ] API log shows **EF migrations applied** and the admin user seeded (or intentionally skipped).
- [ ] `docker compose -f deploy/docker-compose.server.yml ps` shows `api`/`web` healthy.
- [ ] **Only `api`/`web` were recreated**; DB/MinIO and **all other stacks** untouched; shared Docker daemon **not** restarted.
- [ ] DB/MinIO base images pulled via `<REGISTRY_MIRROR>`; `api`/`web` arrived via `docker save|gzip` -> `pscp` -> `docker load` (not built on the server).
- [ ] Web image has the **prod** `NEXT_PUBLIC_API_BASE` baked in and `output: "standalone"`; secrets came from `deploy/.env`.
- [ ] **Prod smoke test passes end-to-end:** sign in -> create project -> run assessment -> download PDF (presigned `<S3_DOMAIN>` URL works in a browser; font renders).

## Phase 10 — DB migration (provider swap, if needed)
- [ ] Provider + `Aspire.Hosting.<DB>` packages swapped; `Use<Provider>(...)` + connection string updated.
- [ ] Migrations **deleted and regenerated** for the new provider (`dotnet ef migrations add Initial`); JSON columns stayed as portable text.
- [ ] Compose DB service + volume + mirror reference updated.
- [ ] `dotnet build`/`dotnet test` pass on the new provider.
- [ ] Migrate-on-startup creates the schema; the prod smoke test passes on the new DB.

## Phase 11 — Release Android APK
- [ ] EAS produces an APK (`mobile/<APP_NAME>.apk`).
- [ ] Build trio honored: New Arch ON, Metro project root pinned (`EXPO_NO_METRO_WORKSPACE_ROOT=1`), React dedup, local `index.js` entry; NDK/JDK 17 prerequisites met.
- [ ] Installed app signs in and runs the assessment against **production**.

---

## Cross-cutting (every phase)
- [ ] Strict build stays green (`TreatWarningsAsErrors=true`); no `gotchas.md` violation reintroduced.
- [ ] No secrets committed; runtime secrets only in `deploy/.env`.
- [ ] The `reviewer` agent returned a **merge** verdict (build/test run, diff checked) before advancing.
