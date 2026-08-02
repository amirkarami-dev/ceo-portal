# GOTCHAS — traps that already cost hours

Every entry here was a real bug in this repo. Each one **looked like something else**.
Read this before debugging anything that "should work".

> Adding one? Format: symptom → real cause → fix → where. Put a short comment at the code site too.

---

## Rule zero: the error message is not evidence

Three separate bugs in this project reported the wrong cause:

- a bank **decline** was shown as «ارتباط با درگاه پرداخت برقرار نشد» (no connection),
- a **SQL parameter** bug was shown as «این کد ملی یافت نشد» (national code not found),
- a **contract mismatch** was shown as a bare "One or more validation errors occurred".

Always confirm against the **server log** or the **database row** before changing code.

---

## Back end (.NET)

### `ReadAsync` to check for a second row destroys the first one
**Symptom:** every engineer on the platform was told «این حساب، حساب مهندس نیست» — welfare booking,
and the same lookup underneath voting and the room presenter picker. The org database was healthy and
the person **was** a member.
**Cause:** the directory read `CodeMeli` from row 1, then called `ReadAsync` to refuse a multi-row
answer. For the normal single-row case that returns `false` — and leaves the reader **positioned past
the end**. Every later field (`Vazeyat`, `Nam`, `ReshteID`, `Mob`, `PrvExp`…) threw
`InvalidOperationException: Invalid attempt to read when no data is present`, the catch reported
`Unavailable`, and `GetByNationalCodeAsync` flattens `Unavailable` to `null`.
**Fix:** capture **every** field from the row before advancing. Read first, advance second.
**Two things made a reader slip into a lie about a person's membership:**
1. `GetByNationalCodeAsync` collapses NotFound / Unavailable / integrity-failure into one `null`. Any
   caller that renders `null` as "you are not a member" is making a claim it cannot support. Prefer
   `LookupAsync` and handle `Unavailable` separately — the election cast path already did.
2. Nothing tested the real reader; the functional tests all use `FakeEngineerDirectory`.
**Pinned by:** `tests/Application.UnitTests/External/KurdNezamRowMappingTests.cs`, which maps a
one-row and a two-row `DataTable.CreateDataReader()` — a real `DbDataReader` that throws on
read-past-end exactly like SQL Server, so no fake is needed.
**Shipped broken in** `d02e88a` (2026-07-30) and live for about a day.

### The engineer's رشته is NOT in `WebS_GetEngineerInfo`
**Symptom:** none yet — a discipline-restricted election would simply have refused every voter.
**Cause:** the procedure returns two رشته-ish columns and **neither is the discipline code**.
A live row carries `ReshteID = 3000` and `Reshte = 3` beside `ReshteNam = عمران-عمران`; matching an
election's «۴ = مکانیک» against either is wrong.
**The real path is a join:**
```
WebS_GetEngineerInfo.CodeOzveyat  →  tblDW_OzviatInfo.Ozviat  →  Reshte      (1 معماری … 7 ترافیک)
```
`tblDW_OzviatInfo` is the same table the analytics semantic model reads (`oz_info`), and its `Reshte`
is the dictionary-coded column — so analytics has been right about this all along; only the engineer
directory was not.
**Implementation note:** two commands on one connection means the **reader must be closed first** —
without MARS a second command on an open reader fails outright.
**Data note:** 6,938 members, no null `Reshte`, but **six carry `Reshte = 8`**, which is not in the
seven-code dictionary and has no option in the admin picker.

### `new SqlParameter("@Code", 0)` silently sends NO value
**Symptom:** every engineer lookup failed → «این کد ملی در سامانه نظام مهندسی یافت نشد».
**Cause:** the literal `0` binds to `SqlParameter(string, SqlDbType)`, not `(string, object)`.
The parameter is created with a *type* and no *value*, so SQL Server answers
*"expects parameter '@Code', which was not supplied"* — which our catch turned into "not found".
**Fix:** `new SqlParameter("@Code", SqlDbType.Int) { Value = 0 }`.
**Where:** `src/Auth/External/KurdNezamDirectory.cs`, `src/Infrastructure/External/KurdNezamEngineerDirectory.cs`.
Note: `WebS_GetEngineerInfo` needs `@Code = 0` (not null) to search by national code.

