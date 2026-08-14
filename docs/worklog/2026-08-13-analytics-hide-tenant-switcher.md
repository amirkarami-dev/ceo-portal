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

## What changed — in two goes, and the first was wrong

**First attempt: render it only when there is more than one tenant.** Data-driven rather than a
flag, so it would return on its own once a second organisation existed.

**It did not hide anything.** Amir checked production and the switcher was still there. The deploy
was fine — `index-MbwQF-KE.js` was live and served — the *condition* was wrong: production returns
**more than one tenant**, so the guard was satisfied.

The condition answered the wrong question. Not *"is there a choice to make"* but *"does choosing do
anything"* — and that answer is **no regardless of how many tenants exist**, because in real mode the
selection is never sent.

**So the control is gone, unconditionally**, along with the `tenant.switcher` / `tenant.current`
labels that nothing referenced any more.

**A control that looks like it switches organisation and does not is worse than no control.**

## What was NOT changed

The plumbing — the store, the cache keys, the mock filtering, the admin scoping — is untouched.
Making the switcher real later is a backend question, not a rebuild: send the selected tenant, and
decide who is entitled to read another organisation's data.

## Verified

430 front-end tests. The test asserts the switcher is absent for **zero, one and two** tenants, so
the first attempt's behaviour cannot creep back unnoticed. Lint and build clean.

Deployed over three builds — `CwukU9Sg` → `MbwQF-KE` (the conditional, which did not hide it) →
`DaMJYxDP` (control removed) → `6Twt7tN5` (labels removed). Container healthy, HTTPS 200,
16 `vng-*` untouched.

**The final check is worth copying.** Grepping the served bundle for «انتخاب سازمان» returned **1**
even after the control was gone — the string was still shipping inside the locale JSON. Only after
dropping the orphaned keys did it return **0**, fetched over the real domain rather than out of the
container. *A string in the bundle is not a rendered control, and a bundle grep only answers cleanly
once the dead translation goes too.*

## Worth knowing

- **antd labels a `Select` twice** — the inner input and the placeholder both carry the `aria-label`
  — so `getByLabelText` throws "found multiple elements". Use the plural query.
- **The plumbing is still there.** `useTenantStore` keys the react-query cache, filters the mock API
  and scopes the admin user list. Bringing the switcher back is re-adding the `Select` — after the
  API honours a chosen tenant, which is a backend change plus a decision about who may read another
  organisation's data.
