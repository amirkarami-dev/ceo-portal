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

### Analytics: a semantic model lives in TWO files, and `ValueLabels` cannot merge groups
**Two files.** `KurdNezamSemanticModelStore.cs` / `WalfareSemanticModelStore.cs` are authoritative —
they ground the AI and build the SQL. `analytics-web/src/semantic/models/*.ts` is a **mirror**, and it
is what fills the Ask-AI picker, bundled at build time (not fetched). Change one and not the other and
you get a picker offering a field the engine cannot resolve, or a name the AI has never heard of.
The chips are a third place: `analytics-web/src/ai/examples.ts`.

**`ValueLabels` is display-only.** It is applied to result rows *after* the SQL runs
(`SqlQueryEngine.ApplyValueLabels`), so it renames a value but **never combines two groups**. When an
organisation uses two codes for one thing — `TypProject` 0 and 1 are both عادی — grouping gives two
rows that both read «عادی», with the count and the percentage split between them. It looks like a
bug in the report and is actually a dictionary that cannot do what it appears to do.
**Fix:** `EquivalentCodes` on the field (`{"0": "1"}`), which folds them in the GROUP BY —
`CASE WHEN [TypProject] = 0 THEN 1 ELSE [TypProject] END`. Opt-in per field; a CASE in every GROUP BY
costs index use everywhere for nothing.

**Related — `between` (fixed 2026-08-13, worth knowing why).** `ReportFilterDto` carries `Value` and
`Value2`, but the system prompt shows the AI `[{ field, operator, value }]`, so it wrote
`"value": ["1405/01/01","1405/12/30"]` — one key, two bounds. `Value2` stayed null,
`BETWEEN … AND NULL` matched no row, and **every year-filtered report came back empty with no
error**. Both the old and the new model wrote the array, and so did a hand-written unit test: three
independent readers guessing the same shape is the schema's fault. The engine now accepts either
form and **throws** when only one bound arrives. Do not "fix" a filter by dropping the second bound.

Also: the `parameters` list a query returns always carries `@offset` and `@limit` on top of the `@p*`
filters, so "two filters → two parameters" is wrong — it is four.

### An engine feature the AI is never told about does not exist
`percentOfTotal` was added to `SqlQueryEngine` and worked perfectly in unit tests, while every real
request for «درصد» came back as a plain count. `BuildSystemPrompt` lists the allowed aggregations and
the model writes **only** what that list allows, so the feature was unreachable from the day it
shipped and no test noticed, because the tests build the definition by hand.
**Rule:** a new operator, aggregation or `dateBucket` is two edits — the engine **and**
`ArvanReportAiService.BuildSystemPrompt` — plus a test asserting the prompt mentions it.
Same shape as the two-file semantic model, in a different disguise.

**While you are there:** the gateway URL names the model (`/gateway/models/<Model>/…`), so
`ANALYTICS_AI_BASE_URL` and `ANALYTICS_AI_MODEL` must agree, and a reasoning model spends its
`max_tokens` budget thinking *before* it writes anything — at 2000, one request in three returned
`finish_reason: length` and `content: null`.

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

### Every mabhas19 project edit returns 400, because the id is only in the route
**Symptom:** «ویرایش» on a project, change anything, save — the dialog stays put and the value does not
change. `PUT /api/Projects/{id}` → **400** with an empty body, so there is nothing to read in the
network tab and nothing in the API log.
**Cause:** `Projects.UpdateProject` opens with `if (id != command.Id) return TypedResults.BadRequest();`
while `projectsApi.update` sends `Partial<CreateProjectInput>` — no `id` — so `command.Id` binds to `0`
and the guard can never pass. It fails for every project and every field; it is not data-dependent.
**Fix:** send the id in the body (`body: { ...input, id: Number(id) }`) or drop the route/body guard.
Pick one deliberately — the guard is worth keeping if the body carries an id at all.
**Where:** `src/Web/Endpoints/Projects.cs:54`, `mabhas19-web/src/lib/endpoints.ts:32`.
**How it surfaced:** while verifying something else. A 400 with an empty body reads like a bad payload;
the only way to see it was capturing the request the app itself sends, token and all.

### A single-option `<select>` that filters out the row's own value renders BLANK
**Symptom:** a project's city looks lost after a list of cities is narrowed — the select shows nothing
even though the record still holds `شیراز`.
**Cause:** a `<select>` whose `value` matches no `<option>` displays empty. Filtering the option list
without keeping the current value in it produces exactly that, and it is indistinguishable on screen
from missing data.
**Rule:** when gating a list, the options are *allowed ∪ the record's own value*. And default only in
create mode — defaulting in edit mode means opening a record and pressing save silently writes a value
nobody chose.
**Where:** `mabhas19-web/src/components/projects/project-form.tsx` (`ALLOWED_CITIES`, `cityOptions`).

### `useMutation`'s return value is a NEW object every render — never a dependency
**Symptom:** an effect written as unmount-only cleanup runs constantly, and a mutation fires in a
loop. Types, lint and unit tests are all green.
**Cause:** `useMutation` returns `{ ...result, mutate, mutateAsync }` — a fresh literal per render.
`useEffect(() => cleanup, [save])` therefore re-runs its cleanup after every commit. Pair that with a
timer ref that is never nulled after firing and each run re-triggers the next.
**Fix:** depend on `save.mutate` (that one IS memoised) or hold it in a ref and use an empty
dependency list. Null a timer ref inside the callback that fires it.
**Related trap in the same file:** Excalidraw calls `onChange` on **programmatic** `updateScene` too,
so "the user changed something" cannot be inferred from `onChange`. Decide it from whether your own
diff actually produced anything to send.
**Where:** `room-web/src/features/whiteboard/WhiteboardStage.tsx`, fixed in `310ef28`.

### React cannot retry a failed `lazy()` — a retry button that clears error state is theatre
**Symptom:** a lazily-loaded chunk fails to fetch, your error boundary shows a friendly «try again»,
the person presses it, and the same error comes straight back. Forever.
**Cause:** `lazy()` latches its payload. On rejection `_status` becomes `2` and only `-1`
(Uninitialised) ever calls the loader again — read it in `react/cjs/react.development.js`,
`lazyInitializer`. Clearing the boundary's state re-mounts `<Suspense>`, which re-reads the *same*
rejected payload and throws before any network call happens.
**Fix:** reload the page. That is also the only thing that fixes the real cause here — a stale client
after a redeploy is asking for asset filenames that no longer exist, `/assets/` is `try_files =404`,
and `index.html` is `no-store`, so re-fetching the page is what gets the new names.
**Where:** `room-web/src/features/whiteboard/BoardBoundary.tsx`. And note **any** lazy boundary needs
an error boundary at all: without one, React unmounts the whole tree — on a meeting screen that means
losing the video call because a side panel failed to load.

### Vitest in the node environment skips four separate traps — if the code under test stays pure
**Symptom:** standing up vitest in one of these SPAs drags in a canvas-context stub, a
`clientWidth/clientHeight` stub, an `antd-jalali` mock and a slow module graph, before a single
assertion runs.
**Cause:** all four are consequences of `environment: "jsdom"`, not of testing.
**Fix:** keep the rules in a module that imports no React, no LiveKit and no widget library, and test
*that* under the default node environment. `room-web` has 19 tests and none of the four stubs;
`analytics-web` needs all of them because it mounts real components.
**Also:** `vitest@2` depends on **vite 5**. These apps are on **vite 6**, so pinning 2 puts a second
Vite in the tree and `tsc` type-checks `vite.config.ts` against the wrong one — which is what
`analytics-web`'s `react() as AnyPlugin` cast and its "dual-instance mismatch" comment are working
around. `vitest@3` declares vite 6; use it in any app that does not already carry the workaround.
**Where:** `room-web/vite.config.ts`, `room-web/src/features/whiteboard/wire.test.ts`.

### mabhas19 carries TWO climate zonings, and the codes overlap without meaning the same thing
**Symptom:** «کد اقلیم» says تبریز is `5` «خیلی سرد»; پیوست ۲ of the fifth edition says `4B`. Neither
is a typo, and five cities *do* agree, which makes the whole thing look like a partial data error.
**Cause:** two systems. The scoring uses the legacy six — `1, 2, 3A, 3B, 4, 5` with Persian names,
inherited from `climate.js` — and the fifth edition's appendix publishes ANSI/ASHRAE 169-2020 classes
(`0B … 5C`) for 76 stations. Over the 31 cities the form offers: 25 differ, 5 collide in notation, 1
(زاهدان) is absent from the document. `3B` means «چهارفصل و کم باران» in one and warm-dry in the other.
**The trap:** feeding an appendix class into the scoring is silent. `OPAQUE_BASE_R_BY_CLIMATE` has no
`4B` key, so `getOpaqueTargetR` falls back to the `3B` base and grades the building against the wrong
requirement with no error anywhere. A test in `climateAppendix2.test.ts` asserts the eight foreign
classes stay unknown to the scoring tables, so wiring them together fails loudly.
**Rule:** the appendix class is reference data, displayed beside the code. Only `climate.ts` /
`ClimateData.cs` keys drive a calculation. Switching the assessment to the fifth edition needs that
edition's own R/U/SHGC tables, which the appendix does not contain.
**Where:** `packages/assessment-core/src/data/climate-appendix2.ts` (the table, and the reasoning),
`docs/worklog/2026-08-17-climate-appendix2.md`.

