# مهمانسرا — guesthouse referrals in walfare-web

- **Date:** 2026-08-19
- **Branch:** `feat/walfare-guesthouse`
- **Status:** design, awaiting review
- **Replaces:** the paper «فرم درخواست متقاضی» (`temp/guestHouse.txt`)

## What this is

A member asks to stay at one of the organisation's guesthouses. The welfare office confirms it,
works out the price and enters it, the member pays, and the office prints a referral letter the
member takes to the guesthouse manager.

The paper form has two halves and this replaces both: the top half the applicant fills in, and the
bottom half the welfare office writes to the guesthouse manager.

## Four decisions taken up front

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Scope | **Referral only.** A guesthouse is a name, a city and a manager. | Capacity and availability. Nothing on the form implies rooms, beds or a calendar, and the admin sets the price by hand. A nullable `Capacity` column goes in from day one so the rule can be added later without a migration. |
| Paying | **One payment page, two doors** — an SMS link, and a button in the member's own list. | SMS-only would make the admin a bottleneck for a member sitting at the screen. Two separate flows would be two things to keep in step. |
| Output | **Generate the referral letter**, print-ready, with the receipt number filled in and editable. | Leaving it hand-written keeps the re-typing, which is where mistakes happen. Emailing it to the manager needs contact inventory nobody maintains yet. |
| Shape | **A new `WelfareServiceType`**, following the pool model. | A standalone module would need a special case on the member's services page and a second admin screen for the same kind of thing. Reusing `WelfarePoolReservation` with nullable columns would put two different shapes in one table. |

## Domain

Three new entities, alongside the existing `WelfareService` → `WelfarePool` → `WelfarePoolReservation`.

```
WelfareServiceType { PoolTicket = 1, Guesthouse = 2 }   // new member on the existing enum

WelfareGuesthouse : BaseAuditableEntity      // sits under a WelfareService, as WelfarePool does
  ServiceId, Service
  Name           «مهمانسرای …»
  City           شهرستان
  ManagerName    مسئول محترم مهمانسرای …   — printed on the referral letter
  Description
  IsActive
  Capacity?      nullable, unused today; reserved so the rule can arrive without a migration

GuesthouseRequest : BaseAuditableEntity
  GuesthouseId, Guesthouse
  UserId?                     NULL when an admin created it for somebody with no account
  CreatedByAdmin  bool
  Status          GuesthouseRequestStatus

  // applicant — a SNAPSHOT, same reasoning as WelfarePoolReservation:
  // the letter must keep saying who it was issued to even if the org record changes later
  FullName, NationalCode, MembershipNumber, Mobile
  Gender?                     nullable — drives «جناب آقای» / «سرکار خانم» on the letter.
                              That select is on the OFFICE's half of the paper form, so a member
                              submitting a request never fills it in. Optional at submit, and the
                              admin sets it on the referral screen before printing. The letter
                              refuses to print until it is set, rather than guessing from a name.

  // the stay — Jalali string as displayed, Gregorian shadow for querying,
  // the convention WelfareService already uses
  CheckInDateJalali, CheckOutDateJalali        e.g. 1405/05/27
  CheckInDate, CheckOutDate                    DateOnly

  // pricing, entered by the admin
  AmountRials     0 until priced
  AdminNote

  // payment
  PaymentToken?               opaque, unique index; minted when the request is priced
  PaymentTokenExpiresUtc?
  PaidAtUtc?
  ReceiptNumber               شماره فیش — auto-filled from the gateway, editable

  Companions : ICollection<GuesthouseCompanion>

GuesthouseCompanion : BaseEntity
  RequestId
  FullName
  Relation?    نسبت — Spouse | Child | Father | Mother | Brother | Sister | Other
  IsInfant     bool
```

**One companion table, not two.** The form separates «اسامی همراهان» from «اسامی کودکان زیر دو سال»,
but both are just a name — the only real difference is that an infant has no نسبت and is not counted
for pricing. A boolean says that in one place; two tables would duplicate every query and every form
control to express it.

