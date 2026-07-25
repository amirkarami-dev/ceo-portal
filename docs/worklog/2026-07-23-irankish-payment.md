# Iran Kish payment: made it actually reach the bank

- **Date:** 2026-07-23
- **Area:** welfare (payments)
- **Branch / commits:** `feat/walfare-service` — `9c4e891`, `c159587`, `9a7f9fa`, `0a6e19e`, `4da2273`
- **Status:** shipped to production (merged to `main` in `20f96b3`)

## Goal
Pressing «رزرو و پرداخت» never opened the Iran Kish page, and a payment that *did* go through
stayed «موفق تایید نشده» at the bank. Make the whole path work, and give admins a way to
confirm a payment the callback missed.

## Root cause — four separate bugs, each disguised

1. **Unreadable reply reported as "no connection."** The gateway answered, but its error body
   has `"status": 400` (a number) and our DTO declared `bool`. `System.Text.Json` threw; the
   outer catch reported «ارتباط با درگاه پرداخت برقرار نشد». The legacy client used Newtonsoft,
   which coerces silently. → lenient converter + separate handling for a parse failure.

2. **The gateway rejected our request.** Proven live against `ikc.shaparak.ir` with the real
   merchant credentials:

   | `additionalParameters` | result |
   |---|---|
   | `[{"Key":"nationalId","Value":""}]` (our code) | HTTP 400 |
   | same, camelCase | HTTP 400 |
   | omitted / null / empty array | **HTTP 200 + token** |

   Their deserializer cannot read a `KeyValuePair` entry in any casing, and the legacy client
   only ever sent an **empty** nationalId there. → stop sending it.

3. **Wrong redirect shape.** The IPG page takes the token as a **query** parameter
   (`…/IPG/Index?token=…`); we built a path segment. Confirmed from the legacy
   `PaymentIrkCommandHandler`.

4. **Approval code `"00"` read as failure.** The callback compared against the literal `"0"`.
   A real success (card charged, RRN/STAN/masked PAN all returned) was stored as *failed* and
   **verify never ran** — so the bank held it as «موفق تایید نشده» and would auto-reverse it.
   → compare numerically.

## What changed
- `src/Infrastructure/Payments/IranKishGateway.cs` — lenient `status`, log the real reply on a
  parse failure, drop `additionalParameters`, `?token=` redirect.
- `src/Application/Walfare/Payments/Payments.cs` — numeric approval check; persist
  RRN/STAN/masked PAN **before** deciding; keep a captured-but-unverified row as `Initiated`
  so it can be retried; new `ConfirmPaymentCommand` (admin manual verify) sharing one
  `PaymentCompletion` helper with the callback so both paths end identically.
- `src/Web/Endpoints/Walfare/Walfare.cs` — `POST /api/walfare/payments/{id}/confirm` (admin).
- `walfare-web/src/pages/admin/AdminPaymentsPage.tsx` — «تأیید» button on rows that have a bank
  reference, bank description shown inline, row refreshes in place.
- `src/Application/Walfare/Reservations/Reservations.cs` — re-booking a day with a *pending*
  reservation returns that reservation instead of refusing, so payment can be retried.

## Decisions
- **Manual confirm returns the updated row instead of throwing**, even when the bank declines.
  A thrown error skipped the list refresh, so the reason only appeared after a manual reload.
- **Show «تأیید» only when RRN + STAN exist** — verify is meaningless for a payment that never
  reached the bank.
- **Kept the masked PAN on unverified rows** (explicit user request) — useful evidence.

## Verification
- Live token request from the server using our own envelope code: **HTTP 200 + token**, and the
  three rejected variants documented above.
- Network from inside the API container: DNS + TLS to `ikc.shaparak.ir` fine (403 on a bare GET
  is normal) — which is how "no connection" was disproved.
- API and walfare-web rebuilt and healthy; `refahi.kurdnezam.ir` returns 200.
- **Not done by me:** entering card details / completing a real payment. That stays with the user.

## Follow-ups
- Transaction 4 was captured but never verified in time; the bank replied
  «تراکنش قبلا به کارت دارنده برگه داده شده است» (already reversed). Nothing to recover — it
  only demonstrates why the fix matters.
- Consider a background job that verifies any row left `Initiated` with an RRN for more than a
  few minutes, so a lost callback self-heals without an admin.