### That appendix PDF cannot be read by extracting its text
**Symptom:** `extract_text()` on `docs/mabhas19/پیوست2-….pdf` returns row numbers and Latin codes
only — every Persian city name comes back empty, so a table looks like a list of loose numbers.
**Cause:** the embedded Persian font has no ToUnicode map. The digits and Latin letters map fine,
which is what makes the output look partially successful instead of broken.
**Fix:** render the pages and read them as images (`pymupdf` → PNG at ~170 dpi), then cross-check the
Latin codes against the text layer — the two together verify a transcription without needing a second
reader. `pdftoppm` is not installed on this machine; `pip install pymupdf` works.
**Where:** the same worklog records the exact approach.

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

### `.catch(() => setError("ورود ناموفق بود"))` hides the only sentence that explains the failure
**Symptom:** a user whose service access was revoked lands on `/auth/callback`, sees a generic
"login failed", presses «تلاش دوباره», and loops forever.
**Cause, part 1:** the callback discarded its argument AND the query string. The IdP had already put
the reason in the URL — `error=access_denied&error_description=شما به این سرویس دسترسی ندارید.`
**Cause, part 2:** the retry navigated to `/login` → `signinRedirect()` → the IdP still held a valid
SSO cookie → same refusal. Nothing cleared the session, so retrying could never succeed.
**Fix:** capture `window.location.search` **before** `signinRedirectCallback()` (it consumes the
URL), show `error_description`, and make the button `removeUser()` + `signoutRedirect()`.
**Where:** `src/auth/oidc.ts` + `src/auth/routes.tsx` in all 8 SPAs — there is no shared package.

### This IdP ignored `prompt=login` entirely
**Symptom:** a "sign in as someone else" button that reuses the existing session anyway.
**Cause:** `AuthorizationController.Authorize()` never read the prompt parameter — zero references
to `HasPromptValue` or `Prompts`.
**Fix:** if authenticated and `prompt=login`, `signInManager.SignOutAsync()` then re-challenge — and
**strip `prompt` from the returnUrl**, or the login page posts back, signs the freshly-authenticated
user out again, and loops in a new way.
**Where:** `src/Auth/Auth/AuthorizationController.cs`.

### Every SPA silently renews, so an authorize-time rule change bites in ~30 minutes
**Symptom (anticipated, avoided):** tightening the service-grant gate looks like it will take effect
"at next login". It does not.
**Cause:** all 8 SPAs set `automaticSilentRenew: true` and only 2 request `offline_access`, so six of
them re-hit `connect/authorize` every access-token lifetime (30 min, `src/Auth/Program.cs`).
**Also:** `AdminController.CreateUser` writes grants unconditionally, so every admin created through
the panel with service boxes ticked already has a NON-EMPTY grant list and would be gated at once.
**Fix:** never ship a gate and its grants in one deploy. Backfill the grant, verify, then gate. And
never map `admin-web` in `ClientToKey` — it is the screen that repairs a mistake, and there is no
`admin` key in `ServiceKeys.All` to grant anyway.

### A table that always scrolls but pins its actions column *conditionally*
**Symptom:** on a phone the ویرایش and حذف buttons are 500-740px past the edge of the screen. The
table scrolls, so they are reachable — after dragging the whole row across.
**Cause:** `scroll={{ x: scrollX ?? 900 }}` has no falsy case, but the actions column read
`fixed: scrollX ? "right" : undefined` — the *prop*, not the effective value. Almost no page passed
one, so almost no table pinned.
**Fix:** `fixed: "right"` unconditionally. One line, ~9 tables.
**When checking it, note RTL:** AntD emits `ant-table-cell-fix-**left**` for `fixed: "right"` in an
RTL table. Looking for `fix-right` finds nothing and reads as "the fix did not work".
**Where:** `landing-panel/src/components/ui/CrudTable.tsx`.

### A comment saying "admin-only in practice" on an anonymous route
**Symptom:** none — which is the point. `GET /contact-sections?includeInactive=true` is
`AllowAnonymous` and binds the flag from the query string, so anyone could read every *retired*
contact block with its real addresses and phone numbers.
**Cause:** the guarantee lived in an XML doc comment instead of in code.
**Fix:** `includeInactive && httpContext.User.IsInRole(Roles.Administrator)`, and 404 the by-id route
for a retired row so it cannot return what the list refuses. If a parameter is only safe for admins
on an anonymous route, the route must **enforce** it — a caller-controlled flag is not a contract.
**Where:** `src/Web/Endpoints/Kurdnezam/KurdnezamContactSections.cs`.

### Measuring a touch target with getBoundingClientRect misses the `before:-inset` hit area
**Symptom:** header buttons measure 36x36 and 40x40 and look like they fail the 44px minimum.
**Cause:** this repo extends hit areas with `before:absolute before:-inset-1` pseudo-elements, which
`getBoundingClientRect()` on the button does not see. Probing outward with `elementFromPoint` also
under-reads by a pixel per side, so a true 44px box measures 42.
**Fix:** read the pseudo-element — `getComputedStyle(el, "::before").top` is negative by the amount
it extends. 40px visual + `-inset-0.5` and 36px + `-inset-1` are both exactly 44.
**Where:** `kurdnezam-web/src/components/Header.tsx`. Do not "fix" targets that already pass.

### An empty `children` array still renders a dropdown, and the obvious guard crashes the header
**Symptom:** whenever the content fetch fails, a nav dropdown opens onto a blank white box.
**Cause:** `item.children ? (…) : (…)` — `[]` is **truthy**, so an empty array takes the dropdown
branch. `layout.tsx` catches any content failure and seeds `EMPTY_CONTENT`, so this is a live
production state, not a theoretical one.
**The trap in the fix:** switching to `item.children?.length ?` sends those entries down the `:`
branch, which is `<Link href={item.href!} />` — and a dropdown entry has **no** `href`. Next throws
E319 in dev; in production `formatUrl(undefined)` dereferences `undefined`.
**Fix both halves:** test `.length` in *every* renderer (desktop and mobile are separate call sites),
**and** filter the nav so an entry with neither `href` nor children never reaches the renderer. Give
any dropdown that must survive an outage a static first child.
**Where:** `kurdnezam-web/src/components/Header.tsx`.

### A translated menu built from database titles silently stops following the database
**Symptom:** an admin renames a page; its heading and its card update, the **menu does not**.
**Cause:** an i18n override applied in *both* languages. `t("organs.board")` returns the Persian
dictionary string, so `page.title` is never read in Persian — the language the site is actually
written in. The override looks like i18n but is really a hard-coded label with two spellings.
**Fix:** gate it on the non-default language — `lang === "ku" && key ? t(key) : page.title` — so the
default language always reflects the database. Type the slug→key map `Partial<Record<…>>`, or
`t(MAP[slug])` type-checks for an unknown slug and `t(undefined)` renders **blank**, not an error.
**Where:** `kurdnezam-web/src/lib/orgPages.ts`. The principled fix is a `TitleKu` column beside
`Settings.NameKu`, which is this repo's one existing field-level translation mechanism.

### Resolving an icon component in a render body trips `Cannot create components during render`
**Symptom:** `const Icon = siteIcon(section.icon); return <Icon />` fails lint with
*"Error: Cannot create components during render"*, even though the helper only **looks up** an
existing component in a fixed map and creates nothing.
**Cause:** the React Compiler lint cannot tell a lookup from a factory — any call returning a
component, assigned to a capitalised local inside render, reads the same to it.
**Fix:** do the lookup *inside* a component — `<SiteIcon name={…} />` — instead of in the caller.
Call sites end up plainer too.
**Also:** `lucide-react` has ~6,000 exports and cannot resolve a runtime string without bundling all
of them, so the map must be a fixed registry; and lucide has **dropped its brand icons**, so there is
no `Instagram` — this repo uses `Send`/`AtSign` for Telegram/Instagram.
**Where:** `kurdnezam-web/src/lib/siteIcons.tsx`.

### A preview pane that is not displayed has NO `requestAnimationFrame`, so no AntD motion completes
**Symptom:** a Drawer opens with the right title and fields but sits off-screen at
`transform: translateX(±width)`, its wrapper stuck on `…-appear-start`; a Sider's collapse changes no
width. Reads exactly like the reduced-motion bug below — and is not it.
**Tell them apart:** here the transitions are a normal `0.2s` (no blanket duration override), and
`document.querySelector('.ant-drawer-content-wrapper')` carries `-appear-start` rather than a
finished class. Confirm in one line:
```js
await new Promise(res => { requestAnimationFrame(() => res(true)); setTimeout(() => res(false), 1200) })
```
`false` means the pane is not compositing — rc-motion advances on the next frame and never gets one.
The matching giveaway is `computer{action:"screenshot"}` failing with *"the Browser pane is not
displayed"*.
**Fix:** display the pane, or verify the panel's *content* by reading the DOM and accept that the
slide cannot be seen. Do not "fix" working motion code.
**Charts fail the same way but leave nothing to read.** Every chart in `analytics-web` is an ECharts
**canvas** since 2026-08-14, so there is no `<g>`, no `<path>` and no legend node — a chart in a
non-displayed pane is one `<canvas>` element with an empty bitmap, and `read_page` shows nothing at
all. Ask the *instance* instead of the DOM:
```js
const el = document.querySelector('[data-testid="echarts-canvas"]');
const c  = echarts.getInstanceByDom(el);      // undefined = never mounted, which is a real bug
c.getOption().series[0].data                   // the data it was given
c.getOption().color                            // the palette in use
c.getDataURL()                                 // a PNG, even when the pane is hidden
```
`getOption()` returns the **normalised** option, so it is `xAxis[0].inverse`, not `xAxis.inverse`.
From the outside, `document.querySelector('canvas').toDataURL()` gives the same picture and is what
`chartSnapshot` in `features/export/pdf.ts` uses.