### `ProblemDetails` written through the generic overload loses `errors`
**Symptom:** every 400 across the whole API arrived as `{type,title,status}`; no field messages,
so users saw a generic English sentence instead of the Persian reason.
**Cause:** the handler builds a `ValidationProblemDetails` but the tuple types it as the
`ProblemDetails` base; `WriteAsJsonAsync<T>` serializes the **declared** type.
**Fix:** serialize by runtime type — `WriteAsJsonAsync(pd, pd.GetType(), …)`.
**Where:** `src/Web/Infrastructure/ProblemDetailsExceptionHandler.cs`.

### Two endpoint handlers with the same method name make the WHOLE API return 500
**Symptom:** every route answers 500 — including endpoints nobody touched. `/api/Projects` and
`/api/Dashboards` broke because a *room* endpoint was added.
**Cause:** `EndpointRouteBuilderExtensions` calls `.WithName(handler.Method.Name)`, and ASP.NET Core
requires endpoint names to be unique across the **whole application**, not per route group. `RoomAdmin`
and `Room` both had a handler called `GetRoom`. Legal C#, compiles clean, starts up fine.
**How it hides:** handler tests go through MediatR and never touch HTTP, so every test for the new
feature stays green. Only a test that issues a real request sees it, and what it sees is a bare 500 on
an unrelated endpoint.
**Fix:** prefix every handler with its area — `GetRoomAdmin`, `GetKurdnezamNews`,
`CreateWalfareService`. The rest of the codebase already does this; it is not style.
**Pinned by:** `tests/Application.FunctionalTests/Infrastructure/EndpointNameTests.cs`, which reads the
real `EndpointDataSource` and prints the colliding name.

### Stripping "invisible" characters mangles Persian, and strips word gaps
Two traps in one small function (`RoomJoinRules.SanitizeDisplayName`), both silent:
1. **U+200C (نیم‌فاصله) is `UnicodeCategory.Format`** — the same category as the bidi overrides you
   actually want gone. A blanket strip respells «علی‌رضا» as «علیرضا»: visually close enough that
   nobody reports it. Spare U+200C and U+200D by code point.
2. **Tab and newline are `Control`, not whitespace-first.** Strip controls before collapsing
   whitespace and «رضا احمدی» pasted from a textarea becomes «رضااحمدی» — the gap is deleted rather
   than turned into a space. Check `Rune.IsWhiteSpace` **first**, then strip.

Why sanitize at all: a name typed by a guest is sent to the media server and echoed to every other
client, so escaping at render time is too late. U+202E alone lets one guest reverse the rendering of
the whole participant list for everybody.

### ArvanCloud serves a 404 for a minute after an origin container restarts
**Symptom:** immediately after `docker compose up -d` recreated the SPA containers,
`https://election.myceo.ir` and `https://refahi.kurdnezam.ir` — live all day — returned **404**
through the CDN. Both recovered on their own within a couple of minutes.
**Not the cause:** Traefik labels, the `traefik` network, container health, nginx. All were correct
and 200 at the origin the entire time.
**Diagnose from the origin before changing anything:**
```
curl -k --resolve HOST:443:185.206.94.116 https://HOST/   # what Traefik really serves
curl -k -H 'Host: HOST' https://127.0.0.1/                # same, one layer lower
```
200 there and 404 publicly = the CDN. Wait; do not "fix" a correct label.
Also seen on a brand-new host: `room.myceo.ir` 404'd for a few minutes after first deploy while the
origin already served the SPA.

### Traefik on the production box cannot issue ANY new certificate
**Symptom:** the Traefik log is a wall of
`Unable to obtain ACME certificate … arvancloud: failed to add TXT record … 403
{"status": false, "message": "Your access to this section is restricted."}` — for every domain, not
just a new one.
**Cause:** the ArvanCloud DNS API token used for the DNS-01 challenge has lost permission.
**Why nothing looks broken:** ArvanCloud terminates public TLS and the origin only ever serves
Traefik's self-signed default cert. `openssl s_client -servername api.myceo.ir` shows
`CN = TRAEFIK DEFAULT CERT` on hosts that work perfectly.
**Why it matters:** the CDN is load-bearing for TLS on **every** host. Taking any domain off the
proxy (grey cloud) leaves browsers facing a self-signed certificate. Renew the token before doing
that, or before a cert genuinely needs issuing.

