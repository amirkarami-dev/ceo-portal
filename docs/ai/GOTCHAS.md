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

- **NuGet is blocked on the dev machine.** Build and test .NET **on the server**, in the SDK
  container with the cached NuGet volume. See `OPERATIONS.md`.
- **Docker `npm install` is strict about peers.** `walfare-web` needs `--legacy-peer-deps`
  (antd-jalali declares React 18; the app runs React 19).
- **Build one service at a time** — the box has 4 GB and parallel builds get killed.
- **Deploying the API is not enough.** A shared component (like the launcher) needs every SPA
  that embeds it rebuilt.
- **Never restart the shared Docker daemon or Traefik** — other production stacks run there.
