# The project form offers سنندج only, and starts on it

- **Date:** 2026-08-17
- **Area:** mabhas19 (web)
- **Branch / commits:** `main`, uncommitted at time of writing
- **Status:** built and checked on the local stack; **not deployed**

## Goal

*"for now i want filter to only show «سنندج (کردستان)» in city and default selected"* — asked with the
city select on the new-project dialog selected on screen. "For now" is the operative part: this is the
province the product is in use in, not a permanent narrowing of the domain.

## What changed

Only `mabhas19-web/src/components/projects/project-form.tsx`:

- `ALLOWED_CITIES` / `DEFAULT_CITY` — two constants at the top of the file, with the revert
  instructions in the comment above them.
- The option list is filtered through `ALLOWED_CITIES`, **plus the project's own city when it is not
  among them**.
- A new project starts on `DEFAULT_CITY`, which also fills «کد اقلیم» (`4 — سرد`) and the published
  class (`4A`) without a click.
- The «انتخاب شهر» placeholder now renders only when it is a real choice — more than one option, or
  nothing selected yet.

No data was touched. `M19_CITY_CLIMATE` still carries all 31 cities and every climate lookup still
answers for all of them; this is a gate on one dropdown.

## Decisions

- **A constant in the component, not an env var or a config table.** "For now" wants the smallest
  reversible thing, and one named constant with a comment is easier to find in six months than a
  deployment variable whose absence changes behaviour.
- **An existing project keeps its own city on the list.** Filtering it out would leave the select
  holding a value it has no `<option>` for, which renders **blank** — indistinguishable from "the city
  was lost". Projects created before this gate, or imported from the other system, must still show
  what they actually are.
- **The default applies to create mode only.** In edit mode the form keeps exactly what the project
  has, including nothing. Defaulting there would mean opening a city-less project and pressing save
  quietly assigns it a city nobody chose.
- **The placeholder disappears when there is one city.** With a default selected it would exist only
  to let someone empty a field that has no other value to offer.

## Verification

`npm run lint`, `tsc --noEmit` and `next build` all clean.

Live, read out of the DOM on the local stack:

| case | result |
|---|---|
| new project | one option, `سنندج (کردستان)`, selected; no placeholder |
| its climate | «۴ — سرد» and «رده اقلیمی (پیوست ۲ ویرایش پنجم): 4A», both filled with no click |
| saved | `POST /api/Projects` → 201, row stored as `سنندج` / `4` |
| a project whose city is outside the list | options become `شیراز (فارس)` + `سنندج (کردستان)`, شیراز stays selected, placeholder returns, climate follows to `3B` |

**How that last row was reached, honestly:** the natural route — store a project as شیراز and reopen
it — was not available. A direct `UPDATE` on the local DB was refused by the permission classifier,
and saving شیراز through the UI is impossible by design once the gate is on. Widening
`ALLOWED_CITIES` temporarily to save it did not work either, because **`PUT /api/Projects/{id}`
returns 400** (see below). So the branch was exercised by pointing `DEFAULT_CITY` at a city outside
`ALLOWED_CITIES` for one run: that feeds the same `initialCity` variable through the same `useMemo`,
with real rendering and no stubs. Both constants are back to `سنندج`, and the final state was
re-checked after reverting.

**Data left as found:** one project was created and deleted through the UI; `Projects` is back to its
original two rows.

## The bug this uncovered — editing a project has never worked

`PUT /api/Projects/4` → **400 Bad Request**, empty body, on an ordinary «ویرایش» save. Captured the
request the app itself makes rather than guessing at it:

```
{"title":"…","city":"شیراز","climateCode":"3B","totalArea":0,"floorCount":0,"unitCount":0}
```

`Projects.UpdateProject` starts with `if (id != command.Id) return TypedResults.BadRequest();`, and
the client sends `Partial<CreateProjectInput>` — **no `id`** — so `command.Id` binds to `0` and the
comparison can never succeed. Unrelated to this change; it fails for every project and every field.
`projectsApi.update` in `mabhas19-web/src/lib/endpoints.ts:32` is the one-line fix (`body: { ...input,
id: Number(id) }`), but it is somebody's decision whether the id belongs in the body or the route
check should go — so it is flagged, not fixed here.

## Follow-ups

- **Reverting the gate** is `ALLOWED_CITIES` in `project-form.tsx`. Nothing else.
- **The 400 on edit**, above.
- The `/import` path can still bring in projects with any city; it does not go through this form.
