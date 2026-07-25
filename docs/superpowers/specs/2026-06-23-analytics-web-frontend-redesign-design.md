# analytics-web Frontend Redesign — Design

**Goal:** Redesign the entire `analytics-web` SPA (all ~20 screens) with a modern, cohesive Ant Design–based UI and a cleaner structure, **without** changing chart rendering (ECharts/Recharts), animations (framer-motion), backend, data, routes, auth, or i18n.

**Architecture:** Introduce a single theme-token source + a shared UI primitive layer, then migrate every screen onto those primitives. Visual direction is a **hybrid**: Calm Enterprise base + dark-mode toggle (Command-Center palette) + bento KPI treatment on the Dashboards and Ask-AI landing.

**Tech Stack (unchanged):** React 19, Vite 6, TypeScript, Ant Design 5 (`ConfigProvider` theming), ECharts + Recharts (rendering untouched), react-grid-layout, framer-motion, Zustand, TanStack Query, react-i18next (fa-IR default / RTL + en-US), oidc-client-ts.

## Global Constraints

- **Ant Design is the component library** for all non-chart UI. Charts stay in ECharts/Recharts; dashboard layout stays in react-grid-layout.
- **Do NOT change** chart rendering logic, framer-motion animations, backend/API, data shapes, routes, auth/OIDC, i18n keys/behavior, or the three swap seams (`@/ai`, data transport `VITE_USE_MOCK_API`, auth `VITE_AUTH_MODE`).
- **RTL-first**: fa-IR is default and RTL; en-US is LTR. Every component must work in both directions and in **both light and dark** mode.
- **Persian/Vazirmatn** typography preserved.
- All existing functionality and user flows must be preserved (restyle/restructure, not rewrite behavior).
- Keep the public export surface of any shared module stable where other code imports it; restyle, don't rename routes.
- Tests stay green; update selectors/snapshots only as needed for new markup, never weaken assertions.

## Decisions (confirmed with user)

- **Scope:** whole app, all ~20 screens, in one redesign effort.
- **Depth:** both visual and structural.
- **Direction:** Hybrid — `A` Calm Enterprise as the foundation everywhere; `C` dark palette shipped as a dark-mode toggle; `B` bento/KPI treatment applied specifically to Dashboards + the Ask-AI landing.

---

## 1. Theme tokens & theming mechanics

Single source of truth in `analytics-web/src/theme/theme.ts`, consumed by `ThemeProvider.tsx` via antd `ConfigProvider`.

- **Primary:** emerald (`#0f6e56` light / `#1d9e75` dark accents).
- **Neutrals:** calm gray surfaces; page bg vs card bg distinct; borders subtle (≈1px, low alpha).
- **Radius:** `borderRadius` 8, cards `12`.
- **Type:** Vazirmatn family, modest scale (h1 22 / h2 18 / h3 16 / body 14–15), weights 400/500 only.
- **Light vs dark:** `ThemeProvider` selects `theme.defaultAlgorithm` or `theme.darkAlgorithm`, merged with the shared token object + a small dark-overrides map (Command-Center surfaces/accents). Dark mode toggle in the topbar, persisted (localStorage; reuse existing ui-store if present).
- **Direction:** `ConfigProvider direction` = `rtl` for fa, `ltr` for en (already locale-driven; keep).
- Chart renderers receive theme colors (text/grid/series) from the token source so dark mode renders correctly — **chart construction logic itself is unchanged**.

## 2. Shell (structural)

`layout/AppLayout.tsx`, `layout/Sidebar.tsx`, `layout/Topbar.tsx`:

- **Sidebar:** grouped nav with icons, collapsible to an icon rail; sections: «پرسش هوشمند / گزارش‌ها / داشبوردها / داده‌ها / خروجی‌ها / مدیریت» (admin section role-gated as today). Active-item styling from theme accent.
- **Topbar:** tenant/workspace switcher (existing), global search affordance, **theme toggle**, locale switch, notifications, user menu.
- **Page frame:** breadcrumbs + a consistent header region (see `PageHeader`).
- RTL: sidebar on the right for fa, left for en.

## 3. Shared UI primitive layer (new)

New folder `analytics-web/src/components/` (or `components/ui/`) — small, focused, documented primitives that every screen composes:

