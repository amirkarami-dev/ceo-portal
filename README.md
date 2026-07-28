# Mabhas19 — مبحث ۱۹

Web application for the **comprehensive building-energy assessment** of Iran's National Building
Code **Section 19 (مبحث ۱۹), Appendix 5, 5th edition**. Users create building projects, run the
six-part energy assessment, store results, and export PDF reports.

## Architecture

- **Backend** — .NET 10, [Jason Taylor Clean Architecture](https://github.com/jasontaylordev/CleanArchitecture)
  (Domain / Application / Infrastructure / Web), CQRS via MediatR, EF Core + **SQL Server**.
- **Frontend** — Next.js 16 Mabhas19 assessment app, TypeScript, Tailwind, **i18n fa-IR (default, RTL) + en-US**. → `mabhas19-web/`
- **Portal** — public MyCEO service directory at `myceo.ir`. → `portal-web/`
- **Storage** — **MinIO** (S3-compatible) for generated PDF reports.
- **Reports** — QuestPDF, Persian/RTL.
- **Auth** — central OpenIddict SSO at `auth.myceo.ir`, with username/password, **mobile OTP** (SMS), and **Google** sign-in. The API validates JWT bearer tokens for `ceo.api` (and temporarily `mabhas19.api`).
- **Subscriptions** — every user gets a Free plan; the per-project cap is **not enforced** (active users create unlimited projects). User-facing subscription UI is hidden; admins still manage plans.
- **Import** — projects can be imported from external services (e.g. **نظام مهندسی ساختمان**).
- **Deploy** — Docker Compose + Traefik (TLS) on `mabhas19.myceo.ir`. → `deploy/`

## Solution layout

```
src/
  Domain/          Entities (Project, Assessment, Subscription, AssessmentReport),
                   enums, BuildingGroupCalculator, ClimateData (Section 19 formulas)
  Application/     CQRS use cases: Projects, Assessments (save/report), Subscriptions; interfaces
  Infrastructure/  EF Core + SQL Server, MinIO storage, QuestPDF reports,
                   external import providers and JWT validation configuration
  Web/             Minimal-API endpoints (/api/*), Scalar/OpenAPI
  Auth/            OpenIddict identity provider with its own CeoAuthDb database
  AppHost/         .NET Aspire orchestration (optional local dev)
mabhas19-web/      Next.js 16 Mabhas19 frontend (separate app)
mabhas19-mobile/   Expo / React Native Mabhas19 app
portal-web/         Public MyCEO service directory
deploy/            Dockerfiles, docker-compose, Traefik, env templates
tests/             Unit / Integration / Functional / Architecture tests
```

## The Section 19 assessment

Six checklists, scored climate- and building-group-aware (faithful port of the validated
calculator). Maximum totals: opaque envelope **105**, transparent envelope **93**, mechanical **240**,
electrical **196**, monitoring **120**, integrated management **77**. The interactive engine runs in the
frontend; the backend is the system of record (stores inputs/results as `nvarchar(max)`, generates PDFs).

- `BuildingGroupCalculator` — classifies A / ب / ب+ / ج / ج+ / ج++ / د from area, floors, units.
- `ClimateData` — 31 cities → 6 climate zones; required R-values, U-limits, SHGC limits.

## API surface (prefix `/api`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/Users/me` | Authenticated user claims and roles |
| GET/POST | `/Projects`, `/Projects/{id}` (GET/PUT/DELETE) | Project CRUD |
| POST | `/Projects/import` | Import from external service |
| GET/PUT | `/Projects/{id}/assessment` | Load / save assessment |
| POST | `/Projects/{id}/report` | Generate PDF, returns download URL |
| GET | `/Subscriptions/me` | Plan + usage |

Interactive API docs at `/scalar` when the API is running.

## Run locally

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # SQL Server + MinIO
dotnet run --project src/Web                            # API
cd mabhas19-web && npm install && npm run dev           # Web
```

See [`deploy/README.md`](deploy/README.md) for DNS, server setup, and production deployment.
