# Election service step 7: the voter flow

- **Date:** 2026-07-30
- **Area:** election (`election-web` + auth + application)
- **Branch / commits:** `main` — uncommitted at time of writing; follows step 6 on the same day
- **Status:** in progress — logic proven by 19 new functional tests; **voter UI not seen rendered**

## Goal
"start step 7" — from the agreed build order: *`election-web`: voter flow — done when a seeded
engineer can vote once.*

## What changed

### The way in (auth) — engineers had no door
An engineer account is created by `EngineerLogin` with **no password**, and `election-web`'s
unauthenticated authorize fell through to `/Account/Login`, a password form they can never satisfy.
The generic `/Account/Otp` page is worse: it keys on a **mobile number** and creates a user whose
username is that number, so the cast would refuse them («حساب کاربری شما برای رأی دادن معتبر نیست»)
— safe, but they still could not vote.

- `src/Auth/Auth/AuthorizationController.cs` — the hardcoded `walfare-web` check became an
  `EngineerLoginClients` map that now also carries `election-web`, passing a `service` hint.
- `src/Auth/Pages/Account/EngineerLogin.cshtml{,.cs}` — the page now takes `service`, so the heading
  reads «سامانه انتخابات» or «سامانه رفاهی مهندسین» instead of always the latter, and a newly
  provisioned account is granted **only that service** (it used to always get `walfare`, which would
  have handed every new election voter welfare access). The hint is matched against an allow-map, so a
  crafted query string cannot grant an arbitrary service key; an unknown value falls back to welfare.
- Added an **«ورود مدیران با نام کاربری و رمز عبور»** link. Administrators do have passwords and can
  land on this page when they open an engineer-facing app with no SSO cookie; without the link they
  were stuck on a form that cannot accept them. This also fixes the same dead end for `walfare-web`.
- `src/Auth/Data/ServiceKeys.cs` — added the `election` key to `All` (so an admin can grant it and the
  launcher can show its tile) but deliberately **not** to `ClientToKey`. See Decisions.

### The card that could not be read
- `src/Application/Common/ReshteNames.cs` — **new.** The canonical seven discipline codes → Persian
  names, in one place.
- `src/Application/Elections/VoterQueries.cs` — `BallotCandidateDto.ReshteLabelOrCode` was being filled
  with the **raw code** despite its name and its own comment. A voting card read «۴» where the voter
  expects «مکانیک». Now resolved through `ReshteNames`; an unknown code degrades to «رشتهٔ N».
- Same file — added `OpensAtUtc` / `ClosesAtUtc` to `BallotDto` so the client can count down without
  re-deriving a Jalali date plus the Iran offset.
- `src/Infrastructure/Analytics/Sql/KurdNezamSemanticModelStore.cs` — had its own private copy of the
  same seven-row table; now reads `ReshteNames`. Two copies of a lookup table drift.

### The voter front end (`election-web/`)
- `src/features/vote/CandidateCard.tsx` — **new.** Every rule from the design §9: initials in the same
  circle at the same size when there is no photo, three-line clamp behind «بیشتر», the whole card is
  the target, selection shown by border weight **and** a check icon, logical properties only, and the
  «بیشتر» toggle stops propagation so reading a biography is not a vote.
- `src/features/vote/BallotPage.tsx` — **new.** The ballot, an explicit confirm modal listing the chosen
  names, and a success screen. Selection lives in React state only.
- `src/features/vote/MyBallots.tsx` — **new.** The voter home: one card per published election showing
  the server's verdict, a countdown before the window, and the reason when voting is not possible.
- `src/features/vote/Countdown.tsx` — **new.** Ticks locally and calls `onElapsed` **once** to refetch;
  the server's `phase` decides whether voting is open, never the browser clock.
- `src/app/router.tsx` — restructured. Voter routes (`/`, `/vote/:id`, `/result/:id`) behind
  `RequireAuth` **only**; admin moved from `/elections*` to `/admin*` behind `RequireAdmin`.
- `src/layout/AppLayout.tsx` — «رأی‌گیری» first, «مدیریت انتخابات» only for admins.
- `src/lib/api.ts` — added `mediaUrl()`. Candidate photos are `/api/…` paths and this SPA is on a
  different origin, so without the prefix every photo 404s.
- `src/features/elections/ElectionResults.tsx` — shared by both audiences now, so "back" follows the
  route it was reached through and the "not counted yet" text differs for a voter and an admin.

### Tests
- `tests/Application.FunctionalTests/Elections/VoteFlowTests.cs` — **new, 19 tests.**
- `tests/Application.FunctionalTests/Infrastructure/FakeEngineerDirectory.cs` — **new.**
- `WebApiFactory` — now supplies `IUser.Name` (the کد ملی the vote path reads), the two `Elections:*`
  keys, and the fake directory. `TestApp` gained `RunAsEngineerAsync`, `AllAsync`, `MutateAsync`.
- `tests/Application.UnitTests/Elections/` — voter-side wire-contract tests and `ReshteNamesTests`.

## Root cause (two defects found while building)
1. **`ReshteLabelOrCode` returned the code.** `ElectionCandidate` stores only `ReshteCode`; there was
   no label to fall back to, so the "falling back to the code" comment described the only behaviour it
   ever had. Invisible from the C# side — the field is a `string?` and was never null.
2. **New engineer accounts were granted `walfare` regardless of where they signed in.** Provisioning is
   in the shared `EngineerLogin` page, which had welfare hardcoded. Adding the election entry point
   without touching it would have silently handed welfare access to every election voter.

