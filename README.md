# Mabhas19 — مبحث ۱۹

Web application for the **comprehensive building-energy assessment** of Iran's National Building
Code **Section 19 (مبحث ۱۹), Appendix 5, 5th edition**. Users create building projects, run the
six-part energy assessment, store results, and export PDF reports.

## Architecture

- **Backend** — .NET 10, [Jason Taylor Clean Architecture](https://github.com/jasontaylordev/CleanArchitecture)
  (Domain / Application / Infrastructure / Web), CQRS via MediatR, EF Core + **PostgreSQL**.
- **Frontend** — Next.js 16 admin dashboard (Apex-style), TypeScript, Tailwind, **i18n fa-IR (default, RTL) + en-US**. → `web/`
- **Storage** — **MinIO** (S3-compatible) for generated PDF reports.
- **Reports** — QuestPDF, Persian/RTL.
- **Auth** — ASP.NET Identity (username/password) + **mobile OTP** (SMS) + **Google** sign-in. Bearer tokens.
- **Subscriptions** — every user gets a Free plan; the per-project cap is **not enforced** (active users create unlimited projects). User-facing subscription UI is hidden; admins still manage plans.
- **Import** — projects can be imported from external services (e.g. **نظام مهندسی ساختمان**).
- **Deploy** — Docker Compose + Traefik (TLS) on `mabhas19.myceo.ir`. → `deploy/`

## Solution layout

```
src/
  Domain/          Entities (Project, Assessment, Subscription, AssessmentReport),
                   enums, BuildingGroupCalculator, ClimateData (Section 19 formulas)
  Application/     CQRS use cases: Projects, Assessments (save/report), Subscriptions; interfaces
  Infrastructure/  EF Core + PostgreSQL, Identity, MinIO storage, QuestPDF reports,
                   OTP/SMS, Google token validation, external import providers
  Web/             Minimal-API endpoints (/api/*), Identity API, Scalar/OpenAPI
  AppHost/         .NET Aspire orchestration (optional local dev)
web/               Next.js 16 frontend (separate app)
deploy/            Dockerfiles, docker-compose, Traefik, env templates
tests/             Unit / Integration / Functional / Architecture tests
```

## The Section 19 assessment

Six checklists, scored climate- and building-group-aware (faithful port of the validated
calculator). Maximum totals: opaque envelope **105**, transparent envelope **93**, mechanical **240**,
electrical **196**, monitoring **120**, integrated management **77**. The interactive engine runs in the
frontend; the backend is the system of record (stores inputs/results as JSONB, generates PDFs).

- `BuildingGroupCalculator` — classifies A / ب / ب+ / ج / ج+ / ج++ / د from area, floors, units.
- `ClimateData` — 31 cities → 6 climate zones; required R-values, U-limits, SHGC limits.

## API surface (prefix `/api`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/Users/register`, `/Users/login`, `/Users/refresh`, `/Users/logout` | Identity (username/password) |
| POST | `/Auth/otp/request`, `/Auth/otp/verify` | Mobile OTP login |
| POST | `/Auth/google` | Google ID-token login |
| GET/POST | `/Projects`, `/Projects/{id}` (GET/PUT/DELETE) | Project CRUD |
| POST | `/Projects/import` | Import from external service |
| GET/PUT | `/Projects/{id}/assessment` | Load / save assessment |
| POST | `/Projects/{id}/report` | Generate PDF, returns download URL |
| GET | `/Subscriptions/me` | Plan + usage |

Interactive API docs at `/scalar` when the API is running.

## Run locally

```bash
docker compose -f deploy/docker-compose.dev.yml up -d   # Postgres + MinIO
dotnet run --project src/Web                            # API
cd web && npm install && npm run dev                    # Web
```

See [`deploy/README.md`](deploy/README.md) for DNS, server setup, and production deployment.
