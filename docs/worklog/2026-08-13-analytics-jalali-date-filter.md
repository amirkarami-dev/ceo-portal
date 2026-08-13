# The date filter is a Persian calendar now

**Date:** 2026-08-13
**Area:** `analytics-web` — `FilterBar`, providers, the KurdNezam model mirror, the Dockerfile
**Status:** **live** on analytic.myceo.ir

## The goal

Amir: the date filter should be a Persian date picker rather than a box you type into — the one
`walfare-web` already uses.

Typing «1405/03/17» by hand means knowing the exact format *and* the digits. `walfare-web` solved
this with **antd-jalali** (antd v5 pickers generated over dayjs + jalaliday), so it looks and behaves
native — RTL, fa_IR, theme tokens — with a Persian calendar panel.

## The value never leaves Jalali

The KurdNezam column is `nvarchar` holding Jalali text, so the picker reads and writes exactly the
string the filter already carries. Nothing converts to Gregorian and back — which is also why the
built-in AntD picker could not do this job: it has no year 1405.

## Which field gets a calendar is declared, not sniffed

`type` stays `"string"` — the engine compares the column as text — and `format.kind: "date"` is the
hint. Marked on `RegDate`, `ExpDate` and `LastWorkDate`.

Detecting it from the *value* instead was tempting and wrong: the picker would vanish the moment
someone cleared the box. A string field without the hint stays a plain box, and there is a test for
exactly that.

## Four things this needed, each found the hard way

**1. The Dockerfile installs standalone.** It copies `analytics-web/package.json` alone — no root
`package.json` — so the npm `overrides` I first wrote could never apply there. antd-jalali still
declares `react ^18` while both apps run react 19, so the image needs `--legacy-peer-deps`, exactly as
`walfare-web`'s Dockerfile already does *and says in a comment*. Reading the neighbouring app first
would have skipped an hour.

**2. `--legacy-peer-deps` also stops npm installing peers.** Not just relaxing the check. The next
build died with every test file losing `screen`, `fireEvent` and `waitFor` from
`@testing-library/react` — they are re-exports from `@testing-library/dom`, a **peer**, which existed
here because npm auto-installed it long ago and was simply absent in the image. Now declared
explicitly, which is worth having anyway: relying on a peer being auto-installed is relying on npm's
default staying the same.

**3. `JalaliLocaleListener` must sit INSIDE the `ConfigProvider`.** Placed above it the app compiled,
the pickers rendered, and they silently showed **Gregorian** — `1405/01/01` displayed as `2026/03/21`.
Nothing errored. Only reading the rendered value caught it.

**4. antd-jalali reaches into antd with an extensionless deep import**
(`antd/es/date-picker/generatePicker/generateRangePicker`). Vite adds the extension in dev and build —
the app is fine and the file is really there — but under Vitest antd stays externalised and that
specifier reaches Node's ESM loader, which will not. `server.deps.inline` and a resolve alias were
both tried; neither reaches an import made *inside* an externalised package. The package is stubbed
for tests, keeping the same string contract, so the unit tests still prove the wiring — which control
a field gets, and that a range keeps both bounds. The calendar panel is judged in the browser, the
only place a calendar can be.

## A failed build can still look like a successful deploy

The first attempt chained build → recreate → verify in one command. **The build failed and the
recreate succeeded anyway**, from the previous image: container healthy, HTTPS 200, everything green.
The only thing that gave it away was the bundle hash not changing.

`docker compose up -d --force-recreate` does not care that `build` just failed. **Never read health
and status as proof a deploy shipped — compare the bundle hash**, and prefer running the build as its
own step so a failure cannot be papered over by a healthy container.

## Verified

In the browser, on a filter over a Jalali field: two `.ant-picker` controls (no plain boxes), values
displayed as `1405/01/01`, placeholders «— از» / «— تا», no error. 418 front-end tests, lint and build
clean. Deployed `index-DRa2hYQy.js` → `index-Bn6I_wrR.js`, healthy, 200.

## Worth knowing

- **`1405/12/30` does not exist — settled, the prompt now says the 29th.** Esfand has a 30th only in
  a leap year. Checked rather than assumed, with dayjs + jalaliday:

  | Jalali year | Esfand 30 exists |
  | --- | --- |
  | 1403 | no |
  | **1404** | **yes** |
  | 1405, 1406, 1407 | no |
  | **1408** | **yes** |
  | 1409, 1410, 1411 | no |
  | **1412** | **yes** |

  The picker normalised `1405/12/30` to `1406/01/01`, so the box and the filter disagreed. The
  worked example and `RegDate`'s own description now end a year on `1405/12/29`, with the reason
  stated so the model does not round up again.

  **The cost, plainly:** in a leap year this omits Esfand 30. The alternative kept a date no calendar
  can display. Amir chose the 29th. If a leap year ever matters, the honest fix is a `startsWith`
  operator in the engine — a year prefix needs no end date at all.