- `PageHeader` — `{ title, subtitle?, breadcrumbs?, actions? }`.
- `PageContainer` — consistent max-width, padding, vertical rhythm.
- `SectionCard` — antd Card preset (radius-lg, subtle border, header/extra slots).
- `KpiTile` — bento metric tile `{ label, value, delta?, icon?, tone? }` (tinted variants for bento areas).
- `Toolbar` / `FilterBar` wrapper — consistent filter/search/action row.
- `DataTable` — antd `Table` wrapper with standardized pagination, sorting, density, and built-in empty/loading/error.
- `EmptyState`, `ErrorState`, `Loading` (skeletons) — consistent across screens.
- `FormDrawer` / `ConfirmModal` — standard create/edit and confirm patterns.

Each primitive: one clear purpose, typed props, theme-driven styling, RTL+dark safe. Screens stop hand-rolling layout/markup.

## 4. Per-area redesign (all screens)

- **Ask-AI** (`features/ask-ai/*`: `AskAiBuilder`, `PromptHero`, `DefinitionPanel`, `ViewSwitcher`, `SaveReportModal`): modern prompt composer (hero), bento-flavored result canvas, clearer definition/view controls. Behavior (generate→execute→render) unchanged.
- **Library** (`features/library/ReportLibrary`): card-grid + `DataTable` hybrid, `FilterBar`, `EmptyState`.
- **Viewer** (`features/viewer/ReportViewer`, `FilterBar`): `PageHeader` + filters + `ReportView` (charts unchanged) + export/save actions.
- **Dashboards** (`features/dashboards/*`, `dashboard/DashboardCanvas`): bento grid, polished `WidgetFrame`, `AddWidgetDrawer`; react-grid-layout retained.
- **Admin** (`admin/*`: users, roles, data-sources, semantic-models, audit, tenant, tenants, system, AI shell with providers/routing/prompts/usage): uniform `PageHeader` + `DataTable` + `FormDrawer`/modal pattern across all.
- **Renderers** (`presentation/renderers/*`): `KpiRenderer` + `TableRenderer` restyled to the system; `EChartsRenderer`/`RechartsRenderer` logic unchanged, only fed theme colors.
- **Auth screens** (`auth/routes.tsx`: login, callback, logout, forbidden): restyled to the system (branded login, clean states).

## 5. Charts & animations (unchanged)

ECharts/Recharts chart-building code and framer-motion transitions are **not** rewritten. The only touch: pass theme-derived colors into the chart options so charts are legible in dark mode. KPI/Table renderers (which are antd, not chart libs) are restyled.

## 6. i18n / RTL / seams (preserved)

- All `react-i18next` keys preserved; add keys only for genuinely new UI strings (e.g., theme toggle label) in both `fa.json` and `en.json`.
- RTL/LTR driven by locale as today.
- The AI (`@/ai`), data-transport (`VITE_USE_MOCK_API`), and auth (`VITE_AUTH_MODE`) seams are untouched — redesign is presentation-only.

## 7. Testing

- Existing `*.test.tsx` (Vitest + Testing-Library) must pass. Update queries/snapshots where new markup changes the DOM; never weaken assertions to pass.
- Add light render/smoke tests for new primitives (`PageHeader`, `DataTable`, `KpiTile`, `EmptyState`).
- `npm run build` (tsc + vite) and `npm run lint` must pass.

## 8. Execution sequence (phases)

1. **Theme + dark mode**: extend `theme.ts` tokens (light+dark), wire toggle in `ThemeProvider`/topbar, feed chart colors.
2. **Shared primitives**: build `components/*` with tests.
3. **Shell**: `AppLayout`/`Sidebar`/`Topbar` onto the new system.
4. **Ask-AI** area.
5. **Library + Viewer** area.
6. **Dashboards** area (incl. bento KPIs).
7. **Admin** area (all screens) onto `PageHeader`+`DataTable`+`FormDrawer`.
8. **Auth screens** + final polish, full build/lint/test pass.

Each phase is independently testable; primitives land before the screens that consume them.

## 9. Non-goals

No backend/data/logic changes; no chart-library swaps; no new product features; no route/auth/i18n behavior changes; no removal of the swap seams.

## 10. Success criteria

- All ~20 screens use the shared primitives + the hybrid visual system, consistent in light and dark, fa (RTL) and en (LTR).
- Dashboards + Ask landing show the bento/KPI treatment.
- Charts and animations behave exactly as before (now dark-mode-correct).
- `npm run build`, `npm run lint`, and the test suite pass; no behavior regressions in generate→execute→render, auth, or admin CRUD.

## 11. Risks & mitigations

- **Test churn** from new markup → update selectors/snapshots per screen as part of each phase.
- **RTL + dark correctness** → primitives are the single place to get this right; verify both modes per area.
- **Large surface area** → shared-primitives-first + strict area-by-area migration keeps each change reviewable and independently shippable.
