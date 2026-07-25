# Welfare service: engineer login, booking, admin panel

- **Date:** 2026-07-23
- **Area:** welfare
- **Branch / commits:** `feat/walfare-service` — `edfb5a6` … `4da2273` (see `git log main`)
- **Status:** shipped to production (merged to `main` in `20f96b3`)

## Goal
A welfare service for the organisation's engineers: sign in with **کد ملی** only (SMS code, no
mobile typed in), pick a day, reserve a pool ticket, pay through Iran Kish. Admins define the
services, pools, and see reservations and payments. Lives at **refahi.kurdnezam.ir**.

## What changed (shape, not a file dump)
- **IdP** (`src/Auth`): `EngineerLogin` page — national code → SMS code. The person is resolved
  from the organisation database (`WebS_GetEngineerInfo`); if they have no account one is created
  with **username = national code** and granted only the `walfare` service. The phone number is
  re-derived server-side at verify time and never posted by the browser.
- **Domain** (`src/Domain/Walfare`): `WelfareService` (offer + Jalali window) → `WelfarePool`
  (weekday bitmask where bit 0 = شنبه, price, capacity, hours) → `WelfarePoolReservation`
  (ticket + buyer snapshot) → `PaymentTransaction` (shared ledger for any future paid feature).
- **Application/Web**: `/api/walfare/*` — services, pools (incl. a `calendar` endpoint that feeds
  the booking day badges), reservations, payments.
- **SPA** (`walfare-web`): services, booking calendar, my reservations, payment result; admin:
  services, pools, reservations, payments. Jalali date/time pickers in the admin forms.
- **Discoverability**: a «سامانه رفاهی مهندسین» card on the Kurdnezam home page and the service
  added to the app launcher in all five SPAs.

## Root causes worth remembering
- **Every national-code login failed** because of a C# overload trap in the SQL call
  (`new SqlParameter("@Code", 0)` sends no value). Full detail in `docs/ai/GOTCHAS.md`.
- **A staff account could never book.** Tickets are issued against the organisation membership
  record, looked up by national code — `admin1` has none. That is correct behaviour, but the app
  dead-ended with a 400 at the end of the flow; it now says so up front (`EngineerGate`).
- **The panel was unusable on a phone**: a fixed 232px sider left the content a sliver, so a card
  title broke one letter per line. Below `md` the nav is a drawer now.

## Decisions
- **Username = national code.** Simplest stable link between the IdP account and the membership
  record; also what the OTP flow needs.
- **One shared payment ledger**, not a welfare-specific table — `TargetType`/`TargetId` let the
  next paid feature reuse it.
- **One live reservation per person / pool / day.** Re-booking a *pending* day returns the same
  reservation (so payment can be retried) and only refuses when it is already paid.
- **`antd-jalali` for the pickers** — it is AntD's own picker generated over a Jalali dayjs, so
  RTL, locale and theme match exactly; a custom picker would drift.
- **Booking stays engineer-only** (user's explicit choice) rather than letting admins buy tickets.

## Verification
- Backend built and unit tests run on the server; all SPAs build and lint clean.
- Live checks: `refahi.kurdnezam.ir` 200 with a valid certificate, `/api/walfare/*` returns 401
  anonymously, the migration's four tables exist, the OIDC client is seeded.
- A real engineer signed in with a national code and reached the booking flow.
- **Not verified by me:** the SMS delivery path end to end, and completing a card payment.

## Follow-ups
- `walfare-web` has two pre-existing lint errors (`ReservationStatus` / `PaymentStatus`
  "already defined") from the deliberate const+type pattern — silence or accept.
- Consider cancelling stale `PendingPayment` reservations so capacity is not held forever.