### An ECharts chart renders blank in a test, with no error
**Symptom:** `echarts-canvas` is in the DOM, the container even carries `_echarts_instance_`, and a
`<canvas>` child exists — but nothing is drawn and `echarts.getInstanceByDom(el)` returns undefined.
**Cause:** jsdom implements no canvas 2D context and reports every element as 0×0. `echarts-for-react`
compounds it with a two-phase init that waits on a `finished` event, disposes and re-inits — that
never completes, so the instance never survives.
**Fix:** `analytics-web/vitest.setup.ts` stubs a Proxy-backed 2D context (`measureText` estimates 6px
per character) and puts `clientWidth`/`clientHeight` on `HTMLElement.prototype` — inline px wins,
otherwise 800×600. Charts go through the app's own `useEChart`, not `echarts-for-react`.
**Why it matters:** without the stub the only testable thing is the option object handed to a mock,
and a mock accepts anything — including options ECharts rejects, renames, or normalises into
something else. Assert against `getInstanceByDom(el).getOption()`, never against a captured prop.

### A blanket `prefers-reduced-motion` rule parks every AntD Drawer off-screen
**Symptom:** the mobile menu button "does nothing". The DOM is right — `.ant-drawer` is mounted and
carries `ant-drawer-open` — but the panel sits at `transform: matrix(1,0,0,1,260,0)`, exactly its own
width outside the viewport. Only for users with "reduce motion" on, which is why it survives review.
**Cause:** the `global.css` block that crushes `transition-duration` to `0.001ms !important` for `*`.
AntD opens a drawer by *removing* the closed transform, and it only removes it when the transition
**ends**. rc-motion attaches that `transitionend` listener in an effect, one frame later; at 0.001ms
the event has already fired, so it is never heard and the transform is never cleared.
**Fix:** turn the library's motion off at the source — `token: { motion: !reducedMotion }` in the AntD
theme, fed by a `matchMedia("(prefers-reduced-motion: reduce)")` hook. With `motion: false` there is
no transform to strand, so the panel just appears, which is what the preference should mean.
**What does NOT work:** restoring the duration for `.ant-drawer, .ant-drawer *` inside the same media
query. Tried and measured — the drawer stays parked. Restoring it *globally* does work, but that
throws the accessibility preference away. Do not reach for the CSS exemption.
**Where:** `vms-web/src/theme/tokens.ts` + `src/app/providers.tsx`, same pair in `room-web`.
`election-web` and `mun-sanandaj-web` carry the same blanket CSS but render no Drawer or Modal, so
they have nothing to strand — add the theme fix at the same time as the first one.

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

### `ServiceKeys` has THREE tiers, and which one a client sits in decides who gets refused
- `All` makes a service **grantable** — admin-UI checkboxes, and `ServiceAccessStore.ReplaceAsync`
  silently **drops any key not in this list on write**, so a key must land here before anyone can hold it.
- `ClientToKey` gates **everyone**.
- `AdminGatedClientToKey` gates **administrators only** — `election-web`, `room-web`, `vms-web`.
  Putting any of those in `ClientToKey` would refuse every engineer provisioned before that service
  existed, because they carry `["walfare"]` (or the single service they signed in through): a silent
  disenfranchisement, at the IdP, of people the API considers eligible.
- In **neither** map = never gated. `admin-web` lives here on purpose: it is the only way a
  narrowed administrator can widen their own grants again.

⚠ The admin/engineer split is by **role**, not by how the account signs in. Today no administrator is
an engineer (all six have a `PasswordHash`; all 413 granted users have none). The day you give
`Administrator` to an engineer's account, grant them `election` and `room` too, or you take away
their ballot and their meetings.
**Where:** `src/Auth/Data/ServiceKeys.cs`, gate in `AuthorizationController.DenyServiceAsync`.

### The service gate is login-time only — it is not an API permission
`DenyServiceAsync` decides which app you may **sign in to**. The resource server validates issuer and
audience only (`src/Infrastructure/DependencyInjection.cs:57`) and never looks at which client minted
the token, so a token obtained from one SPA is accepted by every API endpoint. Per-endpoint
authorisation is the role checks on the API, and nothing else. Do not describe service grants as if
they firewall the API.

### `[Authorize(Roles = "A,B")]` is split on `,` with **no trimming**
`AuthorizationBehaviour.cs:37` does `a.Roles.Split(',')` then compares with `==`. A space after the
comma — `"Administrator, SuperUser"` — matches nothing, and every command carrying the attribute
throws `ForbiddenAccessException` for everyone. It fails silently at compile time and loudly at
runtime, on all 85 gated handlers at once. `Roles.AdminOrSuper` is built by concatenation
(`Administrator + "," + SuperUser`) so a reformat cannot reintroduce the space.
**Where:** `src/Application/Common/Behaviours/AuthorizationBehaviour.cs`, `src/Domain/Constants/Roles.cs`.

### Two roles carry admin powers now — never test for `Administrator` alone
`SuperUser` is an administrator that is never gated by service grants. Any check written as
`IsInRole("Administrator")` silently excludes it. Use `Roles.AdminOrSuper` for attributes,
`RequireRole(Roles.Administrator, Roles.SuperUser)` for endpoints, and `Roles.HasAdminPowers(roles)`
for imperative checks. This matters most in the IdP's "don't remove the last administrator" guards:
counting only the `Administrator` role would let you strip the last `SuperUser`.
`src/Auth` cannot reference `Domain`, so it repeats the strings — change both places.
**Where:** `src/Domain/Constants/Roles.cs`, `src/Auth/Admin/AdminController.cs`.

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

### Testing an EF migration script with `sqlcmd` needs `-I`, or it fails on code you did not write
`dotnet ef migrations script` wraps statements in `EXEC(N'…')`, and this database has three
**filtered** indexes (`RoleNameIndex`, `UserNameIndex`, `IX_Rooms_JoinToken`). A filtered index
requires `QUOTED_IDENTIFIER ON`; ADO.NET sets it ON, **`sqlcmd` defaults it OFF**. So the script
dies with `Msg 1934 … 'QUOTED_IDENTIFIER'` on an index from 2026-07, and it looks like the migration
you just wrote is broken. Pass `sqlcmd -I`. The app itself is never affected — it migrates through
`_context.Database.MigrateAsync()` (`ApplicationDbContextInitialiser.cs:37`), not through sqlcmd.

### A `FieldId` that points at user-editable metadata should not be a foreign key
`KurdnezamFormAnswer.FieldId` and `KurdnezamFormAttachment.FieldId` are plain ints, with the field's
label copied onto the row. Deliberate, for two reasons: an administrator deleting a form field must
not delete or block what people already sent, and a real FK would give SQL Server two cascade paths
into the answers table (one through the submission, one through the field), which it refuses. The
label snapshot is what keeps an old answer readable after its field is renamed or removed.
**Where:** `src/Domain/Kurdnezam/KurdnezamFormAnswer.cs`.

### A new `DbSet` must be added to `IApplicationDbContext` too, or you get twenty misleading errors
`ApplicationDbContext` alone is not enough — the Application layer only ever sees the **interface**.
Miss it and the build returns a wall of `CS1061`, most of which point at the wrong thing:
`'CancellationToken' does not contain a definition for 'Id'` is simply what a failed
`FirstOrDefaultAsync` overload resolution looks like once the receiver type is unknown.
**Where:** `src/Infrastructure/Data/ApplicationDbContext.cs` **and**
`src/Application/Common/Interfaces/IApplicationDbContext.cs`. Costly here because every build is a
round-trip to the server.

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

### The app launcher exists eight times
`src/layout/AppSwitcher.tsx` is byte-identical in all eight SPAs (`admin-web`, `analytics-web`,
`election-web`, `landing-panel`, `mun-sanandaj-web`, `room-web`, `vms-web`, `walfare-web`). Change
one → copy to all → **rebuild all eight**, or the panels you skipped keep serving the old list.
Check with `md5sum */src/layout/AppSwitcher.tsx` — all eight hashes must match.

---

## Build & deploy

### A dynamic import inside a test charges the test for the whole module graph
`await import("./routes")` inside a test made it pass alone (~3.2s) and fail in the full suite
(~19s against a 10s `testTimeout`) — intermittently, so rerunning the one file always looked green.
The body was four synchronous lines; the time was **antd + oidc-client-ts being transformed inside
the test's timed window**. A top-level import pays that during collection, when no timer is running,
which is why every other file was fine. Static import → 88ms for the file, from 3226ms.
**Before raising a timeout, check whether the test is importing something heavy at runtime.** Raising
it hides the flake and keeps the suite slow.
**And verify by running the FULL suite several times** — for this class of bug, running the single
file proves nothing.

### `--legacy-peer-deps` also stops npm INSTALLING peers, not just checking them
`analytics-web`'s image needs it (antd-jalali declares `react ^18`; the app runs 19, as walfare-web
has in production for months). The next build then died with every test file losing `screen`,
`fireEvent` and `waitFor` from `@testing-library/react` — those are re-exports from
`@testing-library/dom`, a **peer**, which existed on the dev machine only because npm auto-installed
it long ago. **Whenever a Dockerfile uses `--legacy-peer-deps`, every peer the code imports must be
declared explicitly.**
Related: `analytics-web/deploy/Dockerfile.analytics-web` installs from `analytics-web/package.json`
**alone**, with no root `package.json`, so npm `overrides` written at the monorepo root never apply
to the image. Check the sibling app's Dockerfile before inventing a fix — `walfare-web` already had
this one, comment and all.