**Limits from the form**, enforced in validation rather than in the schema: at most 5 companions and
at most 2 infants.

**Nights** is derived (`CheckOutDate - CheckInDate`), never stored. A stored copy is one more thing
that can disagree with the dates beside it.

## The lifecycle

```
Submitted ──price──▶ Priced ──gateway verifies──▶ Paid
    │                   │
    │                   ├──re-price (admin, before payment)──▶ Priced
    ├──reject──▶ Rejected
    └──cancel──▶ Cancelled ◀──cancel──┘
```

| Status | Meaning |
|---|---|
| `Submitted` | Created by the member or by an admin. No price yet, nothing to pay. |
| `Priced` | The admin confirmed it and entered the amount. The payment token exists from this moment. |
| `Paid` | The gateway verified server-to-server. Terminal. The referral letter unlocks here. |
| `Rejected` | The admin refused, with a reason the member can read. |
| `Cancelled` | Withdrawn before payment, by either side. |

`Paid` is terminal — refunds are out of scope and would go through the existing payments screen.

## Paying

**The token exists only from `Priced`.** Minting it at submission would create a payable link for a
request with no amount.

- 32 random bytes, base64url, unique index, `PaymentTokenExpiresUtc` = priced + 7 days.
- Re-sending the SMS re-uses the same token and extends the expiry. It does not mint a second one —
  two live links for one request is how somebody pays twice.

**The payment page shows only what a payer needs:** guesthouse and city, check-in and check-out,
number of nights, number of guests, and the amount.

It must **not** show the national code, the membership number, or the companions' names. That link is
a bearer token sitting in an SMS inbox — the same reasoning as room-web's `/j/:joinToken` landing,
which deliberately carries no identifiers at all.

Two doors, one page:

| Door | Front-end route | Auth |
|---|---|---|
| SMS link | `/pay/guesthouse/:token` | **anonymous** — the payer may have no account |
| Member's own list | the same route; a member's own request returns its token to its owner | authenticated |

Both call the same two API endpoints listed below.

The anonymous endpoints join the same allow-list as the room join routes, and inherit the shared rate
limiter. **Flagged:** that limiter is 120/min for everyone behind one NAT — already a known concern
for public webinars, and it applies here too.

Payment itself reuses what exists: a new `TargetType` on `PaymentTransaction`, so `HandleIrkCallback`,
`ConfirmPayment` and the admin payments report keep working with no change to their logic.

## When the person is not in KurdNezam

This is the case that shapes the admin form, so it is the default rather than the fallback.

The admin's create form is **plain inputs, always editable**. A national-code lookup against
`WebS_GetEngineerInfo` sits beside the field as a convenience: if it finds somebody, it fills in the
name, membership number and mobile; if it finds nobody, it says so quietly and the admin types them.
**A failed lookup never blocks the form and never disables a field.**

Such a request is stored with `UserId = null` and `CreatedByAdmin = true`. From there it behaves
exactly like any other — it can be priced, paid by SMS link, and printed.

Two consequences worth stating: a null `UserId` means the request cannot appear in anybody's "my
requests" list, so the SMS link is the only door for that person; and `NationalCode` cannot be assumed
unique, because the same person may be typed in twice.

## The referral letter

Admin-only, available once `Paid`, at `/admin/guesthouse/:id/referral`. A print stylesheet, not a PDF
library — the browser already prints well and a PDF dependency buys nothing here.

It fills in the bottom half of the paper form: the guesthouse name and manager, «جناب آقای» or «سرکار
خانم» from `Gender`, the engineer's name, the receipt number, and the dates. The office prints it and
stamps it, exactly as today.

`ReceiptNumber` is auto-filled from the gateway's tracking code and left **editable**, so a wrong or
missing reference can be corrected before the letter is printed.

