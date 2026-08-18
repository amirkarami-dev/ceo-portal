# An OTP copied out of an SMS could never be accepted

- **Date:** 2026-08-18
- **Area:** auth (IdP), reported against the welfare service
- **Branch / commits:** `main` — `ccb5b86`
- **Status:** **live** on auth.myceo.ir (image `f5a31e84`), verified after deploy

## Goal

Reported from production: one engineer (کد ملی 2850159816) could not sign in to
`refahi.kurdnezam.ir`. The SMS arrived, he entered the code, and the page always answered
«کد وارد شده اشتباه یا منقضی شده است». Every other engineer signed in normally.

## Root cause

**Copying a code out of a Persian SMS app brings an invisible right-to-left mark (U+200F) with it.**

`NormalizeDigits` converted Persian and Arabic numerals to Latin and let every other character
through; `Trim()` removes whitespace, and a bidi mark is not whitespace. So the browser posted six
characters where the store held five, and:

```csharp
CryptographicOperations.FixedTimeEquals(
    Encoding.UTF8.GetBytes(stored),      // "44655"  → 5 bytes
    Encoding.UTF8.GetBytes(code.Trim())) // "44655‏" → 8 bytes
```

`FixedTimeEquals` refuses arrays of different lengths **before** comparing content. A correct, fresh,
unexpired code was rejected, and nothing anywhere recorded why.

Only one person was affected because only that person pasted. Everyone else types.

The national-code field had the same trap, where it surfaced as «کد ملی باید ۱۰ رقم باشد».

## What changed

- `Pages/Account/EngineerLogin.cshtml.cs` — `NormalizeDigits` now keeps **only** digits. Also drops a
  `stackalloc` sized by caller input while in that method (a documented hazard in GOTCHAS).
- `Otp/OtpService.cs` — `VerifyAsync` now records *why* it refused, and reports the two **lengths**,
  never the codes. A length-only mismatch is this bug's signature.
- `Sms/SmsDirectSender.cs` — reads msgway's response **body**. It answers `200 OK` and puts its real
  verdict in the body, so a per-number rejection was previously invisible.
- `appsettings.json` — `Otp:TtlSeconds` set explicitly to **300**. It defaulted to 120, and this
  engineer's SMS took over a minute to arrive, leaving roughly 45 usable seconds.

## Decisions

- **Strip to digits rather than strip known bad characters.** An allow-list of "digits only" cannot be
  outgrown; a block-list of invisible characters would need extending the next time a keyboard invents
  one. Safe for both callers: the national code is validated as ten ASCII digits immediately after,
  and an OTP is digits by construction.
- **Log lengths, never codes.** `Otp:LogCode` exists for development and was switched on for exactly
  two attempts during this investigation, then off again. The permanent diagnostic must not depend on
  it, and must not print a credential.
- **Raise the TTL rather than shorten the SMS route.** 120 seconds is a reasonable number only if
  delivery is instant. It is not, on every Iranian route.

## Verification

Diagnosed by elimination against live data, not by reading the error text — which, as usual here,
pointed at the wrong thing («اشتباه یا منقضی» was neither):

| ruled out | evidence |
|---|---|
| Disabled/odd org record | `WebS_GetEngineerInfo`: وضعیت **فعال**, licence valid to 1406/11/15 |
| Stale or mismatched phone | Org `Mob` and `AspNetUsers.PhoneNumber` both `09183734273` |
| Locked account | `LockoutEnd` NULL, `AccessFailedCount` 0 |
| A second account clobbering the key | Only one of 765 accounts holds that number |
| Cooldown / hourly cap / attempt cap | `OtpService` logged nothing — those are its only messages |
| SMS not delivered, or msgway's own code | Delivered; five digits; our exact wording |
| The 120-second expiry | Failed even when sent once and answered inside the window |

**The decisive experiment:** the same code failed when pasted and succeeded when typed by hand.

After deploying, with a deliberately wrong code plus the mark, on production:

```
msgway accepted the send for 0918•••4273: {"status":"success","error":null,"referenceID":"…"}
OTP verify … failed: code did not match (stored 5 chars, supplied 5).
```

The browser sent six characters; the server received five. A national code carrying the mark now
reaches the code step instead of being refused.

**Not verified:** the affected engineer has not yet signed in himself since the fix. The mechanism is
proven on production, but his own successful login is still owed.

## Follow-ups

- **Ask the engineer to sign in the way he always did** — by copying the code — and confirm.
- **The same paste trap exists elsewhere.** `JalaliDate.NormalizeDigits` (used by elections' Bale bot,
  ballot casting and reshte codes) has the identical shape: it converts digits and passes everything
  else through. Nothing has reported a bug there, but the class of failure is the same.
- **This flow was unobservable, and that was most of the cost.** Two of the four changes above are
  diagnostics rather than fixes. Worth remembering for any other silent path.
