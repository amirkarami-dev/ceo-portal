# The access-denied login loop, and the reason nobody could see

- **Date:** 2026-08-04
- **Area:** all 8 SPAs (`src/auth/`), `src/Auth/Auth/AuthorizationController.cs`
- **Status:** **fixed and deployed.** This is half of a two-part request — the service-grant half is designed but deliberately not shipped yet, see "Next".

## What Amir hit

Revoke a user's access to a service, then let them open it (or leave them signed in):

```
/auth/callback?error=access_denied
  &error_description=شما به این سرویس دسترسی ندارید.
```

The screen said «ورود ناموفق بود» — a generic "login failed" — and «تلاش دوباره» navigated to
`/login`, which called `signinRedirect()`, which hit an IdP that still held a valid SSO cookie,
which answered `access_denied` again. **A closed loop, with the one useful sentence sitting unread
in the URL the whole time.**

## Two bugs, not one

1. **The reason was thrown away.** Every SPA had `.catch(() => setError("ورود ناموفق بود"))` — the
   callback discarded its argument *and* the query string. The IdP had already said exactly what was
   wrong, in Persian.
2. **The retry could not work.** Nothing cleared the session, so retrying re-used the same SSO
   cookie and got the same refusal.

## The fix

`readCallbackError()` and `signOutAndRestart()` in each SPA's `oidc.ts`, used by all 8 callbacks:

- The query is captured **before** `signinRedirectCallback()` runs, because that call consumes the
  URL.
- `access_denied` gets its own screen: status `403`, title «به این سرویس دسترسی ندارید», and the
  IdP's own sentence as the subtitle. Any other failure keeps the old wording.
- The button becomes «ورود با حساب دیگر» and calls `removeUser()` then `signoutRedirect()` — the
  local tokens *and* the IdP session, which is what makes the next attempt ask for a username and
  password instead of replaying the refusal. Retrying as the same account was never going to work,
  so the button no longer pretends otherwise.

**The IdP now honours `prompt=login`.** It previously ignored the parameter entirely (verified: zero
references to `HasPromptValue`/`Prompts` in `AuthorizationController`). `Authorize()` now signs the
Identity cookie out and re-challenges — and strips `prompt` from the `returnUrl` first, or the login
page would post back, sign the freshly-authenticated user out again, and loop in a new way.

## Verified

All 8 SPAs typecheck; `src/Auth` builds with 0 errors. After deploying auth + all 8 SPAs: every one
of the 11 public hosts answers 200/302, and the shipped bundles for refahi, vms and admin all carry
the new `signoutRedirect` recovery.

## Why the other half is not in this commit

The request was also: *an admin with assigned services should reach only those*. Three adversarial
reviews of my first plan all returned **flawed**, and I verified each load-bearing claim myself:

| Claim | Verified |
|---|---|
| `src/Auth` cannot see `Roles.cs` | true — it references only `ServiceDefaults`, and hardcodes `"Administrator"` |
| No `admin` or `vms` service key exists | true — mapping `admin-web` would gate on a key **nobody can grant** |
| The IdP ignores `prompt=login` | was true; fixed here |
| All 8 SPAs silently renew; only 2 have refresh tokens | true — 6 re-hit `connect/authorize` every ~30 min |
| Creating a user through the panel always writes grants | true (`AdminController.cs:103`) |

The last two together are why this must not ship as one commit: a gating change would start refusing
people **within half an hour**, not at next login, and every admin created through the panel with
service boxes ticked already has a non-empty grant list. Mapping `admin-web` — which my first plan
did — would have locked every such administrator out of the only screen that could undo it, fixable
only by editing SQL on the server.

## Next, in this order

1. `SuperUser` **capability** first, while the role still does not exist: one `Roles.AdminOrSuper`
   constant across the ~85 `[Authorize]` sites and the 10 `RequireRole` sites. A no-op until step 2.
2. Seed the `SuperUser` role in `AuthDbInitialiser` (**not** `Roles.cs` — the IdP cannot see it) and
   give it to the seeded administrator, additively.
3. SuperUser bypasses the grant gate — the escape hatch must exist before anything can refuse.
4. Add a `vms` key to `ServiceKeys.All` so it becomes grantable, and **backfill** it to every
   administrator who already holds grants.
5. Only then map `vms-web` in `ClientToKey`.
6. Launcher filtering last, in all 8 copies of `AppSwitcher.tsx` — keeping the admin tile always
   visible to administrators, because it is the repair tool.

`admin-web` stays role-gated and unmapped. `election-web`/`room-web` stay unmapped too: engineers are
provisioned with exactly `["walfare"]`, so gating those would disenfranchise every one of them, and
promoting such an engineer to Administrator would lock them out of everything at once.
