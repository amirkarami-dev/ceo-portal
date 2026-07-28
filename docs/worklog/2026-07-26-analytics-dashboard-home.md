# Analytics dashboard home and read-only viewer

- **Date:** 2026-07-26
- **Area:** analytics
- **Branch / commits:** `main` working tree, not committed
- **Status:** shipped to production

## Goal
Fix dashboard creation navigating to `/dashboards/undefined/edit`, make dashboards the
authenticated home with All/Mine/Recent tabs, keep Ask visible, and open cards read-only.

## What changed
- `src/Web/Endpoints/Analytics/Dashboards.cs` — POST now returns `{ id: number }` instead of a primitive.
- `analytics-web/src/api/dashboardsHttpApi.ts` — normalizes backend numeric IDs into frontend strings.
- `analytics-web/src/features/dashboards/` — adds tabs, role-aware actions, one creation path,
  retry handling, and a read-only viewer reusing the existing canvas/widget renderers. Dashboard
  cards now select an inline landing-page preview instead of navigating away; the preview renders
  the saved report widgets, chart/table output, and export actions in place.
- `analytics-web/src/app/router.tsx`, `auth/routes.tsx`, `layout/Sidebar.tsx` — dashboards are the
  canonical post-login home; Ask remains a top-level destination; nested dashboard routes stay selected.
- `analytics-web/src/layout/AppLayout.tsx`, `Topbar.tsx` — phone navigation is a Drawer instead
  of a 240px desktop sider, with compact header/content spacing.
- Dashboard adapter/component/endpoint tests cover the response shape, tabs, roles, single creation,
  read-only controls, and numeric IDs.

## Root cause
The API returned a JSON primitive such as `42`, but the HTTP adapter expected `{ id: 42 }` and
read `response.id`. That produced `undefined` only after a successful insert. Mock tests concealed
the mismatch by returning the object shape the client expected.

The mobile card collapse was separate: the desktop Sider never left the flex row, consuming 240px
of a 390px viewport before dashboard content was laid out.

## Decisions
- `/dashboards` is canonical and `/` redirects to it; no duplicate home mount.
- Recent means the latest eight by `updatedAt`; Mine compares persisted owner subject to `user.id`.
- Cards select an in-page read-only widget preview; Edit/Delete remain explicit and role-gated.
- The standalone `/dashboards/:id` read-only route remains available for deep links, but normal
  landing-page selection does not change the URL.
- `/dashboards/new` is the only initial creation path.

## Verification
- Analytics Vitest: 60 files, 320 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed; existing large-chunk warning remains.
- Browser at 1280x720: `/` resolved to `/dashboards`, tabs/cards rendered, no horizontal overflow.
- Browser at 390x844: no horizontal overflow, dashboard card width 302px, Sider absent, Drawer
  exposed Dashboard and Ask, and navigation closed the Drawer.
- Read-only route rendered widgets with no Edit, Save, or widget-remove controls for PowerUser.
- Backend functional project compiled in an isolated artifacts directory. The focused NUnit test
  did not emit a test-run section under the local preview SDK, so execution is not claimed.
- Production API and analytics images were deployed together. `api.myceo.ir/alive` returned 200,
  analytics served `assets/index-BQgNMPj-.js`, and the bundle contained the
  `dashboard-canvas--readonly` marker.
- Inline-preview change: 60 Vitest files / 320 tests passed; lint and production build passed.
  Browser checks at 1440x900 and 390x844 confirmed the selected card and report widget remain on
  `/dashboards`, export controls render, card/menu controls are not nested, and no horizontal
  overflow occurs. The final local asset is `assets/index-BuiFUdXN.js`.
- Deployed only `ceo-portal-analytics-web`, after tagging the previous image as
  `rollback-20260726-inline-preview`. The production container is healthy and serves
  `assets/index-BIw_Dw9E.js`; CDN and origin copies are byte-identical and contain the
  `dash-preview__eyebrow` feature marker.

## Follow-ups
- Run `ValidToken_SaveDashboard_ReturnsObjectWithNumericId` in the normal server test environment.
- Repeat the authenticated create/save/view/edit smoke test against the production API; this was
  not performed during the infrastructure migration.