### Docker Hub blob fetches 403 from this network
**Symptom:** `docker pull livekit/livekit-server:v1.13.3` → `unknown: failed to copy: httpReadSeeker:
failed open: unexpected status from GET request to https://production.cloudfront.docker.com/... :
403 Forbidden`. The manifest resolves; only the layer blob is refused.
**Cause:** same class of network restriction already recorded for NuGet — the CDN, not Docker.
**Fix that works:** the servers can pull. Lift an image the VPS already runs:
```
plink … "docker save livekit/livekit-server:v1.13.3 | gzip -1 > /tmp/lk.tgz"
pscp  … amirserver@185.182.220.182:/tmp/lk.tgz .   &&   docker load -i lk.tgz
```
36 MB, about four seconds. No secret is involved, so this is safe for any image the production hosts
already have.

### A local LiveKit needs `--node-ip`, or it connects and then never starts
**Symptom:** signalling succeeds — the token is accepted, the participant appears, the control bar
renders — and then `ConnectionError: could not establish pc connection`. The pair of symptoms is
confusing: authentication clearly worked, so the token looks fine, and the failure looks like a bug in
the app.
**Cause:** the container advertises its **Docker-internal** address (`172.17.0.3`) as the ICE
candidate. The browser on the host cannot route to it.
**Fix:** `--node-ip 127.0.0.1` on the dev server, and publish 7881/tcp + 7882/udp.
**Full local command** (uses LiveKit's published placeholder pair `devkey`/`secret` — a documented
constant, never the production key):
```
docker run -d --name ceo-livekit-local -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server:v1.13.3 --dev --bind 0.0.0.0 --node-ip 127.0.0.1
```
Related: the **production** server needed `udp_port` rather than a one-port range — see the step 1–2
worklog for that one.

### framer-motion `AnimatePresence` leaks nodes in a background tab
**Symptom:** a countdown that ticks once a second accumulated every past digit in the DOM — ۵۳, ۵۱,
۵۰, ۴۹ … all still rendered, stacked in one tile.
**Cause:** an `exit` animation must run to completion before the element is removed, and it is driven
by `requestAnimationFrame`, which browsers pause for a tab that is not visible. No frames means no
exit means no removal — one orphaned node per second, for as long as the tab stays in the background.
**Fix:** for a value that changes on a timer, animate the **arrival only**: a keyed `motion.span` with
`initial`/`animate` and **no** `AnimatePresence`. Changing the key replaces the node outright, so
there is no exit lifecycle to stall.
**Where:** `room-web/src/features/join/Countdown.tsx`. It matters there because that page is designed
to sit open for twenty minutes while somebody waits for a webinar — the background tab is the normal
case, not the edge case.

### `navigator.clipboard` does not exist on plain http
**Symptom:** the copy button on the meeting row threw, in dev only.
**Cause:** the Clipboard API is gated on a **secure context**. `https://` and `http://localhost` count;
`http://room.localhost:5277` — which is how every SPA in this repo is reached in dev — does **not**.
**Fix:** try `navigator.clipboard` inside `window.isSecureContext`, then fall back to a hidden
`<textarea>` + `document.execCommand("copy")`.
**Where:** `room-web/src/features/rooms/RoomsList.tsx`. Applies to any copy button in any of the SPAs.

### A nested FluentValidation validator renames every field it reports
**Symptom:** nothing. The request is rejected, the Persian message is right, the status code is right —
the form just highlights **no field at all**, on every validation error.
**Cause:** `RuleFor(x => x.Input).SetValidator(new XInputValidator())` is the obvious way to share one
set of rules between a create and an update command. FluentValidation prefixes every child key with the
parent property, so the API answers `Input.JoinMode` to a form whose field is `joinMode`.
**Fix:** `.SetValidator(…).OverridePropertyName(string.Empty)` — an empty parent name is dropped from the
chain, so the keys stay flat. Then assert it: a test that no error key contains a `.` is the only thing
that will notice this coming back.
**Where:** `src/Application/Rooms/RoomAdminCommands.cs`, pinned by
`tests/Application.UnitTests/Rooms/RoomValidationKeyTests.cs`.
**Applies to** any command that wraps a shared input record — the election commands are flat and so
never hit it.

### A CHECK constraint that describes a live row will refuse a soft delete
**Symptom:** `DELETE` on a meeting threw `DbUpdateException` → *conflicted with the CHECK constraint
"CK_Rooms_JoinTokenMatchesMode"*. Create, update and every validator were fine.
**Cause:** the constraint said "a link-joined meeting **has** a link". Soft-deleting one drops the token
on purpose — that is what kills every copy of the link — which leaves a link-mode row with no token.
**Fix:** exempt the tombstone, not the rule: `… OR [IsDeleted] = 1`. The protective half — invite-only
may never hold a dangling secret — stays absolute.
**Lesson:** a constraint states an invariant of a **live** row. Soft delete creates rows that were never
in that state, and only a test against real SQL Server will show it. An in-memory provider ignores CHECK
constraints entirely.
**Where:** `src/Infrastructure/Data/Configurations/Rooms/RoomConfigurations.cs`, migration
`20260731124639_RelaxRoomJoinTokenCheckForDeleted`.

