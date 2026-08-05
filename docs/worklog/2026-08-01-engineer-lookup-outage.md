# Down: every engineer was told they were not an engineer

- **Date:** 2026-08-01
- **Area:** welfare / elections / rooms — the shared engineer directory
- **Branch / commits:** `main` — `28b7c5e` deployed; regression test follows
- **Status:** **fixed and deployed**; awaiting a confirming login from a real engineer

## Symptom

Amir signed in to `refahi.kurdnezam.ir` with a کد ملی that had worked before, got past the SMS code,
and the welfare page answered:

> **این حساب، حساب مهندس نیست** — رزرو خدمات رفاهی فقط با حساب مهندس … امکان‌پذیر است؛ برای این حساب
> پرونده عضویتی در سازمان یافت نشد.

The person is a member. The organisation's database was healthy the whole time.

## Root cause

`KurdNezamEngineerDirectory.LookupAsync` read `CodeMeli` out of the first row, then called
`ReadAsync` to refuse a multi-row answer:

```csharp
var codeMeli = S("CodeMeli");        // row 1 — fine
…
if (await r.ReadAsync(ct)) { … }     // ADVANCES; false for one row, reader now past the end
…
S("Vazeyat")                         // throws: "Invalid attempt to read when no data is present"
```

For the normal single-row answer `ReadAsync` returns `false` **and leaves the reader positioned past
the last row**, so every field read after it threw. The `catch` reported `Unavailable`,
`GetByNationalCodeAsync` flattens `Unavailable` to `null`, and the welfare handler renders `null` as
«this account is not an engineer».

So a reader-position slip became a **false statement about a person's membership**, on screen.

**It was not today's room deploy.** `git merge-base` puts it in `d02e88a` (2026-07-30), the election
adversarial-review fixes — the multi-row guard was added there, correctly motivated and wrongly
ordered. It went live with the election deploy and had been failing every engineer lookup on the
platform for about a day: welfare, voting, and the room presenter/invite pickers.

The 203 stack traces in the API log all name `line 91` — `S("Vazeyat")`, the first read after the
advance.

## Two fixes

**1. Read before advancing.** Every field is now captured from the first row before the multi-row
check touches the reader. The mapping moved into `MapAsync(DbDataReader, …)` so it can be tested.

**2. An outage must not be reported as "you are not a member."** The welfare `me` and reserve
handlers now call `LookupAsync` and answer `Unavailable` with «ارتباط با سامانه نظام مهندسی برقرار
نشد» instead of the membership message. The election cast path already did this — the design doc
called out the trap explicitly and welfare was simply never brought in line.

`GetByNationalCodeAsync` remains, but it is now the odd one out: it collapses NotFound, Unavailable
and integrity failures into a single `null`, and any caller rendering that as "not a member" is
making a claim it cannot support.

## Verification

**Against the real organisation database**, for the affected کد ملی:

- the SP returns **exactly one row** — so the multi-row guard was never going to fire anyway;
- all ten columns the directory reads (`CodeMeli`, `Nam`, `NameKhanevadegi`, `FirstName`, `LastName`,
  `ReshteID`, `Mob`, `Vazeyat`, `PrvExp`, `MadrakNam`) **exist** in the result set;
- `Vazeyat = 0` (active) and `PrvExp = 1405/06/28` (not expired) — the person passes eligibility.

**Six new unit tests** (`KurdNezamRowMappingTests`) map a real `DbDataReader` built from a
`DataTable`, which throws on read-past-end exactly like SQL Server. The single-row test asserts
`MembershipStatus == 0`, which is unreachable under the old ordering. The multi-row and
wrong-person guards are pinned too, so the fix cannot be "simplified" back into the bug.

Unit **332 passed**; functional **145 passed / 3 failed** (the same three pre-existing failures).

**Not yet confirmed:** nobody has logged in since the deploy. The proof that matters is Amir
retrying `refahi.kurdnezam.ir` and reaching the booking page.

## A second problem the same data exposed — fixed, not yet deployed

Amir ran the SP by hand while we were diagnosing the outage, and the row shape gave the election
service away. It carries `ReshteID = 3000` next to `ReshteNam = عمران-عمران`, while the election
matches `EngineerInfo.ReshteCode` against the seven codes `1`–`7` (عمران = `3`).

So «انتخاب هیئت رئیسه واحد گاز» — eligibility مکانیک, code `4` — would have compared `"4"` against a
`ReshteID` and **refused every mechanical engineer from their own election** with «این انتخابات ویژهٔ
مهندسان رشتهٔ … است». Nothing had broken yet only because no election has been run.

### The discipline is not in the procedure at all

The first attempt at this fix read the SP's own `Reshte` column, which happened to be `3` on the
sample row. **That was wrong too**, and Amir corrected it: the real path is two steps.

```
WebS_GetEngineerInfo.CodeOzveyat  →  tblDW_OzviatInfo.Ozviat  →  Reshte
```

Verified against production:

| Check | Result |
|---|---|
| `tblDW_OzviatInfo` readable by the API's account | 6,938 rows |
| `Ozviat = 499` (the sample member) | `Reshte = 3` — agrees with `ReshteNam = عمران-عمران` |
| `Reshte` across the whole membership | `3`→3321, `1`→1934, `5`→763, `4`→538, `6`→264, `2`→108, `8`→6, `7`→4 — **no nulls** |

It is also the same table and column the **analytics** semantic model has read in production since
long before the election service existed (`oz_info → tblDW_OzviatInfo`, `Reshte` decoded through
`ReshteNames`). Three things now agree: the org's data dictionary, analytics, and the live rows.

The lookup is therefore two commands on one connection. The reader must be **closed** before the
second runs — without MARS a second command on an open reader fails outright.

Failure behaviour, deliberately asymmetric:

- a membership row with **no** warehouse row leaves `ReshteCode` empty, which fails *closed* for a
  discipline-restricted election and is harmless for an all-members one;
- a SQL failure still throws and surfaces as `Unavailable`, so an outage is never reported as
  "wrong discipline".

### ⚠ Six members carry `Reshte = 8`

That value is not in the seven-code dictionary and has no option in the admin picker, so those six
**cannot be included in any `ByReshte` election** as things stand. Worth resolving with the
organisation before the first real election rather than discovering it on the day.

## Follow-ups

- Confirm the welfare login works again (Amir).
- **Deploy `321c819`.** The running API has only the outage fix (`28b7c5e`); the discipline fix is
  committed and tested but not live. It cannot matter until an election is created, so it was held
  rather than restarting the API twice.
- Ask the organisation what `Reshte = 8` is.
- Consider deleting `GetByNationalCodeAsync` outright and making `LookupAsync` the only way in. Its
  remaining callers are the IdP's engineer login, where "unknown" and "unavailable" also deserve
  different messages.