## Decisions
- **`election` is grantable but never gating.** It is in `ServiceKeys.All` (grantable, shows a launcher
  tile) and deliberately absent from `ClientToKey` (never checked at authorize). Mapping it would refuse
  every engineer provisioned before this service existed — they all carry `["walfare"]` — and silently
  disenfranchise them. Eligibility is decided per election by the API from the org directory; a
  membership list in the IdP must not become a second, invisible voter roll.
- **Voter routes are not admin-gated.** One SPA, two audiences, per the design. An `Administrator`
  check in front of the ballot would disenfranchise every engineer.
- **Single-choice elections replace the selection instead of disabling every other card.** The design
  says to disable at the cap with a visible reason; that is right for multi-select, where a silently
  ignored click is the hazard. For `MaxSelections === 1` it would force a deselect-then-select dance on
  the commonest election shape. Replacing is not silent, so the intent holds. Multi-select still
  disables with «حداکثر N نفر».
- **The chosen ids never leave React state** — not the URL, not a query string, not `localStorage`. A
  vote in the address bar lands in browser history, in the next request's `Referer`, and in any proxy
  log; sealing the ballot server-side would be pointless.
- **The confirm modal stays open on failure** with the server's Persian reason. Closing it would look
  like the vote went through.
- **`canVote` / `alreadyVoted` come from the server on every load** (`staleTime: 0`) and a successful
  cast invalidates the query rather than patching the cache — so a refresh can never resurrect a ballot
  that was already cast.
- **The countdown never decides anything.** A wrong browser clock would either offer a ballot the API
  then refuses after the voter has chosen, or hide one that is genuinely open.
- **The window instants were added to the DTO** rather than converting Jalali on the client. A second
  implementation of `IranTime.ToInstant` in TypeScript would eventually disagree with the server about
  when voting closes.

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build` (7.9 s) — all clean.
- `dotnet build` on `src/Auth` and `src/Web` — 0 errors.
- `dotnet test tests/Application.UnitTests` — **229 passed, 0 failed** (was 219 before this step).
- `dotnet test tests/Application.FunctionalTests --filter VoteFlow` — **19 passed, 0 failed**, against a
  real SQL Server. These are the criterion:
  - a seeded engineer votes once → accepted, 1 receipt, 1 ballot;
  - **the same engineer voting again is refused and adds nothing** — different candidate, so the refusal
    comes from the roll's UNIQUE key, not from comparing choices;
  - a different engineer still votes → 2 receipts;
  - `canVote` / `alreadyVoted` flip together with the receipt;
  - a draft election is invisible to voters;
  - cards show «مکانیک»/«برق», and a candidate with no code shows no discipline row;
  - candidate order is the admin's order;
  - refused: wrong discipline, inactive membership, expired licence, unknown کد ملی, over
    `MaxSelections`, duplicate selection, a candidate from another election — each leaving 0 ballots;
  - a directory **outage** is never reported as «یافت نشد»;
  - the receipt holds only `(ElectionId, VoterHash)`; the same voter hashes differently per election;
  - two voters choosing the *same* candidate seal to *different* bytes — the ballot is encrypted, not
    encoded;
  - the tally counts what was cast, and a zero-vote candidate still appears.
- **Login routing, live:** `election-web` authorize → `302 /Account/EngineerLogin?…&service=election`;
  `walfare-web` → `…&service=walfare`; `admin-web` → `/Account/Login` (unchanged). The page renders
  «سامانه انتخابات», round-trips the `Service` hidden field, and shows the admin link with the correct
  `returnUrl`. `service=mabhas19` (not in the allow-map) falls back to welfare.
- SPA login screen renders and now says «با کد ملی و کد یک‌بار‌مصرف پیامکی وارد شوید».

**Not verified — the voter UI has not been seen rendered.** Reaching it needs a signed-in engineer,
which needs a کد ملی that exists in the organisation's membership database plus an SMS code. This dev
box has no `KurdNezam` connection string, and the assistant does not enter credentials. So the candidate
cards, the cap behaviour, the confirm modal and the countdown are verified as **logic and types**, not
as pixels. A human should sign in at `http://election.localhost:5276` once a directory connection and
`Elections:VoterPepper` / `Elections:BallotMasterKey` are configured locally (user-secrets on `src/Web`
— do not put them in a tracked file).

**Pre-existing failures, unrelated, not fixed:** `Application.FunctionalTests` has 3 —
`LegacyAudience_GetProjects_Returns200` (401 where 200 expected, though `mabhas19.api` is still in
`ValidAudiences`), `UserToken_AdminEndpoint_Returns403` (404 — `/api/Admin/users` now lives on the Auth
host, not the API), and `ShouldSaveAndReadBackAssessment` (`TotalScore` mismatch). Confirmed pre-existing
by re-running with my test-harness changes stashed and the new test files moved aside: identical failure.

## Follow-ups
- **Local dev cannot check eligibility.** No `KurdNezam` connection string and no `Elections:*` keys
  locally, so `MyBallots` reports the service unavailable. Configure both via
  `dotnet user-secrets --project src/Web` for a local run.
- **Step 8 — the Bale bot.** `ReshteNames` exists for it: the bot renders candidates as plain text and
  has no client-side lookup table. Do **not** add a voter identifier to `CastVoteCommand` for the bot's
  convenience — `The_cast_command_has_no_voter_identifier_property` fails if anyone tries.
- **Step 9 — deploy.** `AppSwitcher.tsx` still has no `election` tile; it is byte-identical in six SPAs,
  so adding it means rebuilding all six. Also needs the compose service, the CDN host pattern for
  `election.myceo.ir`, CORS on api + auth, and the two new secrets in `deploy/prod.enc.env`.
- The step-6 click-through (create an election through the admin form) is still unconfirmed for the same
  login reason; see `2026-07-30-election-admin-panel.md`.