### `System.Text.Json` is strict where Newtonsoft was forgiving
**Symptom:** the payment gateway "could not be reached" although it had answered.
**Cause:** Iran Kish sends `status` as a **number**; the DTO declared `bool`. The legacy client
used Newtonsoft (coerces `1`→`true`); this port uses STJ, which throws.
**Fix:** a lenient converter (bool / number / quoted), and handle a parse failure separately so a
real reply is never reported as a connection error.
**Where:** `src/Infrastructure/Payments/IranKishGateway.cs`.

---

## Iran Kish payment gateway

### Approval code is `"00"`, not `"0"`
**Symptom:** a card was charged (RRN, STAN and masked PAN all returned) but the row said
*failed*, verify never ran, and the bank kept the transaction as «موفق تایید نشده» — which it
then auto-reverses.
**Fix:** compare numerically (`0` / `00` / `000` all mean approved).
**Where:** `HandleIrkCallbackCommand` in `src/Application/Walfare/Payments/Payments.cs`.

### `additionalParameters` must NOT be sent
**Symptom:** token request → HTTP 400 from the gateway.
**Cause:** their deserializer cannot read a `KeyValuePair` entry in any casing. Proven live:
sending the entry (either casing) → 400; omitted / null / empty array → 200 + token.
The legacy client only ever put an **empty** `nationalId` there, so nothing is lost.

### The payment page takes the token as a QUERY parameter
`…/iuiv3/IPG/Index?token=<t>` works; `…/IPG/Index/<t>` (path segment) does not.

### Always persist RRN + STAN on the callback
Save them **before** deciding success, or a later manual verify has nothing to work with.
Keep the masked PAN too — it is useful even on an unverified row.

---

## Front end

### A report summary without its definition renders several unrelated blanks
**Symptom:** report names/models/tags and Add Widget rows were blank, while the owner column
showed a GUID.
**Cause:** `GET /api/Reports` omitted `DefinitionJson`; the SPA hid the contract gap by casting
`{}` to `ReportDefinition`. Separately, `OwnerName` stores the OIDC subject ID, not a display name.
**Fix:** return and deserialize the complete definition, retain the stored report name as a legacy
fallback, and format subject IDs as the current user's name or a neutral organization-user label.
**Where:** `GetReportsQuery`, `analytics-web/src/api/reportsHttpApi.ts`, `report-display.ts`.

### A primitive save response can silently produce an `undefined` route
**Symptom:** creating an analytics dashboard navigated to `/dashboards/undefined/edit`, then
showed a 404 even though the database insert succeeded.
**Cause:** `POST /api/Dashboards` serialized a bare integer, while the SPA read `response.id`.
The mock test returned `{ id }`, so it tested the desired client contract rather than production.
**Fix:** return an object-shaped `SaveDashboardResponse` from the Web endpoint, normalize its
numeric ID in the HTTP adapter, and keep a production-shaped adapter/endpoint test.
**Where:** `src/Web/Endpoints/Analytics/Dashboards.cs`, `analytics-web/src/api/dashboardsHttpApi.ts`.

### A desktop sider must leave the flex row on phones
**Symptom:** at 390px the analytics dashboard card collapsed to 34px and the page overflowed
horizontally, even though the card grid itself was responsive.
**Cause:** the fixed-width 240px `Sider` remained a sibling of the main layout at every width.
**Fix:** below AntD's `md` breakpoint render navigation in a Drawer, compact the Topbar, and
remove the Sider from the flex row entirely. Also set `min-width: 0` on the main flex Layout;
otherwise a wide table expands that child and pushes the mobile menu trigger off-screen.
**Where:** `analytics-web/src/layout/AppLayout.tsx`, `Topbar.tsx`, `Sidebar.tsx`.

### `process is not defined` breaks react-grid-layout dragging
**Symptom:** dashboard widgets would not drag or resize; no console error.
**Cause:** `react-draggable` reads `process.env` at drag time; the browser has no `process`,
so the drag-start handler threw and the drag never engaged.
**Fix:** shim `globalThis.process = { env: {} }` at the app entry (+ Vite `define`).
**Where:** `analytics-web/src/main.tsx`, `analytics-web/vite.config.ts`.