**Payment is gateway-only.** An earlier draft of this spec said a payment could arrive as a bank
transfer the admin entered by hand. It cannot: nothing moves a request to `Paid` except a verified
gateway transaction, so a hand-typed receipt on an unpaid request would let the admin fill the field
and still never print the letter. Recording an offline payment would mean a command that marks a
request paid with no gateway record — a money-adjacent capability that is deliberately **out of
scope** here rather than half-built.

## API surface

```
# member
GET    /api/walfare/guesthouses?serviceId=       list active guesthouses
POST   /api/walfare/guesthouse-requests          submit a request
GET    /api/walfare/guesthouse-requests/mine     my requests, with status and amount

# anonymous — the SMS link
GET    /api/walfare/guesthouse/pay/{token}       payment summary (no identifiers)
POST   /api/walfare/guesthouse/pay/{token}/init  → gateway redirect

# admin
GET    /api/walfare/admin/guesthouses            CRUD under a service
POST   /api/walfare/admin/guesthouse-requests    create on behalf of anyone
GET    /api/walfare/admin/guesthouse-requests    list + filter by status, guesthouse, date
POST   .../{id}/price                            confirm and set the amount → Priced
POST   .../{id}/reject                           with a reason
POST   .../{id}/send-payment-sms                 send or re-send the link
PUT    .../{id}/receipt                          override the receipt number
```

## SMS

`ElectionSmsSender` is already `SendAsync(phone, message, ct)` and is already bound to the **same `Sms`
configuration section as the identity provider**, so production credentials exist and no new secret or
deploy step is needed.

Add a neutral `ISmsSender` in `Application/Common/Interfaces`, have `ElectionSmsSender` implement it,
and register the one implementation under both names. **No election code changes** — one interface and
one DI line.

Delivery is reported, never assumed: the sender returns a bool, and a failure surfaces to the admin as
"not sent" rather than quietly looking successful.

## Front end — walfare-web

Follows what is there: `pages/` for member screens, `pages/admin/` for admin ones,
`components/ui/JalaliFields` for the dates, `lib/jalali.ts` for display.

**Member** — the guesthouse appears on the existing «خدمات رفاهی» page; a request form mirroring the
paper form (applicant, stay, companions, infants); and the request in «رزروهای من» showing status, the
amount once priced, and a pay button.

**Admin** — guesthouse CRUD under the service; a requests list carrying the price/confirm action, the
send-SMS button and the print link. The list is where the admin sees the amount and sends the link,
which is the flow described in the request.

Mobile is checked per page **and** per component, as every screen in this estate is.

## Testing

Pure functions get tests; wiring does not.

- nights between two Jalali dates, including a same-day and a reversed range
- the status transition guard — every illegal move refused
- companion and infant limits at 5 and 2, and one over each
- token expiry: a link past `PaymentTokenExpiresUtc` refuses rather than opening the gateway
- the payment summary DTO carries **no** national code, membership number or companion name

**Reuse `JalaliDate.Parse`** from `src/Application/Common/JalaliDate.cs` — the converter the whole
walfare module already uses. Do not write another one. (`packages/assessment-core` has its own copy,
currently wrong by a month on the `wip/mabhas19-compliance-schedule` branch; unrelated code, and a
reason not to add a third.)

**Note the paste trap:** `JalaliDate.NormalizeDigits` has the same weakness that caused the OTP bug —
it converts Persian digits but lets every other character through, so a national code pasted with an
invisible mark arrives one character too long. Admins will paste national codes into this form. Strip
to digits on the way in.

## Out of scope

- Capacity, availability and double-booking. The column exists; the rule does not.
- Refunds and cancellation after payment.
- Sending the referral letter to the guesthouse manager.
- Editing a request after it is paid.

## Follow-ups

- The shared 120/min rate limiter now covers the anonymous payment route too.
- If guesthouses turn out to fill up, capacity is a rule over the existing column plus an overlap
  query — no schema change.
