# PROJECT MAP — what exists and who owns what

One repo, one API, one identity provider, several front ends. Keep this file true:
if you add a service, a route group, or a page, update the tables here.

---

## Live systems

| What | Address | Served by |
|---|---|---|
| MyCEO service directory | `myceo.ir` | `portal-web/` (Vite + React) |
| Mabhas19 web (energy assessment) | `mabhas19.myceo.ir` | `mabhas19-web/` (Next.js) |
| API (all back-end features) | `api.myceo.ir` | `src/Web` |
| Identity provider (SSO) | `auth.myceo.ir` | `src/Auth` (OpenIddict) |
| Analytics / reporting | `analytic.myceo.ir` | `analytics-web/` |
| User administration | `admin.myceo.ir` | `admin-web/` |
| Landing panel (CMS) | `landing-panel.myceo.ir` | `landing-panel/` |
| Sanandaj municipality | `mun-sanandaj.myceo.ir` | `mun-sanandaj-web/` |
| Kurdnezam public site | `kurdnezam.ir` | `kurdnezam-web/` |
| **Engineers' welfare** | **`refahi.kurdnezam.ir`** | `walfare-web/` |
| Object storage (S3) | `s3.myceo.ir` | MinIO |

Server: `/data/apps/ceo-portal` on the production host, behind a **shared** Traefik. The Compose
project and platform containers use `ceo-portal`; the Mabhas19 product web remains `mabhas19-web`.
Details and commands: [`OPERATIONS.md`](OPERATIONS.md).

## Back end (`src/`)

Clean Architecture. A feature normally touches all four layers.

| Layer | Holds | Notes |
|---|---|---|
| `src/Domain` | entities, enums, domain services | Section-19 calculators must stay numerically identical to the legacy JS |
| `src/Application` | CQRS use cases (MediatR), DTOs, validators | `[Authorize]` on the request record controls access |
| `src/Infrastructure` | EF Core, storage, PDF, payments, external directories | one file per external system |
| `src/Web` | Minimal-API endpoint groups | each `IEndpointGroup` auto-maps; handler names are globally unique |
| `src/Auth` | the OIDC identity provider | its own database; the only token issuer |

### Feature areas in the API

| Area | Application folder | Endpoints | Front end |
|---|---|---|---|
| Assessments / projects | `Application/Projects`, `Assessments` | `/api/Projects`, `/api/Assessments` | `mabhas19-web/` |
| Analytics | `Application/Analytics` | `/api/Reports`, `/api/Dashboards`, `/api/SemanticModels` | `analytics-web/` |
| Kurdnezam CMS | `Application/Kurdnezam` | `/api/Kurdnezam*` | `landing-panel/`, `kurdnezam-web/` |
| Municipality | `Application/MunSanandaj` | `/api/MunSanandaj*` | `mun-sanandaj-web/` |
| **Welfare** | `Application/Walfare` | `/api/walfare/*` | `walfare-web/` |

## Welfare service (newest, most recently changed)

Engineers buy pool tickets; admins define what is on sale.

- **Login**: کد ملی + SMS code, handled by the IdP (`src/Auth/Pages/Account/EngineerLogin`).
  The account's **username is the national code**; the person is looked up in the
  organisation database through `WebS_GetEngineerInfo`.
- **Domain**: `WelfareService` (offer + date window) → `WelfarePool` (active weekdays, price,
  capacity, hours) → `WelfarePoolReservation` (a ticket, with a snapshot of the buyer) →
  `PaymentTransaction` (the shared payment ledger, reusable by future paid features).
- **Payment**: Iran Kish, in `src/Infrastructure/Payments/IranKishGateway.cs`.
  Flow: token request → payer redirected to the bank → bank posts back to
  `/api/walfare/payments/irk-return` → **verify** → ticket marked paid, tracking code stored.
  An admin can re-run verify from `/admin/payments` («تأیید»).
- **Pages**: services, booking calendar (badges the days a pool actually runs), my reservations,
  payment result; admin: services, pools, reservations, payments.

## Front ends — shared conventions

All SPAs (`analytics-web`, `admin-web`, `landing-panel`, `mun-sanandaj-web`, `walfare-web`)
follow the same shape:

```
src/api/        HTTP client + typed endpoints        src/layout/    shell, nav, app switcher
src/auth/       OIDC (PKCE) + route guards           src/pages/     screens
src/query/      TanStack Query keys + hooks          src/components/ui/  shared primitives
src/theme/      design tokens, light/dark
```

- **The app launcher (`src/layout/AppSwitcher.tsx`) is byte-identical across all five SPAs.**
  Add a service to one → copy to all five, then rebuild **all five** or the old ones keep
  serving a stale list.
- Persian / RTL everywhere; dates shown in the Jalali calendar.
- `mabhas19-web/` and `kurdnezam-web/` are Next.js and follow their own (documented) structure. `portal-web/` is a public Vite service directory with no API or OIDC calls.
- Analytics opens on `/dashboards`: All/Mine/Recent dashboard library, read-only detail at
  `/dashboards/:id`, role-gated editing at `/dashboards/:id/edit`, and Ask AI at `/ask`.

## Documentation layout

| Path | Purpose |
|---|---|
| `docs/ai/` | **context for assistants** — start here |
| `docs/worklog/` | one record per finished task (required) |
| `CLAUDE.md` / `AGENTS.md` | auto-loaded project instructions (commands, architecture, gotchas) |
| `deploy/README.md`, `deploy/sso-cutover-runbook.md` | deployment and the SSO migration |
| `plan_development/` | reusable blueprint for building a *different* new app |