### AntD `Col` breakpoints measure the WINDOW, not the column
**Symptom:** a card squeezed to ~250px wide and the Persian title broke one letter per line.
**Cause:** a 232px sider took space the grid did not know about, so `sm={12}` halved an already
narrow column.
**Fix:** stay full width until `md`; only split on genuinely wide screens. And below `md`, turn
the sider into a `Drawer`.
**Where:** `walfare-web/src/layout/AppLayout.tsx`, `walfare-web/src/pages/ServicesPage.tsx`.

### AntD tables crush on phones unless told to scroll
Default `CrudTable` now sets `scroll={{ x: "max-content" }}`. Keep it.

### A mutation that throws does not refresh the list
`useApiMutation` invalidates queries **on success only**. If an endpoint reports a business
outcome by throwing, the table keeps stale data until a manual reload. Prefer returning the
updated row and letting the caller pick the message from its status.
**Where:** the admin «تأیید» action in `walfare-web/src/pages/admin/AdminPaymentsPage.tsx`.

### `IHttpClientFactory` logs the request URI — so a token in the path lands in the log
`AddHttpClient` wires up default logging that prints `POST https://host/path` at Information level.
Bale's API puts the **bot token in the path** (`tapi.bale.ai/bot{token}/sendMessage`), so every send
wrote the token into the application log, which is less protected than the database. Anyone with the
log can then read every update and post as the bot. Fix: `.RemoveAllLoggers()` on that client.
Check any new typed client whose URL carries a credential.
**Where:** `src/Infrastructure/DependencyInjection.cs`, `src/Infrastructure/Elections/BaleClient.cs`.

### `stackalloc` sized by caller input is a remote kill switch
`JalaliDate.NormalizeDigits` did `stackalloc char[value.Length]`. It is called on attacker-controlled
text (a Bale message arrives through an anonymous webhook), so one POST with a megabyte of text asks
for two megabytes of stack. **`StackOverflowException` cannot be caught** — the whole process dies,
taking every other service on that host with it. Anything reachable from unauthenticated input must
heap-allocate above a small threshold.
**Where:** `src/Application/Common/JalaliDate.cs`; pinned by `NormalizeDigitsSafetyTests`.

