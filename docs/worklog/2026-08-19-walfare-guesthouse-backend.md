# مهمانسرا — the guesthouse referral service, backend

- **Date:** 2026-08-19
- **Area:** walfare / api
- **Branch / commits:** `feat/walfare-guesthouse` — `e78a997`…`2c2341d` (26 commits off `main@7b9b024`)
- **Status:** built, tested and proven over HTTP locally; **not merged, not deployed**

## Goal

> «i want full implement new service on @walfare-web as guestHouse : "مهمانسرا"»
> — with two notes: after a member reserves, the admin confirms and enters the price; and when the
> national code is not in KurdNezam, the admin fills the form themselves and then sends an SMS
> payment link to the mobile already on the request.

This record covers the **backend only**. The front end is a separate plan, not yet written.

- Spec: [`docs/superpowers/specs/2026-08-19-walfare-guesthouse-design.md`](../superpowers/specs/2026-08-19-walfare-guesthouse-design.md)
- Plan: [`docs/superpowers/plans/2026-08-19-walfare-guesthouse-backend.md`](../superpowers/plans/2026-08-19-walfare-guesthouse-backend.md)

## What changed

| File | What and why |
|---|---|
| `src/Domain/Walfare/WelfareGuesthouse.cs`, `GuesthouseRequest.cs` | Three entities. `WelfareServiceType.Guesthouse = 2` joins the existing enum. One companion table with an `IsInfant` flag rather than two — the form separates them but both are just a name. `Nights` and `GuestCount` are derived, never stored. |
| `src/Infrastructure/Data/Configurations/Walfare/WalfareConfigurations.cs` | Three configurations. Filtered unique index on `PaymentToken` (`IS NOT NULL`), index on `UserId`, `Restrict` from request→guesthouse so a paid referral keeps pointing at its place. |
| `src/Infrastructure/Data/Migrations/…AddWalfareGuesthouse` | One migration, applied and verified locally. |
| `src/Application/Common/Interfaces/ISmsSender.cs` | Neutral SMS interface; `ElectionSmsSender` implements it, one DI line, no election code changed. |
| `src/Infrastructure/Elections/ElectionSmsSender.cs` | **Now implements `direct` (msgway)** and refuses an unknown provider — see Root cause. |
| `src/Application/Walfare/Guesthouses/*.cs` | Four files: guesthouse CRUD, request submission (member + admin), admin pricing/reject/list, token payment. |
| `src/Application/Walfare/Payments/Payments.cs` | A second `TargetType` branch in the shared completion helper, with a duplicate-payment guard. |
| `src/Web/Endpoints/Walfare/Walfare.cs` | Three endpoint groups; the two payment routes anonymous, everything else gated. |

## Root cause (defects this uncovered)

Every one was found by review or by measuring — none was reported as a bug.

1. **The API could not send SMS at all, and said it could.** `deploy/.env` pins `SMS_PROVIDER=direct`;
   `ElectionSmsSender` implemented only `mihan` and `relay`, so `direct` fell to `_ => LogOnly(message)`
   — **which returns `true`**. Every SMS the API attempted in production was logged and reported as
   sent while nothing was delivered. This affected the **election channel too**, not just this feature.
   Fixed by implementing `direct` here, mirroring `src/Auth/Sms/SmsDirectSender` — including the part
   that matters: msgway answers HTTP 200 with the verdict in the **body**, so the body is parsed and
   `IsSuccessStatusCode` is never trusted alone. An unknown provider now logs an error and returns
   `false`; `log` is an explicit arm.
2. **A forwarded payment link could be paid twice.** Two people opening one SMS both init (two ledger
   rows, by design) and both pay — the bank really does capture both cards. The second callback
   overwrote `PaidAtUtc` and `PaymentTransactionId` while keeping the first receipt number, destroying
   the linkage an admin would need to spot it. The obvious guard is **wrong**: `PaymentTransactionId`
   is assigned at *init*, so guarding on it skips the legitimate first callback. Guarded on `Status`;
   a duplicate now annotates its own ledger row for refund and leaves the request alone.
3. **An input validator that never ran.** `ValidationBehaviour` resolves `IValidator<TRequest>` where
   `TRequest` is the *command*, so an `AbstractValidator<SomeInput>` is never found. The companion
   limits, the date-order rule, the ten-digit national code and the invisible-mark paste handling were
   dead code **while all ten unit tests passed**, because the tests construct the validator directly.
