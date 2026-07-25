# analytics-web — AI-Powered Reporting & Analytics Platform (v1 prototype)

A standalone **React 19 + Vite + TypeScript** single-page app — the v1 **frontend prototype**
of an AI-native, multi-tenant BI/reporting product, hosted (later) at `report.myceo.ir`.
It lives in the `mabhas19` monorepo at `analytics-web/` and is **deliberately not Next.js**
(the existing `web/` app stays on Next.js).

> **What v1 is.** A high-fidelity, **fully offline-capable** prototype: a *real* in-browser
> query engine computes every table/KPI/chart over bundled sample datasets; only the **AI brain**
> and the **persistence layer** are mocked behind clean interfaces. There is **no backend in v1**.
> v1 proves the experience; v2 makes it real; v3 makes it a product (see [Roadmap](#roadmap--v2v3-swap-points)).

---

## Quick start

```bash
cd analytics-web
npm install
npm run dev        # http://localhost:5173  (Vite dev server)
```

By default the app runs **fully offline**: `VITE_AUTH_MODE=mock` (a dev mock-user with a
selectable role) and `VITE_USE_MOCK_API=true` (a `localStorage`-backed mock backend with seed data).
No network, no IdP, no API are required to click through the entire product.

### Build & preview the production bundle

```bash
npm run build      # typecheck → Vite → analytics-web/dist/  (hashed, immutable JS/CSS + index.html)
npm run preview    # serve the built bundle on http://localhost:4173 for a sanity check
```

### Lint & test

```bash
npm run lint       # ESLint over src/ (stack-rule gate: no AntD in charts/dashboard layout)
npm run test       # vitest: contracts, query engine, auto-viz, mock AI, export (207 tests, 36 files)
```

> **typecheck** is also available standalone: `npm run typecheck` (tsc --noEmit for both
> `tsconfig.json` and `tsconfig.node.json`). It runs automatically as part of `npm run build`.

---

## Environment variables

Vite bakes only `import.meta.env.VITE_*` variables **at build time** (there is no Node runtime —
the production image is static files behind nginx, so nothing is read at request time). Copy
`.env.example` to `.env.local` for dev overrides; the committed `.env` carries the offline defaults.

| Key | Dev default (offline) | Prod value | What it does |
|-----|-----------------------|------------|--------------|
| `VITE_AUTH_MODE` | `mock` | `oidc` | **Auth seam.** `mock` = offline dev user with a selectable role (no IdP). `oidc` = real Authorization Code + PKCE against the `report-web` client at `auth.myceo.ir`. Read in `src/auth/*`. |
| `VITE_USE_MOCK_API` | `true` | `false` | **Data seam.** `true` = `localStorage` mock backend + seed data behind the TanStack Query hooks. `false` = the same hooks hit the real HTTP API. |
| `VITE_AI_MODE` | `mock` | `gateway` | **AI seam.** `mock` = `MockReportAIService` (example prompts + rules). `gateway` = the future HTTP-backed AI Gateway. `createAIService()` picks the implementation from this flag. |
| `VITE_AUTH_AUTHORITY` | `https://auth.myceo.ir` | `https://auth.myceo.ir` | OIDC issuer/authority (used only when `VITE_AUTH_MODE=oidc`). |
| `VITE_AUTH_CLIENT_ID` | `report-web` | `report-web` | The public PKCE OIDC client id registered in the IdP. |
| `VITE_AUTH_SCOPE` | `openid profile email role mabhas19.api` | `openid profile email role mabhas19.api` | Scopes requested at sign-in; `mabhas19.api` is the API audience, `role` carries the role claim the UI reads. |
| `VITE_API_BASE` | `https://api.mabhas19.myceo.ir` | `https://api.mabhas19.myceo.ir` | Base URL the real fetcher targets when `VITE_USE_MOCK_API=false`. Ignored while the mock API is on. |

> **Mock-API caveat.** When `VITE_USE_MOCK_API=true`, the "backend" is `localStorage` **per browser**
> — data is per-device, not shared, and resets on cache clear. That is fine for a demo; real,
> multi-user persistence arrives with the v2 backend.

---

## The three swap seams (why v2 is a backend-only project)

v1's whole point is that the entire user-facing surface is built **now**, behind three clean
interfaces. v2 swaps *implementations* behind these seams without rewriting a single screen.

1. **AI seam — `IReportAIService`** (`src/ai/`, contract re-exported from `src/contracts/ai.ts`)
   ```ts
   interface IReportAIService {
     generate(req: GenerateReportRequest): Promise<AIReportResult>;
   }
   // GenerateReportRequest = { prompt: string; semanticModel: SemanticModel; locale: "fa" | "en" }
   // AIReportResult       = { definition: ReportDefinition; explanation?: string; usage?: AIUsage; matchedExample?: string }
   function createAIService(): IReportAIService; // v1 → MockReportAIService; v2 → HttpReportAIService
   ```
   The mock maps a Persian/English prompt to a `ReportDefinition` via curated example prompts +
   keyword/intent rules (`src/ai/examples.ts`, `src/ai/rules.ts`). v2 drops in an HTTP-backed
   implementation grounded in the semantic layer — **every caller (`Ask AI`, builder) is unchanged**
   because it only ever calls `generate(req)`.

2. **Data seam — the mockApi fetcher behind TanStack Query** (`src/api/mockApi.ts`, `src/api/queries.ts`, `src/api/seed.ts`)
   The TanStack Query **hook signatures are the contract** (`useReports()`, `useReport(id)`,
   `useSaveReport()`, `useDashboards()`, …). v1 backs them with `localStorage` + seed data; v2
   swaps the fetcher to the real HTTP API. Components consume hooks, never the transport, so the
   swap is invisible above the `src/api/` line.

3. **Auth seam — `useAuth()`** (`src/auth/`)
   ```ts
   useAuth(): {
     user: SessionUser | null; roles: AppRole[]; isAdmin: boolean;
     ready: boolean; permissions: Set<Permission>; can(p: Permission): boolean;
     login(): void; logout(): void; setMockRole(roles: AppRole[]): void;
   };
   ```
   `VITE_AUTH_MODE=mock` yields an offline dev user whose role is selectable from a dev-only
   **Role Switcher** in the top bar; `VITE_AUTH_MODE=oidc` yields the real `auth.myceo.ir` PKCE
   session. **One code path, swappable source** — `useAuth()` and the authorization helpers behave
   identically whether the identity came from the mock store or real OIDC claims.

> The single architectural bet: these three seams (`IReportAIService`, the mockApi fetcher,
> `useAuth()`) plus the **`ReportDefinition` JSON contract** make v2 a back-end-only effort with
> **no screen rewrites**.

---

## Architecture in one screen

```
prompt ──> IReportAIService.generate(req) ──> ReportDefinition (JSON, the single source of truth)
                                                   │
              runQuery(def, dataset, semantic) ────┤ pure + synchronous, in-browser
                                                   ▼
                                               QueryResult ──> chooseView(def, result, semantic)
                                                   │                         │
                                                   ▼                         ▼  ReportView[]
                                          ReportViewRenderer  (Table / KPI / Recharts / ECharts)
                                                   │
                        export: CSV + JSON (real, client-side from def + result)   [PDF/Excel = v2]
```

- **Semantic layer is mandatory** — every "AI" operation goes through typed entities/fields
  (`string` / `number` / `date` / `boolean`, with `dimension`/`measure` roles), never the raw shape.
- **Stack rules (enforced by lint/review):** Ant Design only for **admin/system UI, Tables, Cards,
  Forms, and the report library** — **never** for charts or dashboard layout. Charts = Recharts
  (basic) / Apache ECharts (advanced BI); dashboard = `react-grid-layout`.
- **i18n:** `fa-IR` (default, **RTL**) + `en-US` (LTR) via react-i18next; RTL applied through AntD
  `ConfigProvider direction`.

### Folder map (`src/`)

| Folder | Purpose |
|--------|---------|
| `contracts/` | Shared TypeScript contracts: `ReportDefinition`, `SemanticModel`, `Dataset`, `IReportAIService`, `rbac`, `presentation`, `tenant`, `common`. The v1 freeze point — v2/v3 must not break these types. |
| `semantic/` | Mock semantic models for the bundled sample datasets. |
| `query/` | `engine.ts` — the real, pure, synchronous in-browser query engine (`runQuery`). Vitest-tested with deterministic data. |
| `ai/` | `IReportAIService.ts` (re-export), `mock-ai-service.ts` (maps prompts to definitions via examples + rules), `examples.ts`, `rules.ts`, `index.ts` (factory). |
| `presentation/` | `auto-viz.ts` — `chooseView(def, result, semantic): ReportView[]`. Renderer components per view type. |
| `dashboard/` | Dashboard builder using `react-grid-layout`; persistence via the mockApi. |
| `features/` | Route-level screens: `ask-ai/`, `viewer/`, `library/`, `dashboards/`, `export/`. |
| `admin/` | All admin/system shells (AntD): Users, Roles/permissions, AI Providers, Data Sources, Semantic Models, Tenant settings, Audit log, AI routing/prompts/usage, System. |
| `auth/` | `useAuth.ts` (context hook), `AuthProvider.tsx`, `mock-user.ts`, `oidc.ts` (PKCE flow), `routes.tsx`. |
| `api/` | `mockApi.ts` (localStorage CRUD), `queries.ts` (TanStack Query hooks), `seed.ts` (bundled sample data). |
| `store/` | Zustand stores for ephemeral UI state. |
| `i18n/` | react-i18next setup; `fa-IR` and `en-US` translation files. |
| `theme/` | AntD theme tokens (emerald primary), CSS variable bridge. |
| `layout/` | App shell: top bar, side nav, Role Switcher (dev-only). |
| `app/` | Router (`react-router-dom v7`), `App.tsx`, providers tree. |

---

## v1 scope (what's built vs. deferred)

**Built in v1**
- Mocked AI brain (`IReportAIService` — example prompts + rules), swappable for a real provider.
- **Real** in-browser query engine: filter / group / aggregate (sum, avg, min, max, count,
  countDistinct) / sort / calculated fields / drill-down, over bundled sample datasets (vitest-tested, pure).
- Mandatory semantic layer (mock models for the sample datasets).
- All **user** screens: Ask-AI prompt + preview, report builder (columns/filters/sort/group/
  aggregations/calculated fields/drill-down), auto-visualization, Presentation `views[]` rendering,
  dashboard builder (`react-grid-layout`), report library.
- All **admin/system** screens (AntD shells over mock data): Users, Roles/permissions, AI Providers,
  Data Sources, Semantic Models, Tenant settings, Audit log, AI routing/prompts/usage, System.
- **Export: CSV + JSON are fully real** (client-side from `ReportDefinition` + result). **PDF/Excel
  show in the menu but are disabled with a "v2" tag.**
- Global OIDC `report-web` PKCE client **+ dev mock-user toggle** (fully offline); roles read from
  claims and **simulated** in the UI.
- Mock backend (`localStorage` + seed) behind TanStack Query hooks whose signatures match the future real API.

**Out of scope for v1 (designed for later)**
- Any new .NET service, real data-source connections, server-side RBAC enforcement, real tenant
  isolation, PDF/Excel export, multi-provider AI, real AI calls, caching/cost tracking.

---

## Roadmap — v2/v3 swap points

Each version is a standalone, demoable milestone, and the cross-version **contracts never break**:
the `ReportDefinition` JSON, the `IReportAIService` interface, and the TanStack Query hook
signatures are fixed in v1 so later versions swap *implementations* without rewriting screens.

| | v1 — Prototype (this build) | v2 — Real backend | v3 — Platform |
|---|---|---|---|
| **AI brain** | Mocked (`IReportAIService`) | Real AI Gateway, 1–2 providers (OpenAI + Ollama), semantic-grounded | Full multi-provider router: fallback, caching, cost/token dashboards, prompt versioning |
| **Query engine** | Real, in-browser, bundled samples | Real, server-side, real tenant data | Same, hardened + scaled (large datasets, cross-source drill-down) |
| **Persistence** | `localStorage` mockApi | SQL Server (or per-tenant store) | + audit/usage stores |
| **Auth** | OIDC `report-web` + mock toggle | Same OIDC; server validates JWT (`mabhas19.api`) | + full RBAC enforcement, SSO/SCIM-ready |
| **RBAC** | Simulated in the UI from claims | Enforced server-side (7 roles, permission matrix) | Tenant-scoped, delegated admin, audit-logged |
| **Multi-tenant** | Single mock tenant (UI only) | Real isolation + per-tenant config | Branding, quotas, tenant-specific AI config |
| **Export** | CSV + JSON (client-side) | + PDF + Excel (server-rendered from the same JSON) | Scheduled/emailed/large-export jobs |
| **Charts** | Recharts + basic ECharts | Same | Advanced ECharts BI (heatmaps, gauges, combos, maps) |
| **Net-new backend?** | **No** | **Yes** (the main v2 deliverable) | Yes (extends v2) |

**The v2 swap points (documented exit criterion of v1):**
- `IReportAIService` (`createAIService()`) — replace `MockReportAIService` with the HTTP gateway impl.
- The mockApi fetcher behind TanStack Query — point the hooks at the real `api.mabhas19.myceo.ir`.
- `VITE_USE_MOCK_API=false` / `VITE_AUTH_MODE=oidc` / `VITE_AI_MODE=gateway` flip the three seams from mock to real.

**Cross-version invariants** (set in v1, stable through v2/v3): `ReportDefinition` JSON;
`IReportAIService`; TanStack Query hook signatures; semantic-layer typing; OIDC against
`auth.myceo.ir`, scope `mabhas19.api`, role claim `role`; the AntD/charts/layout stack rules and
fa-IR RTL default.

---

## Deployment (designed now, applied at promotion to `report.myceo.ir`)

v1 is **local-only**; deployment is a *design* that bridges to production. None of it is required
to demo v1 on a laptop.

- **Build & serve:** Vite produces a static `dist/`; served by **nginx** (`analytics-web/deploy/nginx.conf`)
  with SPA history fallback (deep links → `index.html`), immutable caching for `/assets/`,
  `no-store` for `index.html`, and gzip. Image: multi-stage `node:24-alpine` build →
  `nginx:1.27-alpine` final, runs non-root on `:8080` (`analytics-web/deploy/Dockerfile.analytics-web`,
  build context = monorepo root). For production the image is built with `VITE_USE_MOCK_API=false`,
  `VITE_AUTH_MODE=oidc`.
- **Compose + Traefik:** a `report-web` service attaches to the **same external `traefik` network**
  and cert resolver `myresolver`, router/service prefixed `m19report`,
  `Host(\`${REPORT_DOMAIN}\`)`, `loadbalancer.server.port=8080`. No `depends_on`, no DB, no internal
  network — a static SPA talks to `api`/`auth` over the public Traefik path. New SOPS env key:
  `REPORT_DOMAIN=report.myceo.ir`.
- **OIDC client:** register the public PKCE client `report-web` in the IdP
  (`EnsureClientAsync`, idempotent), scope `mabhas19.api`, no client secret.
- **API CORS:** add `https://report.myceo.ir` to `Cors:AllowedOrigins` (baked into the API image →
  requires an API rebuild/redeploy).
- **Iran build/transfer constraint:** the server (`10.249.52.216`, Iran) cannot reach Docker Hub's
  blob CDN or `mcr.microsoft.com`, so `analytics-web` follows the same **build-locally →
  `docker save | gzip` → `pscp` transfer → `docker load`** path as `api`/`web`. Tag `:rollback`
  before load for instant revert; deploy **only** this service with
  `up -d --no-deps analytics-web` (the shared daemon also runs mailcow/supabase — never restart it).

See the monorepo `deploy/README.md` for the canonical build-locally / `docker save | gzip` / `pscp` /
`docker load` and SOPS + age secrets flow.

---

## Final verification results (v1 build gate)

Run from `analytics-web/`:

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npm run typecheck` | Clean (0 errors) |
| Build | `npm run build` | `✓ built in ~17s`; exit 0. Chunk-size advisory for the bundled ECharts/AntD (expected; not an error). |
| Lint | `npm run lint` | Exit 0, 0 warnings |
| Tests | `npm run test -- --run` | **36 test files, 207 tests — all passed** |

---

## Manual demo checklist (offline, ~2 minutes)

Run with the offline defaults (`VITE_AUTH_MODE=mock`, `VITE_USE_MOCK_API=true`, `VITE_AI_MODE=mock`).

1. **Mock login.** `npm run dev` → open `http://localhost:5173`. The dev mock-user toggle signs you
   in with no network. Use the top-bar **Role Switcher** to pick a role (e.g. Power User, then
   Tenant Admin) and confirm menus/buttons change live.
2. **Ask AI — the canonical example.** Open **Ask AI**, type (or click the seeded chip)
   **«درآمد ماهانه به تفکیک استان»** ("Show monthly revenue by province") and submit. After a short
   "thinking" state a **really computed** report renders (a line/heatmap + table over the sales
   sample dataset) — driven through `IReportAIService` → `ReportDefinition` → `runQuery` →
   `chooseView` → `ReportViewRenderer`. Confirm the result is real (drill into a province/month).
3. **Save.** Save the report; confirm it appears in the **Report Library** (persisted via the
   mockApi/`localStorage`).
4. **Add to a dashboard.** Open the **Dashboard builder**, add the saved report as a widget,
   drag/resize it on the `react-grid-layout` grid, then **reload the page** and confirm the layout
   and the widget persist.
5. **Open an admin screen.** Navigate to an **admin** area (e.g. Users or AI Providers) and confirm
   the AntD shell renders over mock data and is navigable.
6. **Switch locale & direction.** Toggle to `en-US` (LTR) and back to `fa-IR` (RTL); confirm layout
   direction flips and the same screens render in both.
7. **Export.** From the report's export menu, export **CSV** and **JSON** (both real); confirm the
   **PDF** and **Excel** items are visible but disabled with a "v2" tag.