### An OTP delivered to the channel that asked for it is not a second factor
The Bale bot briefly sent the vote code as a message **into the chat that had just typed the کد ملی**.
Since کد ملی is public in Iran, anyone could open their own chat, type a member's number, read the code
off their own screen and cast that member's ballot — and the roll's UNIQUE key then made it permanent,
so the real member could never vote and the theft was unlinkable. **Both OTP channels must be bound to
the mobile the organisation has on record** (SMS, and Bale's `safir` push *by phone number*).
The fix removed the `chatId` parameter from `IVoteOtpSender` so the mistake cannot be re-expressed.
**Where:** `src/Infrastructure/Elections/VoteOtpSender.cs`.

### Bale/Telegram payloads are snake_case; minimal APIs bind camelCase
No `[JsonPropertyName]` meant `callback_query` did not bind, so **every inline-button tap was silently
dropped**: the text flow worked, the bot returned 200, and the voting keyboard was simply dead. Tests
that construct the DTOs in C# cannot catch this — only one that deserialises real bytes can.
**Where:** `src/Application/Elections/Bale/BaleUpdate.cs`; pinned by `BaleWireContractTests`.

### Rate-limit keys built on a public identifier become weapons
کد ملی is public, so an OTP cooldown or lockout keyed on the *person* lets anyone lock a chosen voter
out by burning that person's budget from their own chat. Key cooldown, attempts and lockout on
**(chat, voter)**; keep only the volume cap per person, since that is what bounds the SMS bill.
**Where:** `src/Infrastructure/Elections/VoteOtpStore.cs`.

### Engineer accounts have no password, so the default login page is a dead end for them
`EngineerLogin` creates them with `userManager.CreateAsync(user)` and no password. A client whose
unauthenticated authorize falls through to `/Account/Login` shows those users a form they can never
satisfy. `/Account/Otp` is not the answer either: it keys on a **mobile number** and creates a user
whose username is that number — for voting the username must be the کد ملی, so the cast refuses.
Any new engineer-facing client must be added to `EngineerLoginClients` in `AuthorizationController`.
**Where:** `src/Auth/Auth/AuthorizationController.cs`, `src/Auth/Pages/Account/EngineerLogin.cshtml.cs`.

### `EngineerLogin` provisioning grants exactly one service — pass the right one
A fresh account gets a **non-empty** grant list on purpose (empty means "all services" under the
grandfather rule). It used to hardcode `walfare`, so any second engineer-facing app would silently hand
its users welfare access. The page now takes a `service` hint, matched against an allow-map so a crafted
query string cannot grant an arbitrary key.
**Where:** `src/Auth/Pages/Account/EngineerLogin.cshtml.cs`.

### A service key in `ServiceKeys.All` is not the same as one in `ClientToKey`
`All` makes a service **grantable** (admin UI, launcher tiles). `ClientToKey` makes it **gating** at
authorize. Adding `election-web` to `ClientToKey` would refuse every engineer provisioned before the
election service existed, because they all carry `["walfare"]` — a silent disenfranchisement, at the IdP,
of people the API considers eligible. Grantable-but-not-gating is deliberate; keep it.
**Where:** `src/Auth/Data/ServiceKeys.cs`.

### A DTO field named `…Label` can still be carrying the raw code
`BallotCandidateDto.ReshteLabelOrCode` was filled with `c.ReshteCode` — `ElectionCandidate` stores only
the code, so there was never a label to fall back to. The field is `string?` and never null, so nothing
failed; the voting card just read «۴» instead of «مکانیک». Resolve through `Application.Common.ReshteNames`,
which is the single source of truth for the seven codes (the Bale bot needs it too, and has no
client-side table).
**Where:** `src/Application/Common/ReshteNames.cs`, `src/Application/Elections/VoterQueries.cs`.

### API enums are NUMBERS on the wire, and typing them as strings fails silently
No host registers a `JsonStringEnumConverter`, so `ElectionStatus.Draft` is `0`, never `"Draft"`.
A TypeScript string union (`"Draft" | "Published"`) compiles and lints clean, then every
comparison is simply `false` at runtime — no error, no console warning, just a publish button
that never appears. Mirror the C# enum as a const object plus a `typeof` union.
The reverse direction is worse: if a converter is ever added, a numeric mismatch could bind to
the enum's `0` member and, for eligibility, open a restricted election to everybody.
**Where:** `election-web/src/lib/types.ts` and `walfare-web/src/api/walfareApi.ts`;
pinned by `tests/Application.UnitTests/Elections/ElectionWireContractTests.cs`, which fails if a
string-enum converter appears.

### `TimeOnly` on the wire is `"HH:mm:ss"`, but the picker gives `"HH:mm"`
`TimeOnly` **serialises** as `"08:00:00"` and **accepts** either form, so a client that slices
five characters to display and posts them back unchanged works right up until something does a
round trip. Widen on the way out, slice on the way in.
**Where:** `toWireTime`/`fromWireTime` in `election-web/src/lib/types.ts`.

### `export const X` + `export type X` trips ESLint's `no-redeclare`
This is the repo's numeric-enum pattern and it is legal TypeScript, but both `no-redeclare` and
`@typescript-eslint/no-redeclare` flag it (the TS-aware one only exempts interface/namespace
merging). Turn the rule off; `tsc` still catches a genuine duplicate as "Duplicate identifier".
`walfare-web` currently **fails `npm run lint`** for this reason — its Docker build is unaffected
because `npm run build` runs `typecheck`, not `lint`.
**Where:** `election-web/eslint.config.js` has the fix.

### Jalali pickers: don't load a second `jalaliday`
`antd-jalali` extends dayjs itself. A second copy double-patches the prototype and breaks the
picker. Also **never call `d.calendar("jalali")` on a picker value** — `dayjs/plugin/calendar`
overrides that method and returns a string. Format directly.
**Where:** `walfare-web/src/components/ui/JalaliFields.tsx`.

### Dates from the organisation DB are already Jalali strings
`"1405/03/16"` must pass through untouched — never through `new Date()`, which would read it as
Gregorian year 1405. Only convert values that are actually Gregorian.
**Where:** `analytics-web/src/presentation/format.ts`.

### A Bale bot token is `<bot_id>:<secret>`; the safir key is a separate 16-char string
Two different credentials on two different dashboard pages, and pasting one where the other belongs
fails in a way that looks like nothing: `https://tapi.bale.ai/bot<wrong-token>/setWebhook` answers
**404 Not Found**, exactly as it would for a valid token calling a missing method. Sanity checks that
catch it in one line: a real token is ~46 characters and **contains a colon**, and the digits before
the colon must equal `BALE_SAFIR_BOT_ID`. `getMe` is the definitive check — it returns the bot's
username.
**Where:** `deploy/.env` on the server — `BALE_BOT_TOKEN` vs `BALE_SAFIR_ACCESS_KEY`.

### Piping a secret into `plink` from PowerShell corrupts it
`$key | plink … 'read -r V'` arrives with a **UTF-8 BOM in front and a `\r` at the end** — PowerShell's
output encoding adds both. The value looks right in the file and is silently wrong: a 16-character key
becomes 18 characters, and the remote service rejects every request. Transfer secrets as base64 of the
raw UTF-8 bytes and decode server-side, then prove it by comparing SHA-256 of the local and remote
values. Length alone is not enough to spot it; `printf %s "$v" | tr -d '[:print:]' | wc -c` is.
**Where:** hit while writing `BALE_SAFIR_ACCESS_KEY` into `deploy/.env` on 2026-07-30.

### SOPS is gone from the server — the live secrets are the plaintext `deploy/.env`
`deploy/README.md` and older notes describe editing `deploy/prod.enc.env` with `sops`, using an age key
at `/srv/mabhas19/secrets/age.key`. **Checked on the box 2026-07-30: none of that exists.** There is no
`sops` or `age` binary anywhere, and `/srv/mabhas19` is not a directory. The host move to
`/data/apps/ceo-portal` left them behind.

What is actually true:

- `/data/apps/ceo-portal/deploy/.env` — plaintext, `chmod 600`, **this is what compose reads**. Edit it
  directly to add or change a secret.
- `deploy/prod.enc.env` — still committed, but **nobody on the server can decrypt it**. Treat it as a
  historical artifact until an age key is restored; it does not reflect the running config.
- `scripts/deploy.ps1` never runs `decrypt-env.sh`, and deliberately preserves `deploy/.env`, so a
  hand-edit survives every deploy.

**The risk this creates:** the secrets now live in exactly one place, on one disk, with no backup and no
copy in git. Rebuild the server and they are gone — including the election ballot keys, which cannot be
regenerated without destroying the ability to read existing ballots. Back `deploy/.env` up off-server.

### `myceo.ir` hosts need `myresolver`; only the direct-pointed hosts use `httpresolver`
`refahi.kurdnezam.ir` and `kurdnezam.ir` point straight at the box, so HTTP-01 works and their Traefik
routers use `httpresolver`. Every `myceo.ir` host sits behind the ArvanCloud CDN, where HTTP-01 cannot
complete — those must use `myresolver` (DNS-01). Copying the `walfare-web` compose block for a new
`myceo.ir` SPA therefore breaks certificate issuance; copy `mun-sanandaj-web`'s instead.
**Where:** `deploy/docker-compose.newserver.yml`.

### The app launcher exists six times
`src/layout/AppSwitcher.tsx` is byte-identical in all six SPAs (`admin-web`, `analytics-web`,
`election-web`, `landing-panel`, `mun-sanandaj-web`, `walfare-web`). Change one → copy to all →
**rebuild all six**, or the panels you skipped keep serving the old list.
Check with `md5sum */src/layout/AppSwitcher.tsx` — all six hashes must match.

---

## Build & deploy

### Renaming a Compose project silently changes implicit volume names
**Symptom:** services start successfully after a project rename but SQL/MinIO appear empty.
**Cause:** top-level `name:` prefixes implicit volumes, so changing `mabhas19` to `ceo-portal`
selects different physical volumes even when service mount keys still say `mssqldata` and
`miniodata`.
**Fix:** explicitly name production volumes, stop all writers and stateful services, copy the old
volumes while stopped, verify inventories/data, and retain the old volumes for rollback. Never
use `down -v` during this migration.
**Where:** `deploy/docker-compose.newserver.yml`, `docs/ai/OPERATIONS.md`.

### Running the whole local stack freezes a 32 GB dev machine
**Symptom:** starting all ten services locally drove RAM to 100%; the machine froze and restarted.
**Cause:** three compounding defaults, none of them the dev servers' fault alone —
SQL Server's `max server memory` defaults to **unlimited** (`2147483647` MB) and never gives memory
back; WSL2 with no `~/.wslconfig` helps itself to **~50% of host RAM** (15.5 GB of 32 GB); and eight
Node dev servers (Next.js ~1–2 GB each, Vite ~0.3–0.6 GB each) run on the host on top of that.
**Fix:** cap SQL Server at 2048 MB (`sp_configure 'max server memory (MB)'`, persisted in `master`,
no restart needed); create `~/.wslconfig` with `memory=8GB`, `swap=4GB`,
`autoMemoryReclaim=gradual` (needs `wsl --shutdown`); and **run only the front end you are working
on**. Measured after: 12.7 GB of 31.7 GB with Auth + API + analytics-web up.
**Not a fix:** putting the front ends in Docker. On Windows they land in the same WSL2 VM — same
processes, plus VM overhead and polled file watching.
**Where:** `AGENTS.md` → Local development.

### The same rename trap now applies to `docker-compose.dev.yml` locally
**Symptom:** `docker compose -f deploy/docker-compose.dev.yml up -d` on a dev machine either fails
to bind ports 1433/9000 or starts an **empty** SQL Server next to the one holding your data.
**Cause:** the dev compose file was renamed to `name: ceo-portal-dev`, but the containers already
running on developer machines were created under the old `mabhas19-dev` project (plus a standalone
`ceo-portal-sql-local`, ex-`mabhas19-sql-local`, on volume `mabhas19_sqldata`). Compose therefore
treats them as foreign, creates fresh `ceo-portal-dev_*` volumes, and collides on the ports.
**Fix:** don't run that compose file against an existing local install — `docker start` the
containers you already have. `CeoDb` + `CeoAuthDb` live in `mabhas19_sqldata`.
**Where:** `deploy/docker-compose.dev.yml`; local setup is documented in `AGENTS.md`.

- **NuGet on the dev machine is intermittent, not always blocked.** A full
  `dotnet build ceo-portal.slnx` succeeded locally on 2026-07-27 (0 errors, ~9 s) off the populated
  package cache. Try locally; if the *restore* fails, build **on the server** in the SDK container
  with the cached NuGet volume (see `OPERATIONS.md`). Never change package versions to force a
  restore to pass.
- **Docker `npm install` is strict about peers.** `walfare-web` and `election-web` need
  `--legacy-peer-deps` (antd-jalali declares React 18; the apps run React 19).
- **The Mihan SMS transport exists twice.** `src/Auth/Sms/MihanSmsSender.cs` (login) and
  `src/Infrastructure/Elections/ElectionSmsSender.cs` (votes). The IdP does not reference `src/Shared`,
  so sharing the code would mean adding a project reference to the live login host. Both bind the same
  `Sms:*` section, so there is no extra config — but **a change to the SOAP envelope or the relay
  contract must be made in both.**
- **Build one service at a time** — the box is 8-core / 15 GiB (measured 2026-07-27), but ~45 containers from other production stacks share it and only ~5 GiB is free. The "4 GB" figure in older notes described the retired `10.249.52.216` server.
- **Deploying the API is not enough.** A shared component (like the launcher) needs every SPA
  that embeds it rebuilt.
- **Never restart the shared Docker daemon or Traefik** — other production stacks run there.

## IP cameras / VMS

- **`ffmpeg` reads stdin, and that will eat your script.** Remote work here runs `bash -s` with the
  script arriving *on stdin*. An `ffmpeg` (or `ffprobe`) call inside such a script consumes the
  remaining lines as keyboard input — the symptom is a nonsense `bash: syntax error near unexpected
  token` pointing at a line that is fine. **Always `-nostdin` and `</dev/null`.**
- **A URL-encoded password breaks a second `%`-format pass.** `s@5190` percent-encodes to `s%405190`;
  feed that through `"...%s..." % pw` and then format the result again and Python reads `%40` as a
  width specifier (`unsupported format character`). Build URLs by concatenation, never by nesting
  `%` substitutions.
- **The camera stack here (Xiongmai / "QV RTSP Server") tells you nothing by probing.** `OPTIONS`
  returns **200 for every URI**, including nonsense, and `DESCRIBE` returns **400 for every wrong
  path** — never 401, never 404, with or without credentials. 51 guessed paths all failed.
  **Read `http://<cam>/js/Common.js` instead**: `geturlStr()` builds the URL the device's own player
  uses. `var loginPort = 34567` on the login page identifies the family.
  The URL is `rtsp://user:pass@host:554/mode=real&idc=<channel>&ids=<stream>`, and the
  `Authorization` header is **required** — URL userinfo alone gets 401.
- **Measure the camera's uplink, not just ours.** The first site delivers **~0.41 Mbit/s** (timed
  over plain HTTP, no RTSP), while its main stream is ~11.2 Mbit/s. Everything about the VMS design
  follows from that, and it is invisible if you only look at the VPS's 44–62 Mbit/s.
- **`go2rtc`'s `/api/streams` echoes source URLs with the password in them.** It must never be
  reachable without auth in front of it.
