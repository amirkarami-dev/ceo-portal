# The organisation switcher offered a choice that changed nothing

**Date:** 2026-08-13
**Area:** `analytics-web/src/layout/Topbar.tsx`
**Status:** **live** on analytic.myceo.ir

## The question, and the answer

Amir asked what «انتخاب سازمان» in the top bar is. It is the **tenant switcher** — which
organisation's workspace you are in. The app is multi-tenant; in English the label reads
"Select tenant".

Tracing it was the useful part:

| where | what it does |
| --- | --- |
| `useTenantStore` | zustand, persisted to `localStorage` as `report.currentTenantId` |
| `api/queries.ts` | the id is part of the **react-query cache key** (`rk.reports(t)`, `rk.dashboards(t)`) |
| mock mode | genuinely filters — `mockApi.reports.list(t)` |
| admin user list | scopes which users are listed |
| **real mode** | **never sent to the server** |

In real mode the call is `reportsHttpApi.list()` with no tenant argument and there is no tenant
header; the API scopes by the tenant claim in the token. So on production the control re-keyed the
local cache and changed nothing a reader could see.

## What changed

It renders only when there is **more than one** tenant.

Data-driven rather than a flag, deliberately: the moment a second organisation exists the control
returns on its own and nobody has to remember to switch it back on. Mock mode seeds two tenants, so
it still appears locally — correctly, because there really are two there.

**A control that looks like it switches organisation and does not is worse than no control.**

## What was NOT changed

The plumbing — the store, the cache keys, the mock filtering, the admin scoping — is untouched.
Making the switcher real later is a backend question, not a rebuild: send the selected tenant, and
decide who is entitled to read another organisation's data.

## Verified

431 front-end tests, three of them this rule: hidden with one tenant, hidden while the list is still
loading, shown with two. Lint and build clean. Deployed `index-CwukU9Sg.js` → `index-MbwQF-KE.js`,
container healthy, HTTPS 200.

## Worth knowing

- **antd labels a `Select` twice** — the inner input and the placeholder both carry the `aria-label`
  — so `getByLabelText` throws "found multiple elements". Use the plural query.