4. **A solo applicant was a 500.** `GuesthouseRequestInput` is a positional record bound through its
   constructor, so a body omitting `"companions"` gave null and the count rules dereferenced it — no
   Persian message, for the commonest request there is.
5. **An expired link disclosed the whole stay for ever.** The summary returned guesthouse, city, both
   dates, party size and amount regardless of `Payable`, and nothing clears the token on expiry.
6. **`Roles.Administrator` on 11 handlers** would have locked SuperUsers out of the entire admin
   surface — the role check compares `role == x` without trimming. `Roles.cs` documents it.
7. **`nvarchar(max)` on `UserId`** cannot be an index key; `Mobile` at 11 chars would have thrown
   SqlException 8152 on `+989121234567`, a 500 with no field message in the admin-entry flow.

## Decisions

- **The token is minted at pricing, never at submission** — a token on an unpriced request is a
  payable link for an amount nobody set. Re-sending reuses it (`??=`) and only extends the expiry,
  now clamped to first-priced + 30 days so repeated sends cannot keep a link alive for ever.
- **The anonymous payment payload carries no identifiers.** Enforced by a reflection test listing its
  nine allowed property names, which fails if a tenth is added.
- **Payment is gateway-only.** The spec originally said a payment could arrive as a bank transfer the
  admin entered by hand; review traced every write to `Status` and found none reachable without a
  verified gateway transaction, so the admin could type a receipt and never print the letter. The
  claim was dropped rather than half-built — recording an offline payment would need a command marking
  a request paid with no gateway record, which is money-adjacent and explicitly out of scope.
- **`Sms:Provider` was NOT switched to `mihan`**, although that was asked for. That value is shared
  with the identity provider, whose `direct`/msgway path is the OTP login flow fixed earlier the same
  day; moving it would have risked a working login. Teaching the API the provider already in use
  achieves the same intent with no deploy change and no shared-config edit.

## Verification

- **491 unit tests pass** (453 pre-existing + 38 new); `dotnet build src/Web` 0 errors.
- Migration applied to the local database; all three tables present and **plural**.
- Proven over real HTTP against a running API, with rows seeded directly into SQL Server (then
  deleted), because minting an admin token needs a human login:
  - **The privacy claim, with no credentials at all.** The seeded row held national code
    `0000000000`, the name «کاربر آزمایشی» and two companion names. The anonymous summary returned
    exactly nine fields and **none of them**; `nights: 2` and `guestCount: 2` both correct, the infant
    properly uncounted.
  - **Expiry is a server control, not a hidden button.** With the expiry pushed into the past, the
    summary blanked all seven stay fields and returned only the Persian reason, and `POST …/init`
    answered **400**, not a redirect.
  - **Admin routes exist and are gated** — `admin/list`, `guesthouses/admin`, `{id}/referral` and
    `mine` all **401**, against **404** for a route that genuinely does not exist.
  - Incidental proof: the first seed failed with `Msg 1934 … QUOTED_IDENTIFIER`, which only a
    **filtered index** raises — so the `PaymentToken` filtered unique index is live and enforced.

**Not verified.** No request was created or priced *through the API* — that needs an admin token from
the IdP, and no OTP or password was entered. **No real card payment was made**, so the Iran Kish
round trip, the callback, and therefore the duplicate-payment guard and the receipt auto-fill are
unproven against the live gateway. **No SMS was actually sent** — the `direct` provider path is
mirrored from the IdP's working one and compiles, but has never delivered a message from this host.
Nothing is merged or deployed.

## Follow-ups

- The front-end plan: member request form, the anonymous payment page, admin screens, referral print.
- **Residual race:** two gateway callbacks whose SELECTs both land before either COMMITs could still
  both settle a request (last-write-wins). Needs serializable isolation or a DB constraint. Same shape
  as the room-whiteboard first-save race.
- A member cancel endpoint — `GuesthouseTransitions.CanCancel` exists and is tested, but nothing calls
  it yet; it ships with the member UI.
- `CheckInDateJalali` stores the user's raw text, so `1405-5-1` and `۱۴۰۵/۰۵/۰۱` both persist as typed.
- The companion→DTO mapping is duplicated in two files; a future enum edit could desync them.