### antd-jalali: the listener goes INSIDE ConfigProvider, and its deep import breaks Vitest
`<JalaliLocaleListener/>` must be a child of the `ConfigProvider` that carries the locale. Placed
above it everything compiles, the pickers render, and they silently show **Gregorian** —
`1405/01/01` displays as `2026/03/21`, with no error anywhere. Only reading the rendered value finds
it.
The package also imports `antd/es/date-picker/generatePicker/generateRangePicker` without an
extension. Vite resolves that in dev and build; under Vitest antd stays externalised and the
specifier reaches Node's ESM loader, which will not. `server.deps.inline` and a resolve alias both
fail, because neither reaches an import made *inside* an externalised package — stub the package in
`vitest.setup.ts` instead and check the real calendar in a browser.

### A piped build or test command reports the PIPE's exit code, not the build's
`dotnet test … 2>&1 | tail -30` came back **exit 0** while the build had failed to compile. The
status belongs to `tail`, which succeeded at printing the error. A background task therefore reports
"completed (exit code 0)" for a red build, and anything trusting the status believes it passed.
**Fix:** `set -o pipefail` inside the shell that owns the pipe (put it *inside* the `bash -lc '…'`
you hand to `docker run`, not outside it — the outer shell is a different process), **and read the
output anyway**. The same applies to `| grep`, `| head`, and `| tee`.

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

### `TotalRows=1, SuccessCount=0, FailedCount=0` means a row THREW, not that nothing happened
In the MunSanandaj sync workers a row that *returns* `Failed` is logged and counted; a row that
*throws* used to escape to the run-level catch, so the run was marked `Failed` with counters that
cannot add up and **no `mun_report_logs` row at all** — the dashboard showed a failed run containing
nothing, and the reason lived only in the container log. That is how an expired TLS certificate on
`eservice.kurdnezam.ir` hid for 14 days and 60 runs. `processRow` is now wrapped per row. If you see
counters that don't sum to `TotalRows`, look for an exception, not for missing data.
**Where:** `src/Infrastructure/MunSanandaj/MunSanandajSyncService.cs`.

### `eservice.kurdnezam.ir` has no port 80 — "just use http" is not an escape hatch
Measured: 443 open, 80 times out after 20 s, while the same server reaches port 80 on `example.com`,
`kurdnezam.ir` and `myceo.ir`. It is that host's firewall, not our egress. The report PDF is served
only over TLS. When its certificate expired we narrowed validation instead — expiry-only **plus** an
SPKI pin (`MunSanandaj:AllowExpiredPdfCertificate` + `PdfCertificatePublicKeyPin`), which refuses a
substituted certificate and reverts to strict validation if the pin is missing. Turn it off after
renewal: the new key will not match the pin, so downloads fail closed instead of silently staying on
the weaker path. The host serves the same file at `/pdf/…` and `/sm/pdf/…`.
**Where:** `src/Infrastructure/MunSanandaj/MunSanandajPdfFetcher.cs`.

### `melk_id` is `ReqId`, and a row without one is SKIPPED, not failed
`saveEngineerReport` is called as `…&darkhast_id={ProjectNo}&melk_id={ReqId}`. `WebS_GetListRepToShahrdari`
can return `ReqId` as NULL; `reader["ReqId"].ToString()` turns that into `""` (not null — no
exception, which is why it looks harmless), and the municipality answers
`{"success":false,"msg":"melk_id is empty..."}`.

`RunAsync` now drops such rows right after the procedure returns (`SkipIfNoReqId`): not counted in
`TotalRows`, not sent, **not logged as a failure** — a data-entry gap is not a broken integration,
and a Failed row every 2 h forever would say otherwise. It is still logged at Warning level with the
Peygiri, because an invisible non-event is exactly the trap this service already fell into once.
`Completed, rows=0` therefore means "nothing was ready", not "nothing happened".

⚠ **`saveEngMap` must NOT use this filter** — it sends no `melk_id`, so those rows are processable
there and filtering them would silently drop work. `RunSaveEngMapAsync` passes `skipRow: null`, and
a test guards it.
**Where:** `src/Infrastructure/MunSanandaj/MunSanandajSyncService.cs`, `Sql/MunSanandajSourceReader.cs`.

### A worker that looks like it never fires may just be failing invisibly
`SaveEngineerReportWorker` is `do { … } while (await timer.WaitForNextTickAsync(...))`, so it runs
**once at startup** and then every `MunSanandaj:IntervalHours`. Every container restart therefore
fires an extra run. Before concluding a schedule is broken, check `mun_sync_runs.TriggeredBy` and the
gaps between `StartedAt` — the rows are there even when nothing visible came of them.
**Where:** `src/Infrastructure/MunSanandaj/SaveEngineerReportWorker.cs`.

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
- **The endpoints are DVRs, not cameras — one host carries many channels.** `78.39.233.70` is a
  Sofia/Xiongmai DVR: port **34567 open** (its control port), web UI built for **8 channels**
  (`chSc:8`, `chPy:4` in `js/Common.js`), brand overlay TANTOS, firmware `V8.8.5.61.26.1`. That is
  why the RTSP URL carries `idc=<channel>` — a standalone camera would not need a selector. **To add
  a second camera at the same site, reuse the host and port and change کانال (`idc`).** Do not expect
  one IP per camera.
- **No password is ever typed into the admin panel, and none is stored in CeoDb.** The form takes a
  *credential key*; the media server maps it in `/srv/vms/credentials.env` as `key=user:password`.
  Today there is exactly one: `default` → `admin`. A site with a different login needs a new key
  added on the VPS **first** — `vms-sync` refuses to write a config whose key it cannot resolve, and
  says so, rather than producing a stream that silently fails to authenticate.
- **Measure the camera's uplink, not just ours.** The first site delivers **~0.41 Mbit/s** (timed
  over plain HTTP, no RTSP), while its main stream is ~11.2 Mbit/s. Everything about the VMS design
  follows from that, and it is invisible if you only look at the VPS's 44–62 Mbit/s.
- **`go2rtc`'s `/api/streams` echoes source URLs with the password in them.** It must never be
  reachable without auth in front of it. Corollary: **never port-forward 1984.** Nothing needs it
  public — Traefik reaches the container over the docker network.
- **go2rtc refuses the MSE WebSocket when the page is on a different subdomain.** The player is on
  `vms.myceo.ir`, the stream on `cam.myceo.ir`, so every upgrade arrives with a foreign `Origin` and
  go2rtc's default `Upgrader.CheckOrigin` rejects it. The tile just says «بی‌ارتباط»; the only place
  the reason appears is go2rtc's own log:
  `ws.go:106 > host=cam.myceo.ir origin=https://vms.myceo.ir error="websocket: request origin not
  allowed by Upgrader.CheckOrigin"`. **Fix: `origin: "*"` under `api:` in `base.yaml`.** That is
  go2rtc's only setting — there is no allow-list — and it is safe here because Traefik routes one
  path and calls forwardAuth first, and the media cookie is `SameSite=Lax` on `.myceo.ir`, so a
  genuinely third-party page cannot send it.
- **You cannot curl go2rtc from the VPS host.** Docker Desktop puts containers in a VM, so neither
  `127.0.0.1:1984` nor the container's bridge IP answers — both give `000`, which reads exactly like
  "the service is down" when it is fine. The image is distroless too: no shell, no `wget`, so
  `docker exec` fails with `executable file not found`. Probe with a sidecar instead:
  `docker run --rm --network traefik --entrypoint sh curlimages/curl:latest -c "curl … http://vms-go2rtc:1984/…"`.
- **`/api/frame.jpeg` returns 500 `exec: "ffmpeg": executable file not found`, and that is harmless.**
  JPEG needs a transcode the image does not ship. It proves nothing about the camera. To test the
  real path use `/api/stream.mp4?src=<key>&video=h265` — a working camera returns a couple of hundred
  KB of `video/mp4; codecs="hvc1…"`.
- **`dotnet ef --no-build` silently uses stale binaries, and lies about it.** After adding an entity,
  `migrations add … --no-build` produced an **empty** `Up()`/`Down()`, and a later
  `database update --no-build` printed `Done.` having applied nothing — `migrations list` did not even
  show the migration. The cause is the **startup** project's `bin`, which still holds the previous
  `Infrastructure.dll`; building only `src/Infrastructure` does not refresh it.
  **Build `src/Web` after every model change**, then check `migrations list` for `(Pending)` before
  and its absence after. An empty migration commits and deploys perfectly happily.
- **`printf pw | sudo -S tee <file>` writes the password INTO the file when sudo's cache is warm.**
  The pattern relies on `sudo -S` consuming the first stdin line — but a recent successful `sudo` in
  the same session means it never reads stdin at all, so `tee` receives the password line *and* the
  data. It happened twice here: the VPS login password became line 1 of `/srv/vms/credentials.env`
  and `/srv/vms/gateway.token`. Nothing failed loudly; it was caught only because a 43-character
  token sat in a 48-byte file.
  **Never pipe data through `sudo`.** Build the file as the ordinary user under `umask 077`, then
  `sudo install -m 600 -o root -g root <tmp> <target>`. Verify by digest afterwards, and check the
  *shape* of the file (`sed 's/./x/g'`) rather than printing it.
