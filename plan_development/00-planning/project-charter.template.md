# Project Charter — `<PROJECT_NAME>`

> A one-page agreement on *what* we are building and *why*, before any code.
> Fill every `<PLACEHOLDER>`. Keep it to one page. Delete the guidance in *italics*.

## 1. Project name
`<PROJECT_NAME>` (`<PROJECT_NAME_LOCALIZED>` — *the display name in the primary language, if different*)

## 2. One-line goal
*One sentence a non-technical stakeholder understands.*
`<e.g. Let professionals run the X standard's assessment online, store the results, and download an official PDF report.>`

## 3. Problem statement
*2–4 sentences: who has the pain, what the pain is, and why now.*
- **Who:** `<target user / role>`
- **Pain today:** `<what they do now — spreadsheets, a legacy desktop tool, paper, nothing>`
- **Cost of the pain:** `<slow, error-prone, no audit trail, not shareable, ...>`
- **Why now:** `<new regulation, the old tool is unmaintained, a contract, ...>`

## 4. Scope

### In scope (this release)
- `<core domain workflow #1 — e.g. the interactive multi-checklist assessment>`
- `<persistence: projects + saved assessments per user>`
- `<auth: sign-in methods you commit to — e.g. password + OTP + Google>`
- `<roles: Administrator + User; admin can manage users/plans>`
- `<reports: server-rendered PDF of a stored result>`
- `<file storage for generated artifacts>`
- `<i18n / RTL if applicable>`
- `<clients you ship — e.g. web app; mobile app>`
- `<deployment target — e.g. single Docker host behind existing Traefik>`

### Out of scope (explicitly NOT this release)
- `<payments / real billing — plans are recorded but not enforced/charged>`
- `<multi-tenant orgs / team sharing>`
- `<offline mode / sync>`
- `<native push notifications>`
- `<the legacy data migration, if deferred>`
- `<anything a stakeholder might assume is included but isn't>`

## 5. Success criteria
*Measurable. "Done" must be checkable, not a feeling.*
- [ ] `<The domain calculation matches the reference source exactly (covered by unit tests).>`
- [ ] `<A user can sign in with all committed methods and stay signed in across refresh.>`
- [ ] `<A user can create a project, complete an assessment, save it, and download its PDF.>`
- [ ] `<Project creation is unlimited for active users; an inactive account is blocked with a clear message.>`
- [ ] `<An admin can list users and change a user's plan / active status.>`
- [ ] `<Backend build passes with warnings-as-errors; web production build passes; all tests green.>`
- [ ] `<The full stack runs from a clean checkout with the documented commands.>`
- [ ] `<Production is reachable at the agreed domains over HTTPS.>`

## 6. Constraints
*The hard boundaries the design must respect.*
- **Tech stack is fixed** to the reference blueprint (see `tech-stack.md`) unless this charter says otherwise.
- **Domain logic is a faithful port** of `<reference source>` and must stay numerically identical (locked by tests).
- **Deployment environment:** `<single host / cloud / on-prem>`; `<network restrictions, e.g. registry/CDN blocked → image-transfer pipeline>`.
- **Data residency / language:** `<e.g. primary language is RTL; data stays in-region>`.
- **Licensing:** `<track any component whose license is a decision — e.g. MediatR is pinned to the free 12.5.0 (Apache-2.0; 13.0+ is commercial) per ADR-002, and AutoMapper's license is a tracked, accepted decision (ADR-018)>`.
- **Timeline / budget:** `<dates or "best effort">`.

## 7. Stakeholders
| Role | Name | Responsibility |
|------|------|----------------|
| Product owner | `<name>` | Scope, priorities, sign-off |
| Tech lead / builder | `<name>` | Architecture, delivery |
| Domain expert | `<name>` | Correctness of the calculation |
| Ops / server owner | `<name>` | Deployment host, DNS, certs |
| End users | `<segment>` | Acceptance |

## 8. Sign-off
- [ ] Product owner agrees scope & success criteria — `<name / date>`
- [ ] Tech lead confirms the stack & constraints are feasible — `<name / date>`

