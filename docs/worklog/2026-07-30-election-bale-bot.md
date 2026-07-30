# Election service step 8: the Bale voting bot

- **Date:** 2026-07-30
- **Area:** election (bot + auth-free webhook + shared cast path)
- **Branch / commits:** `main` — uncommitted at time of writing; follows steps 6 and 7 the same day
- **Status:** in progress — criterion proven by tests; **never exercised against the real Bale API**

## Goal
"start step 8" — from the agreed build order: *Bale bot: `/start` → کد ملی → OTP (Bale + SMS) → vote,
fresh OTP per cast. Done when a bot vote and a web vote by the same person: the second is refused.*

## What changed

### One cast path, two channels
- `src/Application/Elections/BallotCasting.cs` — **new.** `IBallotCaster` now holds every cast rule
  (configuration guard, eligibility, candidate validation, the window re-check, the pepper pin, the
  duplicate handling). `CastVote.cs` and the bot both call it. Two copies of these rules would drift, and
  the one-vote guarantee is only as strong as its weakest channel.
- `src/Application/Elections/VoterQueries.cs` — same extraction for the ballot list: `IElectionBrowser`.
  `GetMyBallotsQueryHandler` is now a two-line delegate.

### The bot
- `Bale/HandleBaleUpdate.cs` — the conversation state machine: `/start` → کد ملی → identity OTP →
  election list → candidate toggles → «ثبت رأی» → **fresh** vote OTP → cast.
- `Bale/BaleUpdate.cs`, `Bale/BaleTexts.cs` — the bound payload and every Persian string.
- `Infrastructure/Elections/`: `BaleClient` (tapi.bale.ai), `BaleSafirSender` (push by phone),
  `VoteOtpSender` (both channels at once), `VoteOtpStore` (cooldown/caps/lockout), `BaleSessionStore`,
  `ElectionSmsSender`, `BaleOptions`.
- `src/Web/Endpoints/Elections/BaleWebhook.cs` — anonymous, path-guarded, always answers 200.

## Root cause — five defects, one of them critical

An adversarial review (5 lenses → 46 agents, 20 findings confirmed, 21 refuted) plus my own log reading
found these. **All were mine, introduced in this step.**

1. **CRITICAL — the OTP was delivered into the chat that asked for it.** `VoteOtpSender` sent the code as
   a Bale message to `chatId`. کد ملی is a *public* number in Iran, so anyone could open their own chat
   with the bot, type a member's کد ملی, read the code off their own screen, and cast that member's
   ballot. **Irreversible:** the roll's UNIQUE key then reports the real member as having already voted on
   both channels, and the sealed ballot is unlinkable, so the theft can neither be identified nor undone.
   My own comment in that file conceded the chat message "is not proof of anything" and accepted it
   anyway — that was the error. Fixed: the Bale channel is now **safir push addressed to the registered
   phone**, which is what the design specified; the in-chat send was an invention on top of it. The
   `chatId` parameter is **removed from `IVoteOtpSender`**, so the mistake is no longer representable.
2. **HIGH — every inline-button tap was silently dropped.** Bale sends snake_case (`callback_query`);
   minimal APIs bind camelCase. Without `[JsonPropertyName]` the text flow worked and the entire voting
   keyboard was dead — no error, no log line, 200 returned. The functional tests could not catch it
   because they build `BaleUpdate` records in C# and bypass deserialisation. Fixed with explicit names and
   `BaleWireContractTests`, which starts from bytes.
3. **HIGH — a remote kill switch.** `JalaliDate.NormalizeDigits` did `stackalloc char[value.Length]`, and
   the bot calls it on webhook message text. One anonymous POST with a megabyte of text asks for two
   megabytes of stack; `StackOverflowException` cannot be caught, so the API process dies and takes every
   other service with it, mid-election. Fixed with a heap path above 256 chars.
4. **HIGH — group chats were accepted.** Every member would read the OTP and share one identified
   session. Fixed: private chats only.
5. **HIGH — the OTP lockout was keyed on the person alone**, so anyone knowing a public کد ملی could burn
   five guesses and lock that member out of the bot for 30 minutes, repeatedly. Fixed: cooldown, attempts
   and lockout are all keyed on **(chat, voter)**; only the hourly send cap stays per person.

Also fixed: a candidate could be changed after the vote code was sent (so the cast would not be the
ballot the confirmation named); deselecting the last candidate destroyed the identified session; a
directory outage after identification read as «there is no election for you»; `ElectionBrowser` reported
`canVote` without checking the ballot sealer; three cooldown branches told the user to enter a code the
conversation was not waiting for; and `IHttpClientFactory`'s default logging printed the **bot token** in
the request URI on every send (found by reading my own logs — `.RemoveAllLoggers()`).