- **Docker Desktop bind-mounts only shared host paths, and an unshared one mounts as an EMPTY
  DIRECTORY.** No error, no warning. On the media VPS, `-v /srv/vms/go2rtc.yaml:/config/go2rtc.yaml`
  gave go2rtc an empty directory, so it started on its **defaults**: `/api/streams` returned `{}` and
  the log showed `[rtsp] listen addr=:8554` even though the config disables it. Both are the tell —
  a service running on defaults has read no config at all. The docker user's home **is** shared;
  `/srv` is not. Check with
  `docker run --rm -v <path>:/c curlimages/curl sh -c 'test -f /c && wc -c </c || echo DIRECTORY'`.
- **Docker creates a missing bind-mount source as a directory.** Start the container before the file
  exists and that path *becomes* a directory, so a later `install`/`cp` writes the file **inside** it
  and the mount stays empty for ever. Render the config first, mount second.
- **A helper like `sud() { printf pw | sudo -S "$@"; }` replaces stdin, so `sud tee f <<EOF` writes
  nothing.** It produced a silent 0-byte file. Same root cause as the password-in-the-file bug above:
  never pass data through a sudo wrapper — build the file as the ordinary user, then `sudo install`.
- **`sudo docker ps` on the media VPS returns nothing, and that does NOT mean docker is down.** It is
  Docker **Desktop**, running under the `amirserver` session with its own socket. Run docker as that
  user; from root use `runuser -l amirserver -c 'docker ...'`.

### `FindByEmailAsync` is `SingleOrDefault`, and this database has duplicate emails
**Symptom:** `ceo-portal-auth` crash-loops with **exit 139** on restart — every login for every
service down. The container had been up 47 hours; nothing changed in that code path.
**Cause:** `AuthDbInitialiser.SeedAdminUserAsync` called `userManager.FindByEmailAsync(adminEmail)`,
which is `SingleOrDefault` underneath. **Two accounts share `amirkarami.dev@gmail.com`** (`admin` and
one named after the address). It throws `Sequence contains more than one element`, `SeedAsync`
rethrows, and `Program.cs` lets that kill the process.
**Why it hides:** the seeder only runs at **startup**. A duplicate created at any point sits there
harmlessly until something restarts the IdP — so the deploy that triggers it is never the one that
caused it, and rolling the image back does not help.
**Fix:** `userManager.Users.Where(u => u.NormalizedEmail == normalised)` + `FirstOrDefault`, with a
warning that names both accounts. An ambiguous admin address is worth a warning, not a total outage.
**The wider trap: nothing enforces one user per email here.** Engineer logins are created with a
placeholder and **112 accounts share `a@b.com`**. Any new code that looks a user up by email is the
same landmine — use `Where(...).FirstOrDefaultAsync()`, never `FindByEmailAsync`.

### A cross-origin `Set-Cookie` needs `AllowCredentials`, or the browser throws the response away
**Symptom:** the camera panel showed «سرویس تصویر در دسترس نیست / ارتباط با سرویس تصویر برقرار نشد».
The route was live and the origin was allowed — `curl -H "Origin: https://vms.myceo.ir"` returned
`Access-Control-Allow-Origin: https://vms.myceo.ir` — so it looked like a network or gateway fault.
**Cause:** the API's CORS policy had `WithOrigins().AllowAnyHeader().AllowAnyMethod()` and **no
`AllowCredentials()`**. `vms-web` is the only SPA that sends `credentials: "include"`, and it must:
`/api/VmsMedia/session` answers with a `Set-Cookie` the browser has to keep for a *different* host.
A browser discards a cookie from a cross-origin response unless the response also carries
`Access-Control-Allow-Credentials: true`, and it rejects the whole fetch — so no application code
ever sees a status to report.
**Fix:** `policy.AllowCredentials()` alongside `WithOrigins`. Safe because the origin list is
explicit; ASP.NET refuses `AllowCredentials` next to `AllowAnyOrigin`, so it cannot widen by accident.
**Check it with curl, not the browser:** `curl -i -H "Origin: https://<spa>" https://api.myceo.ir/...`
and look for **both** `Allow-Origin` and `Allow-Credentials`. Only one of them present is the trap.

### go2rtc over MSE needs `video=` or the tile stays black
`/api/ws?src=X` alone negotiates every track the camera publishes — on this estate H.265 video, PCMA
audio and an ONVIF metadata track. MSE then receives the init segment, reports the correct
dimensions, and **never paints a frame**. Adding `&video=h265,h264` restricts it to video and it
plays. go2rtc's own `stream.html?mode=mse&video=h265` does the same thing, which is why that URL
works while a hand-rolled client does not.
Related: do not offer an audio codec in the MSE codec list while filtering audio out, and keep the
`<video>` **muted** — an unmuted element on a stream with no audio only gives the browser grounds to
refuse autoplay.

### A library that positions with `transform` and no `left` breaks under `dir="rtl"`
Every SPA here runs `<html dir="rtl">`, and that inherits into any library you drop in.
**Symptom:** in `analytics-web` the dashboard widgets sat too far right and one click threw them off
the page. **Cause:** `react-grid-layout` writes `position: absolute` + `transform: translate(x, y)`
and **never writes a `left`**. It assumes an absolute box starts at the container's left edge — true
only in LTR. In RTL, `left: auto` puts the box against the **right** edge, so `left` silently becomes
`container width − item width` and the transform adds to it. Grabbing a widget doubled the error,
because the library starts a drag by reading the real position and handing it back as the transform.
**Fix:** keep the *positioning container* LTR and put the text direction back on the children:
```css
.dashboard-canvas .react-grid-layout { direction: ltr; }
[dir="rtl"] .dashboard-canvas .react-grid-item { direction: rtl; }
```
**The general rule:** any drag, resize, chart, or canvas library that positions children with
`transform` alone is suspect in this estate. **Check it, do not read the docs** — one line in the
console tells you: `getComputedStyle(item).left` must be `0px`, and the item's real offset from its
container must equal its transform X. If they differ, that difference is your bug, and it will double
the moment anything drags.

### Your CSS loses ties to antd, because antd's styles are injected last
antd v5 writes its component CSS into `<style>` tags **at runtime**, after the app's own stylesheets
have loaded. Equal specificity therefore goes to antd, not to you, and the rule you wrote does
nothing at all — no warning, no override marker in devtools unless you look for the winner.
**Seen in:** `.app-sidebar--rail .ant-menu-item .ant-menu-title-content { display: none }` (three
classes) had zero effect; adding antd's own `.ant-menu-inline-collapsed` to the front made four and
it won. Measured 34px off centre before, 0px after.
**Rule:** when overriding an antd internal class, count your classes and make sure you out-specify
it — do not reach for `!important` first. **And check by effect, not by reading the CSSOM.**
Scanning `document.styleSheets` for the competing rule gave contradictory answers twice; injecting a
candidate rule and measuring what moved settled it in one try.

### analytics-web sets `colorPrimary` in two files, and `theme.ts` wins
`theme/tokens.ts` sets it in `lightTokens` / `darkTokens`. `theme/theme.ts` sets
`tokens.primary`, `providers.tsx` passes that as the brand, and `ThemeProvider` merges the
brand-built token **over** the tokens.ts one:
`token: { ...tokenOverrides.token, ...antdBaseTheme.token }`.
**So editing `tokens.ts` to change a rendered colour does nothing** — change `theme.ts` too, or the
value you edited is never painted. This cost a whole debugging pass once, when the readable green in
`tokens.ts` turned out never to reach the screen while the 2.54:1 one in `theme.ts` did.
**Do not read the brand colour from `buildTheme()`** when you mean the one on screen; a test written
that way asserted a failing ratio and got the unrendered value's 6.2.
Since 2026-08-14 both files carry `#326BFC` and `theme.ts` imports it from `tokens.ts` rather than
restating it, so they cannot drift apart again. The brand's three roles are still three separate
constants — `primary`, `primaryInk`/`primaryInkDark`, `primarySolid` (and `--rw-primary`,
`--rw-primary-ink`, `--rw-primary-solid` in `global.css`) — because a future brand may again need a
different value for text than for a fill.

### A report has TWO label chains, and exports use the one you did not fix
`presentation/labels.ts` (`useColumnLabel` / `resolveColumnLabel`) is what the **screen** shows.
`result.columns[].label` is what the **engine** produced — `push(key, m.label ?? key, …)` in
`query/engine.ts` — and it knows nothing about human overrides or composition.

Six consumers read the engine's one and never touch the hook: `features/export/csv.ts`,
`xlsx.ts`, `pdf.ts`, `presentation/renderers/KpiRenderer.tsx`, the Ask-AI KPI row in
`AskAiBuilder.tsx`, and `api/executeApi.ts`. So a series renamed on a chart still came out of Excel as
`sum_amount`: the picture said one thing and the spreadsheet another, with no error anywhere.

**The exporters are plain functions and cannot call a hook**, which is why `resolveColumnLabel` exists
as a non-hook form. Resolve at the **boundary** — `features/export/useExportResult.ts` rewrites
`columns[].label` once and hands that on — rather than threading a locale through three signatures.
**When you change how a label is derived, grep for `columns[].label` as well**, or half the app will
disagree with the other half.

### `PageHeader`'s `title` wraps whatever you give it in an `<h3>`
Pass a node that renders its own heading — an `EditableLabel`, say — and you get a heading **inside** a
heading. Invalid DOM, and `getByRole("heading")` starts throwing *"found multiple elements"* in every
existing test that touches the page, which is how it announces itself. Use `titleNode`, which replaces
the heading outright. Same shape of trap for any `title`/`label` prop that wraps.

