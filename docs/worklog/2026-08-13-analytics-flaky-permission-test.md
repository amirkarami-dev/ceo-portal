# The flaky permission test was paying for a module graph inside its own timer

**Date:** 2026-08-13
**Area:** `analytics-web/src/auth/AuthProvider.test.tsx`
**Status:** fixed — test-only, nothing deployed

## The symptom

`RequirePermission > renders children when user has the permission`:

| how it was run | time | result |
| --- | --- | --- |
| that file alone | ~3.2s for the test | passes |
| the full suite | ~19s for the same test | **fails** — `testTimeout` is 10s |

It did not fail on every full run, which is what let it sit there: rerunning the single file always
looked green.

## The cause

Not a race, and not a slow assertion — the body is four synchronous lines. The test did:

```ts
const { RequirePermission } = await import("./routes");
```

`routes.tsx` pulls in **antd** and **oidc-client-ts**. A dynamic import puts the transform of that
whole module graph **inside the test's timed window**. On an idle machine it fit inside 10s; with the
rest of the suite competing for CPU it did not.

Every other test file imports antd at the top, where the cost lands during collection — before any
timer is running. That is the whole difference.

**A dynamic import inside a test charges the test for work that a top-level import gets for free.**

## The fix

Both dynamic imports became one static import. Safe here, and checked rather than assumed:
`routes.tsx` has no load-time side effects, and `oidc.ts` builds its `UserManager` lazily inside
`getUserManager()` — so nothing reads `localStorage` at import time and `setMockUser()` does not have
to run first.

The file now runs in **88ms**, down from **3226ms**.

Raising `testTimeout` was the obvious non-fix: it would have hidden the flake and left every run
three seconds slower.

## Verified

Three consecutive **full** suite runs, **422/422** each. Running the single file proves nothing for
this class of bug — that is exactly what made it look healthy for so long.
