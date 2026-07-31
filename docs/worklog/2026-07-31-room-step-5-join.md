# Room step 5: joining — member, guest, and the anonymous landing page

- **Date:** 2026-07-31
- **Area:** room
- **Branch / commits:** `main` — uncommitted at time of writing
- **Status:** built and tested; no browser has connected yet

## Goal

Step 5's success criterion:

> **each gate refuses for the right reason**

## What changed

- `src/Application/Rooms/RoomJoinRules.cs` — `JoinDenyReason`, one pure `Check(…)`, the Persian
  sentences, guest identities, and the display-name sanitizer.
- `src/Application/Rooms/RoomJoining.cs` — `IRoomJoiner`, the one implementation both entry points use.
- `src/Application/Rooms/RoomAttendeeQueries.cs` — the landing page, «جلسات من», and attendee detail.
- `src/Application/Rooms/RoomJoinCommands.cs` — join by link, join by id.
- `src/Web/Endpoints/Rooms/Room.cs` — `/api/Room`, with two anonymous routes.
- `tests/…/Rooms/RoomJoinRuleTests.cs` (35 unit) and `RoomJoinTests.cs` (24 functional).
- `tests/…/Infrastructure/EndpointNameTests.cs` — see the bug below.

## Decisions

- **One implementation of the gates.** A member opening a meeting from their list and a stranger
  opening a link both end in `RoomJoiner.JoinAsync`. Same decision as `IBallotCaster` on the election
  side: two entry points that each decide for themselves drift, and the drift is always one of them
  letting somebody in that the other refuses.
- **The gate order is part of the design, not an implementation detail.** Eligibility is decided
  *before* the countdown, so somebody who was never getting in is told that rather than made to wait
  for a clock that will not help them. «سرویس ویدیو در دسترس نیست» is checked **last**, because it is
  about us and not about them.
- **A deleted meeting and a link that never existed answer identically.** «این جلسه حذف شده» confirms
  to a stranger that their link was once real.
- **A meeting the caller may not attend is a 404, not a 403.** A 403 confirms the meeting exists, and
  walking the ids would then list everything the organisation is holding, one request at a time.
- **«باید وارد شوید» is a 401; every other refusal is a 400 carrying the Persian sentence.** A 401 is
  the one refusal the browser can fix by itself. It cannot be a 403 either way — the problem-details
  handler writes no `Detail` for one, so the reason would vanish.
- **One endpoint before and after signing in.** A private link is `POST /api/Room/j/{token}` with no
  token, which answers 401; the SPA signs the person in and calls *the same URL* again, which now mints
  a member token. Nothing to translate on the front end.
- **The presenter and an administrator are never gated by the join mode.** A presenter locked out of
  their own presentation is the one failure with no workaround. The presenter is also never turned away
  by a full room — an audience that filled the seats before the speaker arrived is a meeting that
  cannot happen.
- **A guest identity is minted fresh per join, never derived from the name.** The media server treats
  one identity as one person, so two guests called «رضا» sharing an identity would silently disconnect
  the first when the second arrived.
- **A signed-in person cannot rename themselves on the way in.** `typedName` is read only when nobody
  is signed in, so «مدیر سازمان» in the body does nothing to a member's display name.

## The bug that broke the whole API, and how it hid

Adding `GetRoom` to the new attendee group was legal C#, compiled clean, started up fine — and made
**every route in the API answer 500**, including `/api/Projects` and `/api/Dashboards`, which have
nothing to do with rooms.

`EndpointRouteBuilderExtensions` names each endpoint after its **handler method**, and ASP.NET Core
requires endpoint names to be unique across the whole application, not per route group. `RoomAdmin`
already had a `GetRoom`.

What made it worse is how it hid: every room test passed, because they go through MediatR and never
touch HTTP. The only tests that caught it were four unrelated JWT tests that happened to issue real
requests — and the failure they showed was a bare 500 on an endpoint nobody had edited.

Fixed by giving every room handler an area-flavoured name, which is what the rest of the codebase
already does (`GetKurdnezamNews`, `CreateWalfareService`). And pinned: `EndpointNameTests` reads the
real `EndpointDataSource` and fails with the colliding name printed.

## Two smaller things the tests found

**A display name could scramble the participant list for everyone.** A guest types their own name, and
U+202E RIGHT-TO-LEFT OVERRIDE reverses the rendering of everything after it. Escaping at render time
would not have been enough — the name is also sent to the media server and comes back to every other
client — so it is cleaned at the point it is accepted: bidi controls, isolates, zero-width spaces and
line breaks removed, runs of spacing collapsed, capped at 60 characters.

Two things that fell out of writing it:

- **The Persian half-space had to be spared.** U+200C is classified `Format`, exactly like the bidi
  overrides, so the obvious blanket strip respells «علی‌رضا» as «علیرضا» — visually close enough that
  nobody would ever report it.
- **Whitespace must be checked before controls.** A tab and a newline are `Control`, so stripping
  controls first deleted the gap between two words and welded them together: «رضا احمدی» pasted from a
  textarea became «رضااحمدی». Caught by a test case, not by reading.

## Verification

- **Unit: 326 passed** (+35). The gates are proven exhaustively there — every reason, both boundaries
  of the early-join grace, the order they fire in, and that no refusal message contains an ASCII letter
  (so no enum name can leak to a user).
- **Functional: 126 passed, 3 failed** — the same three pre-existing failures recorded in
  `2026-07-30-election-voter-flow.md`. The 24 new join tests all pass.
- **The token is decoded, not trusted.** The tests read the signed JWT payload and assert
  `"canPublish": false` for a guest and `true` for the presenter *in the same room, through the same
  link*. Asserting on the DTO alone would pass even if the two disagreed — and the media server obeys
  the token.
- **The audience token carries no admin grants** (`roomAdmin` absent), so a presenter's browser cannot
  be tricked into ending the meeting.
- **Two HTTP-level tests**, because this part does not exist in MediatR: the link routes really are
  reachable with no bearer token, and `MyRooms` really is still 401 without one. `AllowAnonymous`
  beating a group-level `RequireAuthorization` is a middleware decision no handler test can see.
- **A leak test on the serialised payloads**: the landing DTO, the attendee DTO and «جلسات من» are
  serialised and asserted to contain neither the join token, nor the slug, nor the presenter's کد ملی.
  Asserting property by property would miss a field added later.

**Not verified:** no browser has connected with one of these tokens. The audience restriction is proven
in the token's bytes but has still never been observed as a muted microphone in a real meeting — that
is step 8.

## Follow-ups

- Capacity is best effort. The head-count call is fail-soft and answers 0 when the media server is
  unreachable, so an outage lets people past the capacity gate. That is the right trade — the
  alternative locks everyone out of everything — but it is worth knowing before a large event.
- Nothing rate-limits the anonymous landing route. The token is 128 random bits so it cannot be
  guessed, but a flood would still reach the database. Worth a limiter before the first public webinar.
- Step 6 (`room-web`) needs a **presenter picker** that searches the membership directory. The API
  refuses anything that is not a real کد ملی, so a plain text box would only be a slow way to find that
  out.