### The mock user is a `PowerUser`, so role-gated UI vanishes in dev and in tests
`auth/mock-user.ts` defaults to `["PowerUser"]`. Gate a control on the report-editor roles and it
disappears locally with no explanation — and every existing test that clicks it fails with *"Unable to
find an accessible element…"*, which reads like a broken selector rather than a working guard.
**Set the role explicitly in tests** (`setMockUser([...])` before render; note `resetMockDb()` clears
`localStorage`, so set it *after*). `features/viewer/can-edit.ts` and
`features/dashboards/can-manage.ts` are the two predicates; both deliberately mirror a route's
`RequireRole` list, and **neither is `reports:write`** — `PowerUser` and `DashboardDesigner` hold that
permission and the editor routes admit neither.

### antd Typography `editable` fires `onChange` TWICE for one edit, and saves on blur
All measured against antd 5.29.3, not read off the docs.

**`onChange` is a "commit attempt", not a change event.** It fires on Enter, on blur, AND on
click-away — and **Enter followed by a blur fires it twice**: `onChange → onEnd → onChange`. Wire a
network save straight to it and one rename becomes two requests. Proven: removing the guard in
`EditableLabel` turns its test into *"expected 1 times, but got 2 times"*. Keep an `inFlight` **ref**
(not state — both attempts can arrive before React re-renders).

**Escape does not disarm the save.** It fires `onCancel` only, never `onChange`, and it does **not**
revert antd's internal draft — so if the editor is left mounted, the blur that follows commits the
text the user just abandoned. `onCancel` must close the editor immediately.

**Controlled `editing` does hold the editor open** across an async save (the prop wins inside
`useMergedState`), which is the only way to survive a save that can fail. But **closing is
destructive**: `editing: false` unmounts `Editable`, whose draft re-seeds from the `text` prop on the
next mount. Never close on failure or the user's typing is silently gone while the old label sits
there looking saved.

**While editing, the pencil trigger is not rendered at all** — antd replaces the whole element. So a
spinner passed as `editable.icon` is invisible during exactly the moment it describes, and the trigger
remounts when editing closes, which makes a later icon change look frozen. Put progress state in your
own markup beside the label. (`editable.enterIcon` does accept a node and renders inside the editor,
if you want it there instead.)

**Other measured limits:** there is no supported way to disable or make the textarea read-only during
a save — not `disabled` on the Title, not a `<fieldset disabled>` wrapper, not setting `node.readOnly`
(which sticks but still saves). `onStart` is only called from antd's own trigger. `onEnd` fires on
Enter **only**, never on blur, so it is not an "editing finished" hook. antd already trims and strips
newlines before `onChange`. Modified Enter (shift/ctrl/alt/meta) is ignored.

**The element changes tag in edit mode:** an `<h3>` becomes a `<div>`, so `getByRole("heading")`
silently stops matching mid-test. Assert on text, not role, for anything editable.

### `userEvent.keyboard("{Enter}")` has keyCode 0, so antd never sees it
antd's `Editable` confirms on **keyUp**, gated on `keyCode === KeyCode.ENTER` and on the preceding
keyDown having recorded the same code (`antd/es/typography/Editable.js:57-85`). Measured: user-event
delivers `{"key":"Enter","keyCode":0,"which":0}`, which never satisfies that check. The symptom is a
save that never fires and an editor that never closes — which reads exactly like a broken component.
**Fix:** drive the events directly — `fireEvent.keyDown(el, { keyCode: 13 })` then
`fireEvent.keyUp(el, { keyCode: 13 })`. Escape needs `keyCode: 27`. Better still, test the **blur**
path, which needs no keyCode, is a real user action, and is the one that has actually been verified in
a browser.
**Applies to any rc-* component that gates on `keyCode`**, not just Typography.
**Still open, do not assume:** whether a *physical* Enter confirms in a real browser is **unverified**.
`keyCode` is deprecated but browsers do populate it, so it ought to work — that is an inference from
the spec, not a measurement. The in-app browser could not settle it either: its `key` action delivered
**zero** keydown/keyup events to a focused textarea (measured with listeners attached), so the Enter
path has never been exercised by a real keypress in this project. Confirm by hand before relying on it.

### A CSS shorthand you grep for may not be the shorthand that ships
`inset: -14px` in the source comes out of the Vite build as
`top:-14px;right:-14px;bottom:-14px;left:-14px`, so `grep "inset:-14px" dist/…css` returns **0** on a
perfectly good build. Grep the built asset for the **selector** and read what follows it, rather than
searching for the declaration you wrote. Same lesson as the bundle-hash check: verify the artifact,
and know what the artifact actually looks like.

### `echarts.init(el)` with no theme silently ships ECharts' palette, not yours
recharts and ECharts are not the same kind of library and the difference decides where colour lives:

| | colour template? | consequence |
| --- | --- | --- |
| **recharts** | **none** — no theme, no palette config | every colour is a prop on every element (`fill`, `stroke`, one `<Cell>` per slice). Hardcoding is forced. |
| **ECharts** | **yes** — `echarts.init(el, theme)` takes a name *or a plain object* | omit it and you get ECharts' own defaults, with no error |

**Symptom:** a chart looks like a different product and ignores dark mode, while every other chart
is fine. **Cause:** a bare `echarts.init(ref.current)`. ECharts then supplies its palette (five of
its nine colours miss 3:1 on white; its yellow is **1.56:1**), `#333` body text — **1.31:1** on our
dark panel — and a blue-to-red heatmap ramp. A palette change never reaches such a chart.
**Fix:** use `useEChart` (`components/charts/useEChart.ts`), which applies `echartsTheme(mode)` from
`theme/echarts-theme.ts`. `echarts-for-react` takes the **same object** as its `theme` prop and
deep-compares it, so building it per render is fine.
**Two things that are easy to get wrong:**
- **`themeMode` must be in the effect's dependency list.** A theme binds at `init` and cannot be
  changed on a live instance — following light/dark means dispose and re-init, or the chart keeps
  light-mode axis text on the dark panel.
- **ECharts has four separate axis theme keys** — `categoryAxis`, `valueAxis`, `logAxis`,
  `timeAxis`. Theme one and a chart that switches axis type loses its colours with no warning.
**And check the dead ones:** `buildEChartsTheme` sat in `theme.ts` for months called by nothing but
its own test, which made the code read as if ECharts was centrally themed when it was not. Before
trusting a theme helper, grep for its callers.

### Dark mode in analytics-web has SIX grounds, so one contrast measurement proves nothing
A colour checked against one dark panel passes your test and still fails a reader, because the app
paints six different dark backgrounds from two different places:

| token | hex | set in |
| --- | --- | --- |
| `--rw-bg` | `#0b0f14` | `applyCssVars` (`theme.ts`) |
| `--rw-surface-1` | `#111827` | `applyCssVars` |
| **`--rw-surface-2`** | **`#1f2937`** | `applyCssVars` — the **Table header**, and the lightest |
| `colorBgContainer` | `#15211d` | `darkTokens` (`tokens.ts`) |
| `colorBgLayout` | `#0e1513` | `darkTokens` |

**Seen:** a lifted brand blue solved against `#15211d` read **5.03:1** there and **4.456:1** on the
`#1f2937` table header — under AA, with a green test. Re-solving against all five at once moved it
one step. The same split is why chart series need checking on more than one ground: the dashboard
widget draws on `#15211d`, the report viewer on `#0b0f14`.
**Rule:** `#1f2937` is the lightest, so it decides. Solve against the whole set, and make the test
iterate the list (`DARK_GROUNDS` in `theme/tokens.test.ts`) rather than naming one shade.
**Also:** the light values in `SERIES_LIGHT` are solved to ~3.15, not 3.0 — landing on 3.005 passes
`>= 3` and still loses to hex rounding, an anti-aliased edge or a 1px stroke.
**And a mark is not text:** WCAG asks **3:1** for a bar or a slice, 4.5 for a word. Four of the six
brand hues clear 3:1 on the dark grounds and fail on white (yellow reads **1.71:1**), which is why
`chartColors(mode)` returns two different lists.

### If antd has a prop for it, use the prop — do not override its CSS
Following on from the tie above: sometimes you cannot win the tie at all. `Input`'s font size comes
from a rule that out-specifies a two-class selector, so `.dash-hero__actions input { font-size:
16px }` did nothing — while a `min-width` rule **in the same media block** applied fine, which is
what makes this so easy to misread as "my CSS is not loading". `size="large"` fixed it in one line,
because that *is* antd's 16px input.
**Rule:** check for a prop (`size`, `variant`, `styles`, a theme token) before writing a rule that
targets an `ant-*` class. A rule that silently does nothing is worse than no rule — the next person
reads it and assumes the case is handled.
**Why 16px matters:** any input under 16px makes iOS zoom the page on tap and never zoom back.

### 45% alpha is too little for text — and antd uses it by default
`--ant-color-text-tertiary` is `rgba(0,0,0,0.45)` in light and `rgba(255,255,255,0.45)` in dark.
Blended onto the panel it is **3.35:1** and **4.39:1**. Both miss the 4.5 that normal text needs, so
anything antd paints with it fails AA out of the box. Caught three times now:
the sidebar divider (1.19:1), a mixed-down border that only reached 1.85 **because the token it was
mixing was already translucent**, and the `Descriptions` row label.
**When a colour is translucent, a percentage mix of it is translucent too** — mixing 55% of a 45%
grey gives you a 25% grey, not a darker one. Go one step up the scale instead:
`colorTextSecondary` is 65% — the same hue, **6.98:1** light and **7.67:1** dark.
**Measure blended, never raw.** `getComputedStyle(el).color` returns `rgba(0,0,0,0.45)`; a contrast
helper that treats that as a solid colour reports 1:1 or 21:1 and tells you nothing. Composite it
onto the first ancestor with a non-transparent background first.
Set it through the component token (`components: { Descriptions: { labelColor } }`), not CSS — see
the two entries above for why a CSS rule loses.

