# The vote-SMS sender reported "sent" for every message while production silently dropped them

- **Date:** 2026-08-19
- **Area:** infra (elections API, shared `Sms` config with auth)
- **Branch / commits:** `feat/walfare-guesthouse` — `be24bf7`
- **Status:** built and tested locally, **not deployed**

## Goal

Fix a production SMS defect: `ElectionSmsSender` (`src/Infrastructure/Elections/ElectionSmsSender.cs`)
only implemented the `mihan` and `relay` providers and treated any other `Sms__Provider` value —
including production's `direct` — as "log only," which **returns `true`**. So every vote-code SMS
this class attempted in production was written to the log and reported as successfully sent, while
nothing was ever delivered.

## What changed

- `src/Infrastructure/Elections/ElectionSmsSender.cs`:
  - Added `SendDirectAsync`, implementing the `direct` (msgway) provider, mirroring
    `src/Auth/Sms/SmsDirectSender.cs`'s request shape (endpoint, headers, JSON payload) exactly.
  - Added `MsgwayBaseUrl`, `MsgwayApiKey`, `MsgwayProvider`, `MsgwayTemplateId` to
    `ElectionSmsOptions`, named identically to `src/Auth/Sms/SmsOptions.cs` — both hosts bind the
    same `Sms` configuration section, so the values already present in the environment bind with no
    deploy change.
  - Split the switch's fallback arm: `"log"` still returns `true` (deliberate dev-only behaviour,
    unchanged), any other unrecognised value now hits a new `UnknownProvider()` that logs an error
    naming the bad config value and returns `false`.
  - Updated the `Provider` XML doc comment, which still listed only `mihan`/`relay`/"anything else".

## Root cause

`_options.Provider.ToLowerInvariant()` switched on `"mihan"` / `"relay"` with a wildcard `_` arm
calling `LogOnly`, which is correct for the deliberate development value `"log"` but was also
silently absorbing every other value — including `"direct"`, which is what
`deploy/docker-compose.newserver.yml:79` actually feeds this class in production via
`SMS_PROVIDER=direct` in `deploy/.env`. The identity provider (`src/Auth`) already has a working
`direct` implementation against msgway; this class never did, and its catch-all made the gap
invisible — no error, no warning, just `true`.

A second, subtler trap was already recorded against msgway specifically
(`docs/worklog/2026-08-18-otp-invisible-character.md`): msgway answers **HTTP 200** even for a
per-number refusal and puts its real verdict in the response **body**. `SendDirectAsync` reads the
body and checks its `status` field (`IsMsgwaySuccess`) rather than trusting
`IsSuccessStatusCode` alone, so the same class of failure can't recur here.

## Decisions

- Duplicated the msgway request shape rather than sharing code with `src/Auth` — the existing class
  doc already explains why (`src/Auth` cannot be referenced from this host); this addition follows
  the same, already-accepted pattern as the Mihan/relay duplication.
- Kept `"log"` and the new `UnknownProvider()` as two separate arms rather than one, so a deliberate
  development value keeps returning `true` (matches a working channel for local testing) while any
  actual misconfiguration is loud and refuses to claim success.

## Verification

- `dotnet build src/Web/Web.csproj` — 0 errors (only pre-existing NuGet advisory warnings).
- `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj` — 491 passed, 0 failed
  (same count as before the change; 4 pre-existing skips unrelated to this file).
- Read the full diff: no secret, credential, or phone number appears in it — all new code reads
  from `_options.*`, values only, never literals.
- **Not verified:** a real send through msgway from this class (would need production's
  `Sms__MsgwayApiKey`/`Sms__MsgwayTemplateId` and a live phone). The IdP's own `direct` path is
  already proven live (see the 2026-08-18 worklog); this class mirrors it byte-for-byte in request
  shape, but has not itself been exercised against msgway.

## Follow-ups

- After deploy, confirm one real vote-SMS send in production and check the log line
  (`msgway send failed`/no matching success line vs none at all) to close the loop this fix opens.
- Full report with side-by-side option-name mapping:
  `.superpowers/sdd/sms-direct-report.md` (untracked, gitignored — local reference only).