---

# Worked example — Mabhas19 (filled)

## 1. Project name
Mabhas19 (مبحث ۱۹ — "Section 19")

## 2. One-line goal
A web app that lets building professionals run Iran's National Building Code **Section 19, Appendix 5 (5th ed.)** energy assessment, store each project's results, and download an official Persian PDF report.

## 3. Problem statement
- **Who:** civil/energy engineers and inspectors preparing Section 19 compliance.
- **Pain today:** the calculation lived in a brittle legacy JS/React tool with no accounts, no storage, and no shareable output; results were re-entered by hand.
- **Cost of the pain:** slow, error-prone, no audit trail, nothing to hand to a client.
- **Why now:** the 5th edition is the active standard and the old tool is unmaintained.

## 4. Scope

### In scope
- The interactive **6-checklist** Section 19 scoring engine (envelope-opaque, envelope-transparent, mechanical, electrical, monitoring, integrated).
- Projects + saved assessments per user (backend is the system of record; stores input/result JSON + total/max score).
- Auth: username/password, **mobile OTP**, **Google ID-token**; roles **Administrator** / **User**.
- Subscriptions: recorded per user (Free plan by default); the project cap is **not enforced** (active users create unlimited projects). User-facing subscription UI is hidden.
- Server-rendered **Persian PDF** report (QuestPDF) of a stored result.
- Object storage (**MinIO/S3**) for generated PDFs, served via presigned URLs.
- **Persian/RTL** default UI with an English (LTR) locale.
- Clients: **Next.js web app** and **Expo React Native mobile app**, both consuming a **shared TypeScript scoring package**.
- Deployment: Docker Compose on a single Iran host **behind the existing Traefik**.

### Out of scope
- Real billing/payments (plans are recorded but not enforced/charged).
- Multi-tenant organizations / team sharing of projects.
- Offline assessment on mobile.
- The interactive scoring engine running on the backend (it runs in the frontend by design).

## 5. Success criteria
- [x] Scoring output is numerically identical to the legacy calculator (locked by unit tests on the shared package + Domain).
- [x] Sign-in via the central OIDC IdP works (Authorization Code + PKCE); the session survives a refresh.
- [x] A user can create a project → complete an assessment → save → download its PDF.
- [x] Project creation is unlimited for active users; only an inactive account is blocked (with a `Subscription`-field validation message).
- [x] Admin can list users and change a user's plan / active status under `/api/Admin/*`.
- [x] `dotnet build` passes with `TreatWarningsAsErrors=true`; `npm run build` (web) passes; `dotnet test` green.
- [x] Web + mobile both build against `@mabhas19/assessment-core`.
- [x] Live at `mabhas19.myceo.ir`, `api.mabhas19.myceo.ir`, `s3.mabhas19.myceo.ir` over HTTPS.

## 6. Constraints
- Stack fixed to the blueprint (.NET 10 Clean Architecture + SQL Server + Next.js 16 + Expo SDK 54).
- `Domain/Services` calculators and `@mabhas19/assessment-core` are faithful ports — numerically locked by tests.
- Server is in Iran: **`mcr.microsoft.com` and Docker Hub's blob CDN are blocked** → app images are built locally and transferred via `docker save`/`load` + `pscp`; `postgres`/`minio` pulled from the `docker.arvancloud.ir` mirror. Do not restart the shared Docker daemon.
- **MediatR** is pinned to the free **12.5.0** (Apache-2.0; 13.0+ is commercial) per ADR-002; **AutoMapper**'s license is a tracked, accepted decision (ADR-018).
- Primary language is Persian (RTL); data stays on the in-region server.

## 7. Stakeholders
| Role | Name | Responsibility |
|------|------|----------------|
| Product owner / domain expert | Amir | Scope, correctness of Section 19 |
| Tech lead / builder | Amir | Architecture, delivery |
| Ops / server owner | Amir | `10.249.52.216` host, DNS (`*.myceo.ir`), Traefik certs |
| End users | Engineers/inspectors | Acceptance |