### «left»/«right» in a chart library is TWO questions, and a grep cannot tell them apart
For a **horizontal** legend (or a `visualMap` strip) it means *which end the items start from* — the
reading edge, so `right` in RTL. For a **vertical, side-mounted** legend it means *which side the
legend sits on*, and the chart takes the other — so `left` in RTL. **Opposite answers.**
Recharts' donut was handed the horizontal legend's constant and put its legend on the right in RTL
**and** on the left in LTR: wrong in both directions, for as long as the legend existed.
Then, diagnosing `EChartsRenderer`, a grep for the same ternary "found" the same bug — and was wrong,
because that legend is horizontal and was already correct. **Read the legend's orientation before
judging its anchor.**

**The deeper fix was to stop asking.** Recharts also measures the two things differently: a `Pie`'s
`cx="68%"` is 68% of the *plot area* (what is left after the legend) while a raw `<text x="68%">` is
68% of the *whole SVG*, so one number lands in two places and the centre label misses the hole. The
donut now lays itself out — a flex row with a fixed square for the ring and an `<ul>` for the legend.
A flex row follows `dir` on its own, so RTL needs no prop, the total is centred by construction, and
the gap is a `gap` rather than leftover space.

### The report filter bar must respect the OPERATOR, not just the field
`FilterBar` rendered one control per `definition.filters` entry and keyed it off the field's *type*.
A `between` carries **two** bounds, so one input replaced both with a single string and left half a
range — which `BETWEEN @p0 AND NULL` answers with no rows and no error. Every year-filtered report
came back empty, silently, until the engine started refusing a half range and it became
«خطا در بارگذاری گزارش». **The error did not cause the bug; it revealed one that had always been
there.** Expect that whenever a silent wrong answer is turned into a loud one.

Two rules fall out: an emptied filter means **do not filter**, not `col = NULL` (which matches
nothing); and the bar must render every filter the report *defines*, not the pruned list actually
being queried — otherwise clearing a filter deletes its own control and there is no way to type
again.

### A local fixture can fail in exactly the way you are hunting
Reproducing the above needed a `between` filter in the seeded mock data. The first one pointed at
`orderDate` on a report whose dataset is `projects`, where that field does not exist — so the page
showed the very error being investigated, *before anything was typed*. **Confirm a reproduction
fails for the reason you think**, or a broken fixture reads as a confirmed bug.

### A 0×0 browser tab answers every geometry question with rubbish
A freshly opened preview tab reported the ring on the wrong side, a **negative** gap, and sideways
scroll — in all four direction/theme combinations identically, which was the tell. `window.innerWidth`
was **0**: the tab had never been laid out. `resize_window` to a real size gave the true numbers.
**Read `window.innerWidth` before believing any layout measurement**, and treat "every variant is
identical" as a symptom, not a result.

### The dev server can serve a STALE transform, and it looks exactly like a real bug
**Symptom:** a runtime `ReferenceError: X is not defined` for a symbol that is plainly imported in the
source. `npm run build`, `tsc` and the whole test suite are green. A fresh browser tab still fails, so
it does not look like HMR debris either.
**Cause:** Vite's module graph missed a file rewrite. Editing files with an external tool — a Python
script rewriting the whole file rather than an editor patching it — can slip past the watcher, and the
server keeps serving the transform it cached earlier. The served module is a genuinely older version
of the file.
**How to confirm in one step:** fetch the module and read what the server is actually sending —
`fetch('/src/path/File.tsx?t='+Date.now()).then(r=>r.text())`. If the import line is missing there but
present on disk, it is the server, not the code.
**Fix:** restart the dev server. Not a hard reload, not a new tab — the stale copy lives in the
server's graph, so both of those still get the old module.
**Why it matters:** the instinct is to trust a fresh tab. Twice this session a genuine "it is only HMR
debris" turned out to be right, so the third case looked like the same thing and was not.

### A renamed report shows its new name only where somebody remembered to resolve it
**Symptom:** rename a report on its own page, and `/reports` still lists the old name. It looks like
the rename did not save. It did.
**Cause:** renaming writes `titleOverrides[locale]` and deliberately leaves `definition.name` alone —
`name` is the neutral original the server keeps in its own column, and the fallback for a reader in a
language nobody renamed it into. Every screen that shows a report name has to ask
`resolveReportTitle(def, locale)` for it. Anything reading `definition.name` shows the old one.
**Where this bit:** the library table, its **search** (typing the title you can see returned nothing),
its sort, the **phone card list**, the drill breadcrumb — which sat directly under a heading already
showing the new name — the add-widget picker, and any widget without a title of its own.
**Rule:** `definition.name` is storage, not display. If it reaches the screen, it is a bug.
**Where:** `presentation/labels.ts` has both `resolveReportTitle` (plain) and `useReportTitle` (hook).

### Saving a report DROPS every field the DTO does not declare
**Symptom:** a property you put on a report definition in the browser is simply not there when the
report is read back. No error, no warning — and it works perfectly in mock mode, because the mock
stores the object you handed it.
**Cause:** `SaveReportCommandHandler` stores `JsonSerializer.Serialize(request.Definition)` — the
**typed** `ReportDefinitionDto`. The incoming JSON binds to that DTO, unknown members are ignored,
and the re-serialised copy contains only what the DTO declares.
**Notably missing:** `presentation`. So `presentation.views` never survives the API, which is why
every production report re-derives its views through `chooseView`, and why a custom report — which
IS a definition with `views[0].library === "custom"` — cannot be created in production at all.
**How to check:** `GET /api/Reports` and look at `Object.keys(definition)`. Anything absent there is
being dropped on save, not on read.
**Before adding a field to that DTO:** `ReportViewer` *prefers* `presentation.views` when non-empty,
so persisting views changes behaviour for every report that is ever re-saved — it freezes whatever
auto-viz picked instead of re-deriving it.

### A custom report is the escape hatch for anything the query engine cannot express
**When you need it:** the data is a stored procedure, or the result is one wide row whose dimension
lives in its column names, or the parameters are procedure arguments rather than column filters.
`SqlQueryEngine` builds `SELECT … FROM [table] … GROUP BY …` and does none of those — and neither can
Ask AI, which emits `ReportDefinition`s for that same engine.
**How:** register an entry in `presentation/custom/registry.ts` and save a definition with
`library: "custom"`, `component: "<id>"`. Parameters go in **`view.options`**, not `view.mapping` —
`ViewMapping` is a fixed set of chart bindings with no index signature.
**The part that bites:** a custom report has **no `QueryResult`**, and far more code assumes one
exists than you will find by reading. `ReportViewer` needed four exemptions (the execute effect, a
*second* `!semantic` check in the render guard, `result.total === 0`, and `FilterBar`) and
`WidgetFrame` five (the query, the views memo, `loading`, the switcher, the three export buttons).
**`loading` is the sneaky one:** a **disabled** react-query reports `isLoading` forever, so a widget
spins permanently rather than erroring.
**Where:** `docs/design/2026-08-15-custom-reports-engineer-quota.md` has the full reasoning.

### react-grid-layout invents a layout, then hands it back for you to save
**Symptom:** every widget on every dashboard renders tiny — 159x40 — while the layout stored in the
database is perfectly correct. Which is what makes it read as a rendering bug, and it is not.
**Cause:** RGL assigns `w:1, h:1` to any child it has **no layout entry for**, and reports that
through `onLayoutChange` like any real change. The page starts at `useState([])` and fills the layout
when its query resolves; in that gap every child is an unknown child, so RGL's invention is written
back into state *before the real layout is ever applied*.
**Fix:** `if (layout.length === 0) return;` in `onLayoutChange` — never save a layout you did not
receive. `dashboard/DashboardCanvas.tsx`.
**Why the existing guard missed it:** the `colsRef` check beside it defends a *different* squeeze — a
narrow screen reporting its derived layout — and fires on `onBreakpointChange`. On first paint there
has been no breakpoint change, so `12 === 12` and the invention passes.
**How to tell quickly:** log the `layout` prop and `onLayoutChange` together. Three plausible theories
(stale `WidthProvider` width, column clamping, a missing per-breakpoint `layouts` entry) all survive
reasoning and all die in one console line.
**Also worth knowing:** `WidthProvider` measures the **container**, not the viewport. With a sidebar,
a 1038px window gives a ~678px grid, which is the `xs` breakpoint — so a normal laptop renders the
4-column derived layout, not the 12-column design.

