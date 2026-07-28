# Analytics report metadata and navigation UX

- **Date:** 2026-07-26
- **Area:** analytics
- **Branch / commits:** `main` — working tree
- **Status:** shipped to production

## Goal
Make `/ask` easy to find, redesign the analytics menu, stop showing an identity GUID in the report owner column, and make Add Widget show the saved reports correctly.

## What changed
- `src/Application/Analytics/Reports/Queries/GetReports/*` — return each saved report's deserialized definition instead of a summary that omitted all report metadata.
- `analytics-web/src/api/reportsHttpApi.ts` — consume the complete definition and retain the stored report name as a legacy fallback.
- `analytics-web/src/features/library/*` and `features/viewer/ReportViewer.tsx` — replace subject IDs with the current user's display name or a neutral organization-user label.
- `analytics-web/src/features/dashboards/AddWidgetDrawer.tsx` — render accessible report buttons with title, dataset, tags, loading, and retry states.
- `analytics-web/src/layout/Sidebar.tsx` and `sidebar.css` — replace open accordion groups with icon-led sections and feature `گزارش‌ساز هوشمند` as the primary `/ask` entry.
- `analytics-web/src/layout/AppLayout.tsx` — constrain the mobile flex child so wide tables scroll inside content without pushing the menu trigger off-screen.

## Root cause
`GET /api/Reports` deliberately omitted `DefinitionJson`, while the frontend adapter cast an empty object to `ReportDefinition`. The report library and widget picker therefore read blank names, datasets, and tags from the same fabricated object. `AnalyticsReport.OwnerName` also stores `IUser.Id`, so the UI exposed the OIDC subject GUID as if it were a display name.

## Decisions
- Returned complete definitions from the existing list endpoint because the viewer and widget picker already depend on that endpoint and no detail endpoint exists.
- Resolved only the signed-in user's subject locally; unknown subject IDs use a neutral label because analytics cannot query the separate auth database for arbitrary user profiles.
- Kept all existing route and permission filtering while changing only navigation hierarchy and presentation.

## Verification
- Analytics: 62 Vitest files / 324 tests passed; ESLint passed; production Vite build passed.
- Backend: `Application.csproj` Debug build passed; full solution Release build passed with existing NuGet advisory warnings.
- Browser at 1440x900: two named report rows, human owner names, visible full Ask AI entry, and no horizontal overflow.
- Browser at 390x844: body width equals viewport width, menu trigger opens the Drawer, Ask AI text fits, and Add Widget shows two named keyboard-accessible buttons with datasets.
- Production deployment rebuilt `api` then `analytics-web` sequentially and recreated only those
	two services with `--no-deps`. Both containers are healthy with zero restarts; public API and
	analytics endpoints return 200.
- Authenticated production smoke test: `GET /api/Reports` returned 200; two report rows rendered
	their names, `oz_info` model and `admin1` owner with no GUID or horizontal overflow. Dashboard 5
	returned 200, and Add Widget rendered both reports as nonblank keyboard-accessible buttons.
- Rollback images: `ceo-portal-api:rollback-20260726-121634` and
	`ceo-portal-analytics-web:rollback-20260726-121634`.

## Follow-ups
- None for this task.
