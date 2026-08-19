# مهمانسرا — the guesthouse service, front end

- **Date:** 2026-08-19
- **Area:** welfare
- **Branch / commits:** `feat/walfare-guesthouse` — `267abf9`…`eec5396`, merged to `main` as
  `396a8de` ([PR #1](https://github.com/amirkarami-dev/ceo-portal/pull/1))
- **Status:** **live** at refahi.kurdnezam.ir and **merged to `main`** — but **never walked end
  to end by a human**

## Goal

> «i want full implement new service on @walfare-web as guestHouse : "مهمانسرا"»

with two conditions from the user: the admin confirms a request and enters the price before the
member can pay; and when the کد ملی is not in KurdNezam, the admin fills the form themselves and
then sends an SMS payment link to the mobile already on the request.

This record covers the **front end**. The backend has its own record,
[2026-08-19-walfare-guesthouse-backend.md](2026-08-19-walfare-guesthouse-backend.md).

- Plan: [`docs/superpowers/plans/2026-08-19-walfare-guesthouse-frontend.md`](../superpowers/plans/2026-08-19-walfare-guesthouse-frontend.md)

## What changed

| File | What and why |
|---|---|
| `walfare-web/src/api/walfareApi.ts` | 12 types + 16 calls. Wire enums are const objects, never string unions — the API sends `status: 1`. |
| `walfare-web/src/pages/GuesthouseRequestPage.tsx` | The member's request form; mirrors the paper form, including its 5-companion / 2-infant limits and the server's digit cleaning. |
| `walfare-web/src/pages/MyReservationsPage.tsx` | Split into two tabs. The guesthouse tab shows status, price in Tomans and a pay button. |
| `walfare-web/src/pages/GuesthousePayPage.tsx` | The SMS link's page. **Anonymous**, standalone, and carries no identifier. |
| `walfare-web/src/pages/GuesthousePayResultPage.tsx` | Where the bank lands a guesthouse payer. New, and the reason is a real bug — see Root cause 1. |
| `walfare-web/src/pages/admin/AdminGuesthousesPage.tsx` | Guesthouse CRUD. Its service picker offers only type-2 services. |
| `walfare-web/src/pages/admin/AdminGuesthouseRequestsPage.tsx` | The office's main screen: price, refuse, send SMS, fix receipt, print. |
| `walfare-web/src/pages/admin/GuesthouseReferralPage.tsx` | The printable معرفی‌نامه. |
| `walfare-web/src/pages/admin/AdminServicesPage.tsx` | **The blocker.** `type` was hardcoded — see Root cause 2. |
| `walfare-web/src/components/ui/CrudTable.tsx` | Keeps the table when a background refetch fails; `deleteConfirmDescription` so a page can state what delete really does. |
| `walfare-web/src/theme/global.css` | Print rules. The colour rules exist because of dark mode — see Decisions. |
| `src/Application/Walfare/Payments/Payments.cs` | `ResultPathFor` — the redirect fix for Root cause 1. |
| `tests/Application.UnitTests/Walfare/GuesthousePayRedirectTests.cs` | 6 tests. Nothing covered this path before. |
| `walfare-web/src/pages/dev/GuesthouseFormHarness.tsx` | DEV-only harnesses (6 routes) so every screen could be checked without an OIDC login. Excluded from production — verified against the served bundle. |

## Root cause (defects this uncovered)

None was reported as a bug. Every one was found by measuring.

1. **Every anonymous payer would have been bounced to a login right after paying.** The API sent
   *every* finished payment to `/pay/result`, which the front end serves **inside** `RequireAuth`.
   A guesthouse payer arrives from an SMS and may have no account at all — that is the entire point
   of the feature — so they would have paid real money, been redirected to a login they could never
   pass, and never seen the result or their tracking code. `HandleIrkCallbackCommand` now picks the
   page from the transaction's `TargetType`; anything unrecognised keeps the signed-in page so a
   future payment kind is never exposed by accident.
2. **The feature was unreachable: `AdminServicesPage` hardcoded `type: 1` on submit.** A service of
   type «مهمانسرا» could never be created, so no guesthouse could be attached to anything. The same
   line ran on **edit**, so once such a service existed by any other means, editing its title would
   silently turn it back into a pool and break the member's route.
3. **`error` was checked before `data` — four times, in four different files, including
   `CrudTable`, which backs every admin page.** React Query **keeps `data` and sets `error`** when a
   *background* refetch fails, and `refetchOnReconnect` is on by default. So one network blink
   replaced a half-filled form, a good list, or a valid payment page with an error screen. The worst
   instance told a payer holding a good link that it was invalid — and a payer told that stops
   paying. Now in `docs/ai/GOTCHAS.md`.
4. **The letter doubled a word on every copy.** «مسئول محترم مهمانسرای {name}» printed «مسئول محترم
   مهمانسرای مهمانسرای شماره یک», because names are stored the way people say them. The first fix
   used a character class over a combining mark and was wrong; lint caught it
   (`no-misleading-character-class`) and it is now a plain prefix test.
5. **`CrudTable` claimed every delete was irreversible.** Untrue for a guesthouse: one with requests
   is kept and deactivated. The confirm now says what actually happens.
6. **Lint was already failing on this branch before any of this work** — base `no-redeclare` cannot
   see that a `const` and a `type` of one name are different spaces. `tsc` catches a real
   redeclaration (proved with TS2451/TS2300), so the rule is off.

## Decisions

- **Tomans on screen, Rials on the wire.** The office thinks in Tomans, the API stores Rials.
  Conversion happens at the single call site, and re-pricing prefills from Rials ÷ 10 so the box
  never shows a rial figure.
- **«جناب آقای / سرکار خانم» is required in the price dialog**, although the API accepts null. The
  معرفی‌نامه refuses to print without it, so allowing empty only moves the dead end to the moment
  somebody needs the letter.
- **The pay button needs status Priced AND a token, not either.** Reject clears the token server
  side, so the button can never open a dead link.
- **The print stylesheet forces ink to black.** This panel has a dark theme and browsers do not
  print background colours by default, so without it an admin printing from dark mode gets pale
  text on white paper — a blank-looking sheet that looked correct on screen.
- **DEV-only harnesses instead of a test login.** Every screen except the payment page sits behind
  OIDC, and no password or OTP was entered at any point. `PickerHarness` already established this
  pattern in this app.
- **The service-type rule is enforced only in the picker.** The API still accepts a guesthouse under
  a pool service. See Follow-ups.

## Verification

- `npm run build` and `npm run lint` clean (exit 0); `dotnet build src/Web` succeeded;
  **498 unit tests pass**, 0 failed.
- **Every screen measured at 375px** against seeded harnesses: no page moved sideways
  (`scrollWidth === clientWidth === 375`, zero elements outside the viewport), wide tables scroll
  inside `.ant-table-content`, no undersized touch targets.
- Behaviour proven in a browser, not assumed: exactly **one** pay button across five requests, one
  per status; the priced-without-token row shows an explanation instead; the admin picker offers the
  مهمانسرا service and **not** the pool one; 12,500,000 Rials prefills as ۱,۲۵۰,۰۰۰ تومان; the SMS
  confirm prints the number it will use; editing the guesthouse service shows «مهمانسرا».
- **The print rules were executed, not eyeballed** — lifted out of the stylesheet at run time and
  applied: `.no-print` all hidden, body white, `.print-area` text computed `rgb(0,0,0)`.
- **Live after deploy:** the served bundle name changed (`index-C9GgX75E.js` →
  `index-C3OUxXhY.js`); `/pay/guesthouse/<token>` and `/pay/guesthouse/result` return **200** (the
  SPA fallback works, so an SMS link does not 404); the served bundle contains all four new screens
  and the CSS contains the print block; the live API answers **401** on all gated guesthouse routes
  and **400** on the anonymous one, against **404** for a route that does not exist.
- **Dev harnesses and every fixture value are absent from the production bundle** — checked against
  the file nginx actually serves, including `کاربر آزمایشی` and the fake token.

**Not verified — read this before trusting the feature.**

- **Nobody has walked the flow by hand.** Step 2 of the plan needs an admin login; no password or
  OTP was entered. Creating a service, adding a guesthouse, submitting, pricing, and printing have
  never been done through the real UI by a real account.
- **No real payment.** The Iran Kish round trip, the callback, the duplicate guard, the receipt
  auto-fill, and the new redirect are all unproven against the live gateway. `ResultPathFor` is unit
  tested; the redirect it produces has never been followed by a browser.
- **No SMS has been sent through the app.** The channel was proven by direct curl to mihan on
  2026-08-19, but `send-payment-sms` has never been pressed against production.
- Two fixes landed after the front end was written and are also live: expected refusals no
  longer log user data (`d104c42`), and a guesthouse can no longer be attached to a pool
  service (`eec5396`). The second one's **call sites are verified by build and by reading the
  source, not through HTTP** — creating a guesthouse needs an admin token.

## Follow-ups

- **Have a human walk the flow**, especially the case the feature exists for: a کد ملی that is not
  in KurdNezam, entered by the admin, paid from the SMS link on a phone.
- **Walfare has no functional tests.** The two new server rules are covered by unit tests over
  their decision functions, but nothing exercises the handlers through the HTTP pipeline. The
  functional project needs a real database via Aspire, so adding the first walfare test is a
  piece of work rather than a line.
- Member cancel — `GuesthouseTransitions.CanCancel` exists and is tested; nothing calls it.
- The residual double-callback race from the backend record is unchanged.