### A canvas chart is not in the accessibility tree at ALL — not even as an image
**Symptom:** none, on screen. `read_page` on a report showed the tree ending at the last toolbar
button with **no node for the chart**. Not an unlabelled image, which a screen reader announces as
"image": absent. The page's whole point, missing, and WCAG 1.1.1 failed.
**Cause:** ECharts paints axis labels, the legend and every value onto a `<canvas>`. Under recharts
they were SVG `<text>` and happened to be readable; the migration took that away as a side effect
nobody would see.
**Fix:** every chart renders a visually-hidden `<table>` of its data beside the canvas, and the
canvas is `aria-hidden`. Built inside the option memo from the same variables the series are built
from, so the text and the picture cannot disagree.
**Why not ECharts' own `aria: { enabled: true }`:** it puts `role="img"` plus a generated sentence on
the container, from **English** templates — every one needs translating before it says anything in
Persian — and even then it is a summary, not the data.
**Two traps in the hidden table itself:**
- `.sr-only` pins width to 1px and **a `<table>` ignores it** — the table layout algorithm treats
  `width` as a floor. The bare table measured 251x149 and sat absolutely positioned over the page.
  Wrap it in a `<div class="sr-only">`.
- Use visually-hidden, never `display: none` — that takes it back out of the tree and undoes the fix.
**Where:** `presentation/renderers/EChartsRenderer.tsx` (`ChartDataTable`), `theme/global.css`.
**Drill-down works from that table too**, since a canvas click has no keyboard equivalent. Three
things that had to be right:
- **A roving tabindex, not a tab stop per row.** Eleven categories in one report, six widgets on a
  dashboard: per-row stops would put sixty extra entries in the page's tab order.
- **The panel must become visible while focused** (`:focus-within`). A focusable control inside a
  permanently hidden box is a trap for *sighted* keyboard users.
- **Only offer the control where a drill will really happen.** Both consumers build the child with
  `buildDrilldownDefinition`, which throws without `def.drilldown` and is caught as a silent skip. On
  the mouse path that dead end is invisible; a button announced as «جزئیات تهران» is a promise.

### A guard written as `x && x !== "wanted"` lets the case with no `x` straight through
**Symptom:** a heatmap bound a chart click handler it should never have had, read `dataIndex` against
the wrong list, and drilled to an unrelated category — usually nothing, occasionally a real but wrong
report.
**Cause:** `if (meta.rwKind && meta.rwKind !== "bar") return undefined;`. The heatmap branch sets no
`rwKind`, so the `&&` short-circuits and the guard never fires. The `x &&` was there to tolerate a
missing value and instead inverted the rule for exactly that case.
**Fix:** `if (meta.rwKind !== "bar") return undefined;` — state the allowed value, do not enumerate
the disallowed ones.
**Where:** `presentation/renderers/EChartsRenderer.tsx`, the `events` memo.

### A chart index is NOT a data index — drill-down opened the wrong report for months
**Symptom:** clicking a bar drills into a different category than the one clicked. Silently: the
child report is real and renders fine, it is just the wrong one.
**Cause:** the renderer did `groups[clickedIndex]`. `groupNodes` is built while the engine collects
rows (`query/engine.ts:576-580`), and the rows are **sorted at :585 and sliced at :588-589** — after.
The two lists stop being parallel the moment anything reorders or drops a row, and `ai/rules.ts:118`
adds a sort to nearly every Ask-AI report, so this was the common case rather than an edge one.
Aggregating duplicate categories and dropping nulls shorten the chart relative to `groups` too, but
they are not the cause.
**Fix:** match on the category VALUE — `resolveDrillTarget` in
`presentation/renderers/drill.ts`.
**How to check it bites:** add a plain sort to the fixture. With no nulls and no duplicates at all,
three bars still drilled to three wrong groups.

### `mapping.y` beats `mapping.measure`, so a dimension in `y` is plotted as a value
**Symptom:** a chart of all-zero bars, with a legend naming a *dimension* («استان» / "Province").
No error, no warning, and every unit test green.
**Cause:** `seriesKeysOf` reads `mapping.y` first and only falls back to `mapping.measure`. A view
that sets both — as `auto-viz`'s matrix rule did, with the second dimension in `y` — plots the
dimension column. `Number("Tehran")` is NaN, and ECharts draws NaN as zero.
**Fix:** a view names its measure in exactly one place. The matrix rule now emits
`{ x, series, measure }` and no `y`.
**Related:** the heatmap branch needs **both** `mapping.series` and `component === "heatmap"`. Set
one without the other and it falls through to the cartesian path, where an unrecognised component
string silently defaults to `bar`.
**Where:** `presentation/auto-viz.ts` rule 5, `presentation/series-keys.ts`.

### A chart library paints legend TEXT in the series colour, and the engine names a column after its alias
**Legend colour.** Series colours are chosen so slices can be told apart as *fills* — a much lower
bar than being readable as 12px words. Measured on the dark panel: blue **2.54:1**, deep green
**2.67:1**, against a floor of 4.5. The dot already carries the colour, so paint the words in the
normal text colour. A colour that works as a fill does not automatically work as text — the third
time that has bitten this app, after the brand green and the 45% tertiary token.

**Column names.** `ResolveColumns` labels a metric with its own alias, so charts and table headers
showed literally `sum_amount`. The parts of a real name are elsewhere: the definition knows it is a
`sum` of `amount`, the semantic model knows `amount` is «درآمد», and i18n knows `sum` is «مجموع».
`presentation/labels.ts` joins them; anything displaying a column key must go through it.
**Compose before honouring a label stored on the report** — a stored label is one fixed string with
no language, so preferring it left an English reader looking at Persian.

**Also:** never sniff a view's component string with `includes("bar")`. There were three such ladders
— in `findViewForTarget`, `ViewSwitcher` and `WidgetFrame` — ending in three DIFFERENT fallbacks
(line, bar, bar), so one view showed a different pressed button depending on the screen. They now all
go through `targetOfView`, which returns **undefined** when a view has no button of its own (a
heatmap). Pass `NO_TARGET` to antd's `Segmented` in that case: it reads `undefined` as "the first
option" and lights «جدول».

**Also:** the view switcher can only select a view that EXISTS, and `chooseView` returns just the one
it picked plus a Table. Any switcher must therefore *build* the view it is asked for
(`presentation/view-switching.ts`), or its buttons silently fall back to the primary view — which is
how «خطی» and «KPI» sat there enabled and doing nothing on `/reports/:id` for months. A KPI renders as
a Card, not `ant-statistic`, so a check looking for `.ant-statistic` wrongly reads as broken.

### A frozen CSS transition will lie to `getComputedStyle`
An element reported `width: 240px` while its own inline style said `80px` and no rule overrode it.
The cause was not CSS: the browser pane was not displayed, so no frames were composited, so the
0.2s width transition never advanced — and `getComputedStyle` returns the *current animated* value.
**Before believing any measurement of a size that animates**, pin transitions off:
`*,*::before,*::after{transition:none!important;animation:none!important}`. The same trap applies to
anything measured right after a class change, even on a visible page.

**Same file, same day:** `react-grid-layout` fires `onBreakpointChange` on the line directly above
the `onLayoutChange` that carries a re-generated layout, while `onWidthChange` fires *after* it. If
you need the new column count before deciding whether to trust a layout, only `onBreakpointChange` is
early enough. And if you store one layout per dashboard, never write back what a narrow screen
renders — the library squeezes 12 columns into 4 and reports the squeezed copy as if you made it.


### AntD's own secondary text FAILS contrast on a light theme
`colorTextSecondary` is 45% black, which composites to 3.36:1 on a white card — under the 4.5:1 that
normal text needs. On dark it is 4.50:1: passing, with nothing to spare. Every `type="secondary"`
subtitle, card meta row and form hint inherits it, so the whole app fails together and nothing looks
obviously wrong. Set it from your own palette in `buildTheme`. **`colorTextDescription` does not
follow it** — that is the one a `Form.Item`'s `extra` uses, and it needs setting separately.

### AntD's focus ring is nearly invisible on a dark theme, and it outranks your rule
`.ant-btn:focus-visible` draws its outline in `colorPrimaryBorder`, which the dark algorithm derives
as `#1D2E5A` — a navy on a near-black ground. Worse, that selector beats an unqualified
`*:focus-visible`, so a global ring loses **silently**: the rule is in the stylesheet, it just never
wins. A visible focus ring is an accessibility floor, so this is the one place `!important` earns its
keep. Verify by pressing Tab for real and reading `outlineColor` — `el.focus()` from JS does not
match `:focus-visible` and will tell you the ring is `none`.

### An AntD component's own style beats your class, because AntD injects its CSS AFTER yours
A borderless `<Card>` sets `box-shadow` from a rule with two-class specificity; `.my-card` has one
and loses. Matching the specificity does not help either — AntD's `<style>` is inserted at runtime,
*after* the bundled stylesheet, so a tie goes to AntD. Put the value in the `style` prop. The same
applies to `colorBgContainer`: on dark, AntD paints every card, table and modal `#141414`, so a
palette with a blue-biased ground shows two different dark themes on one screen until the token is
set.

### LiveKit's components are dark by their own stylesheet
`@livekit/components-styles` ships a dark theme with no light variant. A meeting screen that follows
the app theme therefore wraps **white chrome around a dark video grid** in light mode. Force the
meeting dark in both themes — a nested `<ConfigProvider>` covers AntD, and a class added to the
existing `html[data-theme="dark"]` selector list covers everything hand-written.

### A room in this app never closes, so `canJoinNow` is true forever
`Room.IsOpenAt` is `IsActive && !IsDeleted && now >= OpensAtUtc` — there is no upper bound — and
`GetMyRoomsQuery` applies no date filter. A meeting from last month therefore arrives with
`canJoinNow: true`, and any UI that reads that as "live" will say «در حال برگزاری» about it.
Keep the two questions apart: `canJoinNow` answers *may I go in*, and the schedule
(`room-web/src/lib/schedule.ts`) answers *is it now*. Both can be true at once.
