# election service — design

> **Date:** 2026-07-29 · **Status:** design saved, NOT started · **Author:** Amir + Claude
> **Reviewed:** adversarial security pass, 7 critical flaws found and fixed below

Online voting for organisation elections, at **election.myceo.ir**, with a **Bale bot** as a second
voting channel. Nothing is built yet.

---

## 1. Goal

An admin defines an election (title, who may vote, candidates, date and time window, one choice or
several). Eligible engineers vote once — on the web or through the Bale bot. After the window
closes, results are shown ordered by most votes.

## 2. Decisions already made

| Question | Decision | Why |
|---|---|---|
| Ballot | **Secret** | Nobody, including a DBA, may link a person to their choice. Hard to retrofit, so settled first. |
| Eligibility | **All members, or specific `Reshte` codes** | Matches the document. |
| Extra rules | **None** — no پایه, no حقیقی/حقوقی filter | Not asked for. |
| Receipt code | **No** | The plain secret ballot was chosen, not the receipt variant. See §5 — a stored receipt is also an attack path. |
| Language | **Persian, RTL**, Jalali dates shown, ISO on the wire | Like the rest of the portal. |

### The 7 real `Reshte` codes (authoritative, from the org's data dictionary)

`1` معماری · `2` شهرسازی · `3` عمران · `4` مکانیک · `5` برق · `6` نقشه‌برداری · `7` ترافیک

> **The client document lists disciplines that do not exist as `Reshte` values:**
> سازه، ژئوتکنیک، زه‌کشی، سازه نگهبان. Those are **صلاحیت/تخصص** (sub-specialities, normally inside
> عمران), not رشته. An election limited to one of them **cannot be built in v1** — mapping them to
> عمران would silently open the election to every civil engineer and quietly corrupt a real result.
> ترافیک (7) exists in the data but is missing from the document.
>
> **Checked 2026-07-29 — confirmed unmappable.** The full `WebS_GetEngineerInfo` column list was
> supplied (≈50 columns; `EngineerInfo` maps only 5). **There is no صلاحیت / تخصص column.** The
> nearest things are four *grade-per-service-type* fields (`PayeTarh`, `PayeNez`, `PayeEjr`,
> `PayeUrb`) and `ShobeID` / `ShobeName` (شعبه, a branch) — none of which is a sub-speciality.
> So an election for one of those four disciplines cannot be expressed on this data source at all.
> It needs either a new field in the org DB or a manually uploaded voter list, both out of v1 scope.

### Useful columns the current code ignores

`EngineerInfo` maps 5 of ~50. Three matter here:

| Column | What it gives us |
|---|---|
| `MadrakNam` | **مقطع تحصیلی** — the education level the document asks for on each candidate |
| `Vazeyat`, `VaziateOzv`, `TarikheEtebar`, `PrvExp` | membership status and licence validity — see open question 5 |
| `ShobeID`, `ShobeName` | شعبه / branch. **Possibly** what «واحد» means in «انتخاب هیئت رئیسه واحد گاز» — needs confirming |

### Candidate entry should auto-fill

The document has the admin typing each candidate's نام، رشته، مقطع تحصیلی by hand. Since candidates
are themselves members, the admin should instead type the candidate's **کد ملی** and have
`FullName`, `ReshteCode` and `EducationLevel` filled from `Nam` / `NameKhanevadegi` / `Reshte` /
`MadrakNam`. Fewer typos, and the candidate's discipline then genuinely matches the org record
instead of whatever was typed. Keep the fields editable for the rare person not in the directory.
This needs `IEngineerDirectory` widened to return `MadrakNam` — an additive change to `EngineerInfo`.

## 3. Reuse — do not rebuild

- **`IEngineerDirectory.GetByNationalCodeAsync`** already calls `[dbo].[WebS_GetEngineerInfo]` with
  `@Code = 0` and returns `EngineerInfo(NationalCode, FirstName, LastName, ReshteCode, Mobile)`.
  This is the identity **and** the eligibility source. It already handles the trap where
  `new SqlParameter("@Code", 0)` binds the wrong overload and sends no value.
- **`src/Auth/Otp/OtpService.cs`** + `ISmsSender`/`MihanSmsSender` already do OTP: TTL, resend
  cooldown, max sends per hour, max verify attempts. Only the **Bale delivery channel** is new.
