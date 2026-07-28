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

### Jalali pickers: don't load a second `jalaliday`
`antd-jalali` extends dayjs itself. A second copy double-patches the prototype and breaks the
picker. Also **never call `d.calendar("jalali")` on a picker value** — `dayjs/plugin/calendar`
overrides that method and returns a string. Format directly.
**Where:** `walfare-web/src/components/ui/JalaliFields.tsx`.

### Dates from the organisation DB are already Jalali strings
`"1405/03/16"` must pass through untouched — never through `new Date()`, which would read it as
Gregorian year 1405. Only convert values that are actually Gregorian.
**Where:** `analytics-web/src/presentation/format.ts`.

### The app launcher exists five times
`src/layout/AppSwitcher.tsx` is byte-identical in all five SPAs. Change one → copy to all →
**rebuild all five**, or the panels you skipped keep serving the old list.

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
- **Docker `npm install` is strict about peers.** `walfare-web` needs `--legacy-peer-deps`
  (antd-jalali declares React 18; the app runs React 19).
- **Build one service at a time** — the box is 8-core / 15 GiB (measured 2026-07-27), but ~45 containers from other production stacks share it and only ~5 GiB is free. The "4 GB" figure in older notes described the retired `10.249.52.216` server.
- **Deploying the API is not enough.** A shared component (like the launcher) needs every SPA
  that embeds it rebuilt.
- **Never restart the shared Docker daemon or Traefik** — other production stacks run there.
