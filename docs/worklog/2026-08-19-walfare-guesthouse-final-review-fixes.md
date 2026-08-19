# Guesthouse final review — a REJECTED request could be paid, and the 30-day link ceiling never bound

- **Date:** 2026-08-19
- **Area:** walfare / api
- **Branch / commits:** `feat/walfare-guesthouse` — see `git log -1` after this commit
- **Status:** built and tested locally; **not merged, not deployed**

## Goal

Fix four money-correctness defects a final whole-branch review found in the guesthouse payment flow,
before the branch merges: two critical (a rejected request reachable to `Paid`; a link-lifetime ceiling
that never binds), one important (re-pricing during an in-flight payment settling the wrong amount),
and one minor cleanup (a route rename and a member-facing field that leaks admin-only data) — cheap now,
expensive once a front end exists to pin them.

## What changed

- `src/Application/Walfare/Payments/Payments.cs` — the guesthouse branch of
  `PaymentCompletion.ApplyVerifiedAsync` now asks `GuesthouseTransitions.CanPay(req.Status)` instead of
  checking only `req.Status == Paid`, and compares `tx.AmountRials` to `req.AmountRials` before
  settling. Either failure annotates the ledger row in Persian and leaves the request untouched instead
  of marking it Paid.
- `src/Domain/Walfare/GuesthouseRequest.cs` — new `FirstPricedAtUtc` column, set once.
- `src/Application/Walfare/Guesthouses/GuesthouseAdmin.cs` —
  `PriceGuesthouseRequestCommandHandler` sets `FirstPricedAtUtc ??= clock.GetUtcNow()`;
  `SendGuesthousePaymentSmsCommandHandler` clamps the re-send ceiling from `FirstPricedAtUtc +
  MaxLifetime` instead of reconstructing it from `PaymentTokenExpiresUtc`, and throws a Persian refusal
  if the ceiling has already passed.
- `src/Infrastructure/Data/Migrations/20260819052021_AddGuesthouseFirstPricedAt.*` — one nullable
  `datetimeoffset` column on `GuesthouseRequests`, nothing dropped.
- `src/Web/Endpoints/Walfare/Walfare.cs` — member route `mine` → `me`, matching
  `WalfareReservations`'s sibling route. No client exists yet, so nothing else to update.
- `src/Application/Walfare/Guesthouses/Guesthouses.cs` — split the shared
  `GuesthouseDtoProjection.From` into `From` (admin, keeps `ManagerName`) and `ForMember` (blanks it).
  The member-visible active-guesthouses query now uses `ForMember`; the admin list and CRUD are
  unaffected.
- `docs/ai/GOTCHAS.md` — two new entries: re-deriving payment legality instead of asking the transition
  table, and computing "first happened at" from a field every later write overwrites.
- `tests/Application.UnitTests/Walfare/GuesthouseTransitionTests.cs` — added the missing
  `CanPay(Rejected) == false` case (`Cancelled` was already covered).

## Root cause

1. **Rejected → Paid.** The completion branch's only guard was "is this already Paid" (the duplicate
   case). It never asked whether the request was still in a *payable* state at all, so any other
   non-payable status — Rejected being the reachable one, because `CanReject` allows `Priced` and a
   payer can already be mid-payment when an admin refuses the request — fell straight into the settle
   branch. `GuesthouseTransitions` exists specifically so handlers never have to reason this out by
   hand; this one did anyway.
2. **The ceiling never bound.** `existing - Lifetime + MaxLifetime` tried to recover "when was this
   first priced" by doing arithmetic on `PaymentTokenExpiresUtc` — the exact field every re-send
   overwrites. Each send moved the recovered instant forward by roughly the gap since the last send,
   so the 30-day ceiling receded at close to the same rate it was supposed to approach. It could only
   ever bind for a link already 16+ days past its own expiry, i.e. a dead link nobody was re-sending.
3. **Amount mismatch.** Nothing compared the ledger row's `AmountRials` (what was actually charged) to
   the request's current `AmountRials` (which an admin can change any time before payment, per
   `CanPrice` allowing re-pricing from `Priced`). A re-price during an in-flight payment would settle
   the request at the new number while the bank collected the old one.

## Decisions

- Both new guards in the settle branch **annotate the ledger row and leave the request untouched**,
  matching the existing duplicate-payment pattern, rather than throwing or silently dropping the
  callback — an admin needs to see and act on the anomaly, and the bank has already moved money either
  way.
- `ForMember` is implemented as `From(g) with { ManagerName = string.Empty }` rather than a second
  hand-written projection, so the two can't drift on every other field the way two independent object
  initializers could.
- `FirstPricedAtUtc` is `??=`, not unconditional, so re-pricing an already-priced request does not
  reset the ceiling — the point is that the ceiling is anchored to the *first* time money was ever
  asked for.

## Verification

```
dotnet build src/Web/Web.csproj
  Build succeeded. 0 Errors.

dotnet ef migrations add AddGuesthouseFirstPricedAt --project src/Infrastructure --startup-project src/Web
  Build succeeded.
  Done. To undo this action, use 'ef migrations remove'

dotnet test tests/Application.UnitTests/Application.UnitTests.csproj
  Passed!  - Failed: 0, Passed: 492, Skipped: 0, Total: 492, Duration: 628 ms
```

492 = the prior 491 plus the added `CanPay(Rejected) == false` case. The migration was opened and
confirmed to add exactly one nullable `datetimeoffset` column (`FirstPricedAtUtc` on
`GuesthouseRequests`) and drop nothing.

Not verified: no functional/integration run against a real SQL Server for this change (the repo's
functional tests were not in scope here and were not run); the migration was not applied to a live
database, per the task ("nothing here is deployed").

## Follow-ups

None deliberately deferred — all four review findings were fixed in this pass. The front end for this
service is still a separate, unwritten piece of work per the original backend worklog.