- **Do not** move `src/Auth/Otp` or `src/Auth/Sms` into `src/Shared`. Refactoring the live login
  path to add a new feature is the wrong trade. The election API gets its own small OTP store.

## 4. ⚠ Naming trap

Use namespace `Mabhas19.Domain.Elections` (**plural**) with a class `Election`. A singular namespace
plus a same-named class gives `Election.Election` resolution errors, and `TreatWarningsAsErrors=true`
makes that painful. Same family of trap as the `ValidationException` ambiguity already in GOTCHAS.

## 5. How the secret ballot works

Two tables that share **no column, no id and no timestamp**.

### `ElectionVoteReceipts` — proves someone voted, without saying who

| Column | Type | Notes |
|---|---|---|
| `ElectionId` | int | |
| `VoterHash` | binary(32) | `HMAC-SHA256(pepper, "{ElectionId}:{nationalCode}")` |

- **Clustered UNIQUE `(ElectionId, VoterHash)`** — this is what makes double voting impossible, on
  both channels, enforced by the database rather than by application logic.
- The **pepper lives only in `deploy/.env`** (SOPS), never in the DB. Without it, a database reader
  cannot even confirm that a *named* person voted.
- Hash the code **exactly as `EngineerInfo.NationalCode` returns it** — trimmed, asserted 10 ASCII
  digits. Never the token string, never the bot's copy. One Persian-digit or leading-zero
  difference and the same person votes twice.
- **No timestamp. Does not derive `BaseAuditableEntity`** — the audit interceptor would otherwise
  stamp `CreatedBy` with the voter's OIDC subject, which destroys the whole scheme.
- **No `Channel` column, no `ConfirmationCode`, no `PepperVersion`.** Each is a metadata dimension
  on the roll that buys almost nothing. A stored receipt code is worse than useless: a coerced
  voter's code plus DB access locates their roll row.

### `ElectionBallots` — the choice, sealed

| Column | Type | Notes |
|---|---|---|
| `BallotId` | uniqueidentifier | random v4, clustered — physical order does not follow insert order |
| `ElectionId` | int | |
| `Sealed` | varbinary | AES-256-GCM over a fixed-length, ascending-sorted slot array |
| `KeyVersion` | tinyint | |

- Key derived per election (HKDF) from a master key that is **also only in `deploy/.env`**.
- Fixed length and sorted slots so ciphertext size and order leak nothing about the choice.
- No identity column, no timestamp, no identity-seeded int PK.

### What an attacker actually gets

| Attacker has | Can they link person → choice? |
|---|---|
| Full **read** access to `CeoDb` (tables only) | **No** — needs the ballot key, which is not in the DB |
| DB read **+ statement-level tracing** on that instance | **Yes, to a row.** Corrected 2026-07-30 — see below. |
| DB read **+ host access** (both secrets) | **Yes, by name.** |

**Corrected after reviewing the implementation.** The earlier claim that pairing needs "the database
*and* the host" understated it. EF batches the receipt INSERT and the ballot INSERT into a single
`sp_executesql` round trip, so one captured statement carries that voter's `VoterHash` and their
`Sealed` blob in the same parameter list. An Extended Events or Profiler session — which a DBA with
read access on that instance normally *can* start — yields an exact roll-to-ballot mapping with no
transaction-log forensics and no filesystem access. The pepper (host) is then only needed to put
names to the roll entries.

Two consequences:

- **Deployment requirement: no XEvent/Profiler trace may run on `CeoDb` during a live election.**
- Splitting the two INSERTs would break the pairing but also break atomicity, which either loses
  votes or allows double votes. The batch stays; the exposure is documented instead of denied.

Note what is *not* exposed: EF's own command logging redacts parameter values to `?` unless
`EnableSensitiveDataLogging` is set, and it is not. This is a database-side tracing exposure, not an
application-log one.

## 6. Security rules that came out of the adversarial review

The first draft **claimed** secrecy it did not have. These are not optional polish — each one was a
working attack.

