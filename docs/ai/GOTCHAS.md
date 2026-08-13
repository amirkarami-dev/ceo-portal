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

**Related:** filters are `Value` **and** `Value2` for `between` — *not* a two-element array. An array
leaves `Value2` null, and `BETWEEN … AND NULL` matches no row: an empty report, no error. And the
`parameters` list a query returns always carries `@offset` and `@limit` on top of the `@p*` filters,
so "two filters → two parameters" is wrong.

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

### analytics-web has two brand greens, and the unreadable one wins
`theme/tokens.ts` sets `colorPrimary: "#0f6e56"` (**6.2:1** on white). `theme/theme.ts` sets
`tokens.primary = "#10b981"` (**2.54:1**), `providers.tsx` passes that as the brand, and
`ThemeProvider` merges the brand-built token **over** the tokens.ts one:
`token: { ...tokenOverrides.token, ...antdBaseTheme.token }`.
**So the readable green is never rendered**, and everything the brand touches as *text* fails AA.
Editing `tokens.ts` to fix a colour therefore does nothing — check `theme.ts` first.
**Do not read the brand colour from `buildTheme()`** when you mean the one on screen; a test written
that way asserted a failing ratio and got 6.2.
Where the brand colour has to be **read** rather than seen, use `primaryInk` (`tokens.ts`) or
`--rw-primary-ink` (`global.css`) — `#047857`, 5.48:1, same hue two steps down. Fills, bars and
markers keep the brand.

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