## Decisions
- **Conversation state is in memory, not a `BaleChatSession` table.** The design sketched the table; its
  own review then found it to be the second-worst finding ("every Bale voter identifiable with SQL read
  alone") and patched it to store only the `VoterHash`. But a hash cannot be reversed, and a cast needs
  the کد ملی to check eligibility and compute the roll hash — so the patched table could not work, and an
  unpatched one is a named voter list beside the ballots. In memory, **nothing about a voter's identity
  reaches disk** and no new secret is needed. Cost: a restart drops conversations in progress; no vote is
  lost. **If the API is ever scaled past one replica this becomes wrong, not just inefficient.**
- **`OtpPurpose` (Identity / Vote).** Independent cooldowns and counters, because the two requests sit
  back to back — sharing them refused the vote code for a minute and told the voter to enter a code that
  was never sent. Separating them at *verify* time matters more: an identity code must not cast a vote.
- **The API gets its own SMS sender** rather than sharing `src/Auth/Sms`. The IdP does not reference
  `src/Shared`, so sharing would mean adding a project reference to the live login host. It binds the
  **same `Sms:*` config section**, so production needs no new secret and no new deploy step. The Mihan
  SOAP envelope is duplicated — recorded in GOTCHAS; both copies must change together.
- **Never throws, always 200.** Bale re-delivers anything it gets no 200 for, and a replay would re-run
  the user's last step. Failures become chat messages.
- **The webhook path is not authentication** and is not treated as such — `getWebhookInfo` returns it and
  it appears in every proxy access log. A fresh OTP per cast is what protects a vote.
- Single-choice elections replace the pick rather than disabling every other button (same reasoning as
  the web ballot in step 7).

## Verification
- `dotnet test tests/Application.UnitTests` — **239 passed, 0 failed** (was 229).
- `dotnet test tests/Application.FunctionalTests --filter Bale` — **36 passed, 0 failed**, against a real
  SQL Server. The criterion and each fix above have a test:
  - bot vote → web vote by the same person: **refused**, 1 receipt, 1 ballot;
  - web vote → bot vote: refused, and the bot does not even offer the ballot;
  - Persian digits on the bot and Latin on the web are **the same person** (one receipt);
  - the OTP code **never appears in any message sent to the chat**, and goes to the org's phone;
  - a code issued for one chat cannot be redeemed in another;
  - a group chat is refused and no OTP is sent;
  - changing a candidate after the code was sent cancels it; the stale code casts nothing;
  - a lockout burned in an attacker's chat does not lock the real voter out;
  - a directory outage is never reported as «یافت نشد» or as «no elections»;
  - the vote code is single-use, so a re-delivered webhook cannot cast twice;
  - a button tap from an unidentified chat does nothing; `/start` forgets a previous identity.
- **Live webhook checks** against the running API: correct path → 200, wrong path → 404, prefix → 404,
  unconfigured bot → 404; a real snake_case `callback_query` payload → 200 **and `answerCallbackQuery`
  attempted** (proof the binding works — that log line did not exist before the fix); a `supergroup`
  payload → refused; **1 MB of Persian digits → 200 and the process survived**; no bot token in any log
  line after `.RemoveAllLoggers()`.
- Full functional suite: 66 passed, 3 failed — the same 3 pre-existing failures recorded in
  `2026-07-30-election-voter-flow.md`, unrelated to this work.

**safir corrected against the real contract (2026-07-30, later the same day).** Amir supplied the sample
from `business.bale.ai/dashboard/safir`. The first implementation, written without it, was wrong in three
ways at once — and every one of them fails **silently** (safir refuses, `ViaBale` comes back false, the
voter is told the code went by SMS, nothing looks broken):

| | first version (guessed) | real contract |
|---|---|---|
| `bot_id` | **absent** | required, and a **number** |
| body | `{"phone":…, "message":…}` | `{"phone_number":…, "message_data":{"message":{"text":…}}}` |
| phone | `9120000000` (zero stripped) | `989120000000` (country code, no `+`, no zero) |

Fixed, plus a new `Bale:SafirBotId` option and `SafirContractTests` (11 tests) pinning the body shape and
every written form of an Iranian mobile to one string.

**Still not verified — nothing has ever talked to the real Bale API.** There is no bot token on this
machine, so `BaleClient`, `BaleSafirSender` and the `setWebhook` registration are unexercised. Unproven:
- that a real safir call with a real key succeeds (the *shape* now matches the published sample, but only
  a live call proves the key, the bot id and the account state);
- that Bale renders `inline_keyboard` exactly as Telegram does;
- whether Bale sends a webhook secret header at all (support is optional and off by default).

Also not verified: the SMS channel end to end (dev uses `Provider=log`), and eligibility against the real
membership database (no `KurdNezamDb` connection here).

## Follow-ups
- **Before a real election, exercise the bot manually once** end to end with the real token. The two
  things most likely to be wrong are the safir payload and the keyboard rendering.
- **Step 9 — deploy.** New config into `deploy/prod.enc.env`: `Bale__BotToken`, `Bale__WebhookPath`,
  `Bale__WebhookSecret` (optional), `Bale__SafirAccessKey`, `Bale__SafirBotId`, plus the existing
  `Elections__VoterPepper` / `Elections__BallotMasterKey`. Values are on the safir dashboard for
  `@kurdnezambot`; none of them belongs in a tracked file. Register the webhook once:
  `curl -F url=https://api.myceo.ir/api/BaleWebhook/<path> https://tapi.bale.ai/bot<token>/setWebhook`.
- **Residual, accepted:** anyone who knows a member's کد ملی can cause SMS to that member's phone and
  consume their hourly code budget. That is inherent to "type your public ID and we text you" and the
  IdP's own engineer login has the same property; `MaxSendsPerHour` bounds the bill. Also, the bot is a
  membership oracle — any کد ملی can be tested for membership — bounded only by the rate limit.
- **Do not scale the API past one replica** without replacing `BaleSessionStore` (see Decisions).
- A `GET` on the webhook route returns 405, which reveals that the route group exists (not the path).
  Left alone; the group's existence is inferable from the endpoint naming convention anyway.