| # | Attack | Rule |
|---|---|---|
| 1 | `CastVoteCommand` carried `VoterNationalCode`, and this repo binds whole commands from the JSON body (`Projects.cs`). **کد ملی is not secret in Iran** — anyone could vote as anyone. | `CastVoteCommand(int ElectionId, int[] CandidateIds)` **only**. Identity comes from `IUser`. No command reachable from an `IEndpointGroup` may carry a voter identifier. Add an architecture test asserting this. |
| 2 | `BaleChatSession` stored `NationalCode` in plaintext, derived `BaseAuditableEntity`, and was written **inside the ballot transaction** — a named person with a millisecond timestamp next to the ballot insert. Every Bale voter identifiable with SQL read alone. | Session stores only the `VoterHash`, does **not** derive `BaseAuditableEntity`, carries **no timestamp finer than the hour**, and is written **outside** the ballot transaction. |
| 3 | `LoggingBehaviour` logs `{@UserName}` — which for engineer accounts **is the کد ملی** — beside the request name at millisecond precision. That alone is a timestamped plaintext voter roll, in the app log, which is usually less protected than the DB. | Suppress the **whole log line** for the cast in `LoggingBehaviour`, `PerformanceBehaviour` and `UnhandledExceptionBehaviour`. Suppressing `{@Request}` is not enough. Also stop `KurdNezamEngineerDirectory` logging the national code on SQL errors. |
| 4 | The Bale webhook was authenticated by an unguessable URL path only — and that path is returned by `getWebhookInfo` **and** appears in every Traefik access log line. 7-day sessions keyed on an enumerable `chat_id` meant one leaked path casts votes for every verified engineer, with no OTP. | **A fresh OTP to the registered `Mob` on every Bale cast.** No 7-day or 24-hour step-up. The session identifies, the OTP authorises. |
| 5 | OTP was keyed on phone only (`otp:{phone}`) with the **login** wording, and the draft proposed *sharing that cache with the IdP* — making a login code redeemable as a vote code. | Purpose-scoped key `vote-otp:{phone}`, bound to the `ChatId`, wording «کد تأیید رأی‌گیری». **Separate store from IdP login.** |
| 6 | `GET /api/ElectionAdmin/{id}/participation?nationalCode=` — a complete plaintext voter roll behind one flat admin role, with کد ملی **in a query string** (which this repo's own rules forbid). It undid the entire pepper construction. | **Endpoint deleted.** Admins see counts, never who. |
| 7 | Candidate `Title`/`Description`/`IsWithdrawn` were editable after voting opened; `ElectionResults` was a mutable copy of the outcome. A malicious admin could reshape the ballot mid-election. | Freeze **every** election and candidate field once `OpensAtUtc` passes or any receipt exists. Append-only admin action log. Store a `ResultDigest` over the sealed ballots at close. Drop `IsWithdrawn` — a real withdrawal means cancel and re-run. |
| 8 | Per-discipline turnout: a discipline with one eligible engineer turns "turnout 1 of 1" into a roll entry — the pepper bypassed by an aggregate. | Suppress any turnout cell below a k-anonymity threshold (k = 5), or drop the breakdown. |

## 7. Data model — the rest

### `Elections`
`BaseAuditableEntity` (admin actions **should** be audited here).

`Id` · `Title` · `Description?` · `EligibilityMode` (`0 AllMembers`, `1 ByReshte`) ·
`DateJalali` (as typed) · `Date` · `StartTime` · `EndTime` · `OpensAtUtc` · `ClosesAtUtc` (exclusive) ·
`MaxSelections` · `Status` (`Draft`/`Published`/`Cancelled`) · `TalliedAt?` · `ResultDigest?` · `KeyVersion`

- **No `MinSelections`** — the requirement is "one or several"; blank ballots are unsupported, so it
  is always 1.
- **Phase is derived, never stored** — no scheduler: `Draft` → `NotYetOpen` → `Open` → `Closed` →
  `ResultsAvailable`, computed from `TimeProvider` (already registered in DI; never call
  `DateTimeOffset.UtcNow` in a handler).
- **Iran time: use a fixed `+03:30`.** Do **not** use `TimeZoneInfo.FindSystemTimeZoneById` — the id
  is `"Iran Standard Time"` on Windows and `"Asia/Tehran"` in the Linux container, so it breaks
  exactly on the server. Iran has had no DST since 1401.

### `ElectionEligibleReshtes`
`(ElectionId, ReshteCode)` clustered PK. `ReshteCode` is an **opaque string** stored exactly as
`ReshteID` arrives. Labels for the 7 known codes are a display constant — eligibility never reads
them, so a wrong label can never change who may vote. Compare with trim + Persian-digit
normalisation + `OrdinalIgnoreCase`; no numeric parse.

Eligibility is evaluated **live at cast time** and never stored per person. A stored "eligible
voters" table would be a named list sitting next to the roll, inviting a future join.

### `ElectionCandidates`
`BaseAuditableEntity`. `Id` · `ElectionId` · `FullName` · `Description?` · `ReshteCode?` ·
`EducationLevel?` · `SortOrder`. Frozen at publish.

### Results
**No `ElectionResults` table.** A few hundred ballots decrypt in well under a second — tally on
read. A stored, mutable copy of the outcome is a tampering target for no gain.

## 8. Bale bot

Bale's bot API is a near-clone of Telegram's (`https://tapi.bale.ai/bot<token>/METHOD`). OTP push to
a phone that has not started the bot uses the separate `safir.bale.ai/api/v3/send_message`.

**Flow:** `/start` → ask کد ملی → `WebS_GetEngineerInfo` lookup → **OTP to Bale *and* SMS together**
→ verify → show active elections the person is eligible for → choose → **fresh OTP** → cast.

- If one OTP channel fails, the other still counts as delivered; tell the user which one worked.
- Rate limit by `chat_id` **and** by کد ملی, with lockout — کد ملی is public, so brute-forcing
  identities must be as expensive as brute-forcing codes.
- **No `BaleWebhookRegistrar` BackgroundService, no long-polling worker, no `/api/bale/admin/*`
  endpoints.** The webhook is registered once with a `curl`. That machinery is a lot of moving parts
  around a one-off.
- Secrets — bot token, `safir` `api-access-key` — from config only, in `deploy/prod.enc.env`.

## 9. Admin panel and voter web

`election-web` — Vite + React 19 + AntD, same shape as the other SPAs, new OIDC client
`election-web` seeded in `AuthDbInitialiser` (guarded, skipped when its redirect is unset).

**Admin** (`Administrator` only): elections list; a create/edit form (title, eligibility mode +
Reshte codes, candidates, Jalali date + from/to time, `MaxSelections`); publish; monitor **counts
only**; publish results. Server-side validation refuses a broken election: no candidates, end before
start, `MaxSelections` above the candidate count. Keep the server preflight; **no per-card autosave**
and no client mirror of server rules — this form is filled a handful of times a year.

**Voter** (`election.myceo.ir`): active elections → **candidate cards** → select within
`MaxSelections` → **explicit confirm step** (a ballot cannot be undone) → done. Before the window:
countdown. After: results ordered by votes.

### Candidate cards

The ballot is a grid of cards, not a list of radio buttons. Each card carries:

| | |
|---|---|
| Avatar | `ElectionCandidate.Image` — a stored media path, same convention as `KurdnezamPerson.Image`, over the same MinIO bucket |
| نام و نام خانوادگی | the heading |
| رشته | e.g. «مکانیک» |
| مقطع تحصیلی | from `MadrakNam` |
| توضیحات | free text, clamped with a "بیشتر" expander so one long biography cannot make a card tower over the others |

Rules that matter on a ballot:

- **A missing photo must not disadvantage anyone.** Cards with no `Image` render initials in the same
  circle, at the same size. Every card is the same height and shape regardless of how much the admin
  typed, or the layout itself becomes a form of campaigning.
- **The whole card is the target**, not a small radio dot — 44 px minimum, and the selected state must
  be visible without relying on colour alone (border + check icon), for the same accessibility reason
  the rest of the portal follows.
- **Selection is capped at `MaxSelections`.** When the cap is reached, the remaining cards are
  disabled with a visible reason («حداکثر ۲ نفر») rather than silently ignoring the click.
- **Card order follows `SortOrder`** from the server and never shuffles between loads — a random or
  shifting order would change what voters see and could be argued to favour someone.
- RTL: use logical properties, and never mirror the avatar or the check icon.

## 10. Deployment

- New `election-web` service in `deploy/docker-compose.newserver.yml`, copying the `walfare-web`
  block. Add the origin to `Cors__AllowedOrigins__*` on `api` and `auth`.
- `election.myceo.ir` is under `myceo.ir`, which sits **behind the ArvanCloud CDN** — so it uses the
  CDN pattern, **not** `httpresolver`. (Contrast `task.kurdnezam.ir`, which points straight at the
  box and does use `httpresolver`.)
- **New secrets** in `deploy/prod.enc.env`: ballot master key, voter-roll pepper, Bale bot token,
  Bale `safir` access key.
- Adding this to the launcher means editing `AppSwitcher.tsx` and **rebuilding every SPA that
  embeds it** — otherwise the ones you skip serve a launcher without the election link.

## 11. Build order

| # | Step | Done when |
|---|---|---|
| 1 | `Elections`, `ElectionCandidates`, `ElectionEligibleReshtes` + migration | migration applies; an election exists in `CeoDb` |
| 2 | Admin CRUD + validation + freeze rule | a broken election is refused; a published one cannot be edited |
| 3 | Ballot crypto (`BallotSealer`, `VoterRoll`) + unit tests | seal/open round-trips; two casts by one person are rejected by the DB, not by code |
| 4 | Cast endpoint + eligibility + window enforcement, **and the §6 logging suppression** | ineligible/out-of-window casts refused; **no کد ملی in any log line** |
| 5 | Tally on read + results | counts exact against a seeded fixture |
| 6 | `election-web`: admin panel | an election can be created end to end |
| 7 | `election-web`: voter flow | a seeded engineer can vote once |
| 8 | Bale bot: `/start` → کد ملی → OTP (Bale + SMS) → vote, fresh OTP per cast | a bot vote and a web vote by the same person: the second is refused |
| 9 | Deploy: compose, Dockerfile, OIDC client, CORS, DNS, AppSwitcher everywhere | `https://election.myceo.ir` serves it |

## 12. Open questions

1. ~~The 4 unmappable disciplines~~ **Answered 2026-07-29: there is no صلاحیت column.** See §2.
   Those elections need a new org-DB field or an uploaded voter list. Out of v1.
5. ~~Must a voter be an ACTIVE member with a valid licence?~~ **Answered 2026-07-29: yes, require
   both.** See §14.
6. ~~Does «واحد» mean `ShobeName`?~~ **Answered 2026-07-29: no.** The title is free text and carries
   no meaning for the system. Eligibility is always set separately, as explicit `ReshteID` codes.
   `ShobeID` / `ShobeName` are **not** used.

### Worked example

«انتخاب هیئت رئیسه واحد گاز» is entered as:

| Field | Value |
|---|---|
| `Title` | `انتخاب هیئت رئیسه واحد گاز` — free text, never parsed |
| `EligibilityMode` | `ByReshte` |
| `ElectionEligibleReshtes` | one row: `ReshteCode = "4"` (مکانیک) |

So «واحد گاز» is a label for humans; the machine only ever compares `EngineerInfo.ReshteCode` to the
stored code set. Two consequences worth stating: the admin UI must make it obvious that **the title
does not restrict anyone** — only the discipline selection does — and a published election must show
its eligibility in words («ویژهٔ مهندسان رشتهٔ مکانیک») so a voter can see why they were included or
excluded.
2. ~~Turnout visibility~~ **Answered 2026-07-29: hide any row with fewer than 5 eligible voters.**
   Admins still see the total. See §13.
3. ~~Who may publish results~~ **Answered 2026-07-29: any `Administrator`.** No second approver, no
   named publisher. Publishing is therefore recorded in the append-only admin action log (§6, attack
   7) so it is at least attributable after the fact.
5b. **What value of `Vazeyat` / `VaziateOzv` means "active"?** Blocks §14 — see there.
4. ~~Retention~~ **Answered 2026-07-29: keep sealed ballots 30 days after close, then delete.**
   See §13.

---

## 13. Retention and turnout

### Sealed ballots: 30 days, then deleted

A sealed ballot is the only record that can be re-tallied — and the only thing an attacker holding
**both** secrets could ever open. Keeping it is proof; keeping it is also risk, and the risk grows
with time because keys leak, staff leave and backups get copied.

| Phase | What exists |
|---|---|
| Open → close | Sealed ballots + hashed roll |
| Close → +30 days | Same. A recount is possible. Disputes can be settled with evidence. |
| After +30 days | **Sealed ballots deleted.** Results and turnout counts kept forever. |

Rules:

- **The roll (`ElectionVoteReceipts`) is never deleted.** Those rows are keyed hashes, not names,
  and they carry no choice — so turnout stays provable forever, and the double-vote guarantee is not
  weakened by purging ballots.
- After the purge the result is **final and cannot be re-checked**. The admin UI must say so plainly
  before publishing, because it is not reversible.
- The purge runs as a scheduled job. Same trap as the task service: `PeriodicTimer(24h)` fires 24 h
  after the container starts, so it drifts with every deploy — compute the delay to a fixed local
  hour first, then start the timer.
- Deleting a ballot must never touch `Elections.ResultDigest`. That digest is what proves the
  published numbers came from the ballots that existed at close.

### Turnout: hide groups smaller than 5

The per-discipline breakdown is suppressed for any discipline with **fewer than 5 eligible voters**.

Without this, «۱ از ۱ رأی داد» in a small discipline is a plaintext roll entry — the pepper
bypassed by an aggregate, not by breaking any crypto. Suppress the **row**, not just the percentage:
showing "1 eligible, hidden" leaks the same fact.

The overall total is always shown. Admins see counts only, never who — the participation-by-کد-ملی
endpoint stays deleted (§6, attack 6).

---

## 14. Voter must be an active member with a valid licence

Three conditions, all checked live at cast time from the one
`IEngineerDirectory.GetByNationalCodeAsync` call. No extra query, no stored eligibility list.

| # | Condition | Field |
|---|---|---|
| 1 | The کد ملی is known to the org | the lookup returns non-null |
| 2 | Membership is **active** | `Vazeyat` / `VaziateOzv` |
| 3 | The پروانه has **not expired** | `TarikheEtebar` / `PrvExp` |
| 4 | Discipline matches, when `EligibilityMode = ByReshte` | `ReshteID` |

This is deliberately different from the پایه rule that was declined. That was about *seniority*.
This is about whether the person **is a member at all right now** — a suspended member, or one whose
licence lapsed years ago, is not someone whose vote would survive a challenge.

`EngineerInfo` must be widened to carry these fields. It currently maps 5 of ~50 columns; this adds
membership status, licence expiry and `MadrakNam`. Additive change, no existing caller breaks.

### ⚠ Two things must be pinned down before writing this check

**1. Which value means "active"?** The code dictionary covers `PayeT`, `IsHogh`, `TypDftr`, `Reshte`
and so on — but **not** `Vazeyat` or `VaziateOzv`. Without the code list this check cannot be
written: guessing "1 = active" could silently disenfranchise every eligible engineer, or silently
let suspended ones vote. Both are worse than not shipping the check.

Needed: the meaning of each value of `Vazeyat` and `VaziateOzv`, and which of the two is the
authoritative membership status. Also which of `TarikheEtebar` and `PrvExp` is the پروانه expiry —
there are two date fields and they may not agree.

**2. The expiry dates are Jalali strings.** The analytics model already documents `ExpDate` as
«تاریخ اعتبار پروانه، شمسی مانند 1405/05/01». So:

- **Never** put them through `new Date()` / `DateTime.Parse` — `1405/05/01` would be read as
  Gregorian year 1405. This trap is already in `GOTCHAS.md`.
- Compare **Jalali to Jalali**: convert today's date to Jalali once, then compare. Zero-padded
  `yyyy/MM/dd` strings also compare correctly with a plain ordinal string comparison, which avoids a
  conversion entirely — but only if every stored value really is zero-padded. Verify that against
  real rows before relying on it.
- A blank or unparseable expiry must **fail closed** for voting, and be reported to the admin — not
  silently treated as valid.

### Failure messages

A refused voter must be told **which** condition failed, in Persian, or they will simply think the
system is broken:

| Reason | Message |
|---|---|
| کد ملی unknown | «این کد ملی در سامانه نظام مهندسی یافت نشد» |
| Not active | «عضویت شما فعال نیست» |
| Licence expired | «اعتبار پروانهٔ شما به پایان رسیده است» |
| Wrong discipline | «این انتخابات ویژهٔ مهندسان رشتهٔ … است» |
| Already voted | «شما قبلاً در این انتخابات رأی داده‌اید» |

Note the first message: `GOTCHAS.md` records that this exact sentence was once shown for a **SQL
parameter bug**, not a real "not found". So on a lookup *error* (as opposed to a genuine miss), show
a distinct message and log it — never reuse the not-found wording for a failure.
