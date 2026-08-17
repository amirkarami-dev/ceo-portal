# The published climate class (پیوست ۲) now shows beside «کد اقلیم»

- **Date:** 2026-08-17
- **Area:** mabhas19 (web + assessment-core)
- **Branch / commits:** `main`, uncommitted at time of writing
- **Status:** built, tested and checked live on the local stack; **not deployed**

## Goal

*"also show the appendix in «کد اقلیم»"* — asked right after *"are you do according this pdf"* about
`docs/mabhas19/پیوست2-ویرایش-پنجم-مبحث-نوزدهم-مقررات-ملی-ساختمان.pdf`. The answer to that was **no**,
so the follow-up is to put the document's own value on screen next to the one the app uses.

## The finding behind it

The appendix is «دسته‌بندی اقلیمی شهرهای ایران»: **76 stations**, one column «رده اقلیمی», and its
closing note names the basis — **ANSI/ASHRAE 169-2020** over ten years of Iranian Meteorological
Organization data, with more stations to be added later.

The app's zoning is a different system: six codes `1, 2, 3A, 3B, 4, 5` with Persian names, inherited
from the legacy `climate.js` and carried in two mirrored copies (`packages/assessment-core` for the
front end, `src/Domain/Services/ClimateData.cs` for the PDF). Comparing them over the 31 cities the
project form offers:

| | count |
|---|---|
| different class in the appendix | **25** |
| same string | 5 (کرج، تهران، شیراز، رشت، ساری) |
| not in the appendix at all | 1 (زاهدان) |

The five that match are a **collision of notation, not agreement**: `3B` is «چهارفصل و کم باران» in
the older scheme and warm-dry in ASHRAE 169. Worth stating plainly because five apparent matches
read like partial corroboration and are not.

Reading the PDF needed rendering: its Persian glyphs carry no Unicode map, so text extraction yields
the row numbers and the Latin class codes only. Pages were read as images and the class codes then
cross-checked against that text layer — both readings agree on all 76, which is why the transcription
is trustworthy without a second pair of eyes on every row.

## What changed

- **`packages/assessment-core/src/data/climate-appendix2.ts`** (new) — all 76 rows in printed order,
  row numbers in comments so the table can be audited line by line against the document, plus
  `getCityAppendix2Class()`.
- **`packages/assessment-core/src/index.ts`** — exported, with a note on why it is separate.
- **`packages/assessment-core/test/climateAppendix2.test.ts`** (new) — 8 tests.
- **`mabhas19-web/src/components/projects/project-form.tsx`** — a hint line under the «کد اقلیم»
  field.
- **`.../projects/[id]/project-detail-client.tsx`** — its own row under «کد اقلیم».
- **`mabhas19-web/messages/{fa,en}.json`** — `climateAppendix2`, `climateAppendix2Missing`.

Nothing in the scoring path changed. `climate.ts`, `ClimateData.cs` and every R/U/SHGC table are
untouched.

## Decisions

- **Display only, and in a separate file.** The class is shown *beside* the code, never substituted
  for it. Eight of the appendix's classes (`0B, 1B, 2A, 2B, 4A, 4B, 5B, 5C`) are not keys in
  `OPAQUE_BASE_R_BY_CLIMATE`, so feeding one to `getOpaqueTargetR` would miss the lookup and
  **silently** fall back to the `3B` base — a wrong requirement with no error. One test asserts
  exactly that, so the day someone wires the two together it fails loudly instead.
- **Its own row on the detail card, not merged into «کد اقلیم».** Two classifications that disagree
  for most cities must not read as one classification agreeing with itself.
- **`undefined` for a city the document omits, and the UI says «در پیوست ۲ نیامده است».** No nearest
  neighbour, no default: on screen a guessed class is indistinguishable from a published one.
- **Explicit aliases, two of them** — بوشهر → «بندر بوشهر», تهران → «تهران (مهرآباد)» (both Tehran
  stations are `3B`, so the pick cannot change an answer). Two auditable pairs beat a name-normalising
  rule nobody can check against the document.
- **No Persian names for the ASHRAE classes.** The document prints codes only; inventing «معتدل خشک»
  for `4B` would be my wording presented as the regulation's, which defeats the point of showing it.
- **`<span dir="ltr">` around the class.** A Latin code in RTL copy reorders otherwise; this is the
  app's existing convention (see `dashboard-client.tsx`, `project-card.tsx`).

## Verification

**Package:** 40 tests pass (8 new), `tsc --noEmit` clean for the package and the app,
`npm run lint` clean, `next build` exit 0.

**Live, on the local stack** (auth 5100 + api 5000 + web 3000), values read out of the DOM:

| city | «کد اقلیم» | «رده اقلیمی (پیوست ۲)» |
|---|---|---|
| اردبیل | 5 — خیلی سرد | `5C` |
| تبریز | 5 — خیلی سرد | `4B` |
| یزد | 1 — گرم و خشک | `2B` |
| بوشهر | 2 — گرم و مرطوب | `1B` (through the alias) |
| زاهدان | 3B — چهارفصل و کم باران | «در پیوست ۲ نیامده است» |
| no city | (empty) | line absent |

Project detail card, in both locales: «کد اقلیم = سرد» with «رده اقلیمی (پیوست ۲ ویرایش پنجم) = 4A»
for سنندج, and the English pair reads "Climate class (Appendix 2, 5th ed.) = 4A".

At **375 px** the hint is one line, 355 px inside a 355 px form, no overflow of its own.

A `MISSING_MESSAGE` error appeared while this was being built — the component was saved before the
message files, and next-intl had cached the old catalogue. Gone after a reload; a fresh load of
`/fa/projects` plus opening the dialog produces **no console errors** and no non-200 requests.

**Data left as found:** the detail-card check needed a project owned by the logged-in user (the two
existing rows belong to other `OwnerId`s and correctly 404), so one was created through the UI and
deleted again. `Projects` is back to its original two rows.

**Not verified / not done:** the generated **PDF report still carries the legacy code only** —
`ClimateData.cs` was deliberately not touched, so the appendix class appears in the web UI and
nowhere else. The assessment workspace header also still shows only the legacy code.

## Follow-ups

- **Moving the assessment itself onto the 5th edition** needs that edition's own requirement tables
  (R per zone for the ten opaque types, U-limits, the SHGC/PF table). This appendix carries the city
  list only. Open question for the user: is the assessment meant to follow the 5th edition, or is it
  deliberately on the older zoning because that is what engineers submit against today?
- **The three different fallbacks for a missing code** are still inconsistent — entity default `3B`,
  `getCityClimate` unknown city `4`, assessment page `4`, env report page `3B`. Same building, two
  requirements, 1.87 against 1.43.
- **Only 31 of the appendix's 76 cities are selectable**, all provincial capitals; کیش، قشم، سیرجان،
  کاشان، انزلی and the rest cannot be chosen at all.
- **Pre-existing, not from this change:** `/projects` scrolls ~54 px sideways at 375 px — the
  topbar's `ms-auto flex items-center gap-2` cluster (the email chip) overflows, and a decorative
  `-right-12` blob sits outside an un-clipped parent. Also `lib/api.ts:69` does `JSON.parse(text)`
  with no empty-body guard while its sibling `api-server.ts:19` has one; that produced a 500 on
  `HEAD /` while the API was down.
