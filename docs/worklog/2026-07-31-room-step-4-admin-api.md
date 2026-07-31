# Room step 4: admin CRUD, join links, invites

- **Date:** 2026-07-31
- **Area:** room
- **Branch / commits:** `main` — uncommitted at time of writing
- **Status:** built and tested against the real database; no UI yet

## Goal

Step 4's success criterion, as written in the design and agreed with Amir:

> **a meeting can be created and its link copied**

## What changed

- `src/Application/Rooms/RoomRules.cs` — slug, join token, and the type/join-mode rules as Persian
  sentences that mirror the CHECK constraints one for one.
- `src/Application/Rooms/RoomAdminCommands.cs` — `RoomInput` + validator + mapper, and seven commands:
  create, update, regenerate link, activate, delete, invite, remove invite.
- `src/Application/Rooms/RoomAdminQueries.cs` — list and detail DTOs, plus `RoomLinkOptions`.
- `src/Web/Endpoints/Rooms/RoomAdmin.cs` — `/api/RoomAdmin`, Administrator at the group level.
- Migration `20260731124639_RelaxRoomJoinTokenCheckForDeleted`.
- `Rooms:PublicBaseUrl` in both appsettings files; `room.localhost:5277` added to dev CORS.
- Tests: `RoomAdminTests` (29, functional) and `RoomValidationKeyTests` (11, unit).

## Decisions

- **Admin and attendee are separate endpoint groups**, the same split the election service uses. The
  reason is a single field: the join link is the entire gate for a public presentation, so the DTO
  carrying it must not be reachable from any route an attendee can call. One group with a role check
  inside it is one forgotten `if` away from handing the key out.
- **The link is returned as a whole URL, not a token.** The base address is decided in one place — the
  server — so a link is identical whether it came from the admin panel, a script, or a request that
  arrived through the CDN with a rewritten host. The panel has nothing to assemble and nothing to get
  wrong.
- **The link is on the list row**, not one click deeper. Amir asked for that explicitly, and there is a
  test whose only job is to fail if the list DTO ever drops it.
- **Deactivating or deleting a meeting also ends the live room.** Leaving a call running after an admin
  switched it off looks exactly like the switch not working, and everyone inside stays inside.
- **Delete is soft, and the slug is never reused**, so an old join link can never land in a new meeting.
- **Invites and the presenter share one lookup path** (`RoomPeople`), because both identify a person
  the same way and both must fail the same way.

## Two bugs the tests found, and neither was visible in a passing build

### 1. A presenter could be given a free-text id, and would then join their own presentation muted

`RoomInput.PresenterUserId` started as an arbitrary string an admin could type. But the design fixes
the media identity of an authenticated join as the **کد ملی**, and `Room.MayPublish` compares the two
with `StringComparison.Ordinal`. Anything else stored there produces a presentation where the presenter
cannot speak, cannot share, and there is **no error anywhere** — the token is valid, the room is fine,
the microphone is simply not permitted.

Fixed by making the field a کد ملی: the format is checked, the person is looked up in the organisation's
record before the row is saved, and `PresenterName` is read from that record instead of being typed. So
a bad presenter fails at create time with a Persian sentence rather than at meeting time with silence.
Persian digits are normalised on the way in for the same reason — `۵۵۵۵۵۵۵۵۵۵` and `5555555555` would
compare unequal.

### 2. Deleting a meeting hit a CHECK constraint

`CK_Rooms_JoinTokenMatchesMode` said "invite-only ⇔ no join token". Deleting a link meeting drops the
token on purpose — that is what kills every copy of the link — leaving a link-mode row with no token,
which the database refused. It surfaced only because the functional tests run against real SQL Server.

The constraint now exempts deleted rows. The half that actually protects something is untouched:
invite-only can never hold a dangling secret, deleted or not. A tombstone with no link is the intended
end state.

## The trap worth remembering: nested validators rename every field

`RuleFor(x => x.Input).SetValidator(new RoomInputValidator())` is the obvious way to reuse one set of
rules across create and update. It also silently prefixes every error key with the parent property, so
the API answers `Input.JoinMode` to a form whose field is `joinMode`.

Nothing about that fails. The request is rejected, the message is correct, the status code is right —
the admin panel just shows "something is wrong" with **no field highlighted**, on every validation
error, forever. Fixed with `.OverridePropertyName(string.Empty)` and pinned by `RoomValidationKeyTests`,
which asserts no key ever contains a dot.

## Verification

- **Unit: 291 passed** (+11). The new ones pin the error-key contract and the slug/token shapes.
- **Functional: 101 passed, 3 failed** — the same three pre-existing failures recorded in
  `2026-07-30-election-voter-flow.md`. The 29 new room tests all pass.
- **Against the real database**, all four CHECK constraints were exercised through the real pipeline:
  each invalid shape comes back as a Persian sentence under a flat field key, and none of them leaves
  a row behind.
- Authorisation is tested from the other side too: a signed-in engineer gets `ForbiddenAccessException`
  from both the list and create, so no non-admin can reach a join link.

**Not verified:** no UI exists yet, so nobody has clicked "create" or copied a link from a screen. No
token has been minted from one of these rows either — that is step 5.

## Follow-ups

- Step 5: the join endpoints. The presenter identity work above is what makes `MayPublish` meaningful
  there, and it is the first place a real browser will connect.
- The admin panel needs a **presenter picker** that searches the membership directory, not a text box —
  the API now refuses anything that is not a real کد ملی, and a raw text box would just be a way to
  discover that slowly.
- `Rooms:PublicBaseUrl` must be set on the server at deploy time (step 10). If it is missing, every
  join link comes back **null** rather than wrong — deliberate, but it will look like the feature is
  broken rather than unconfigured.
