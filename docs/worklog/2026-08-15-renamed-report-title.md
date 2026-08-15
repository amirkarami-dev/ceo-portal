# A renamed report kept its old name everywhere except its own page

- **Date:** 2026-08-15
- **Area:** analytics
- **Branch / commits:** `main`
- **Status:** fixed, not deployed

## Goal

Reported from production: report 5 was renamed on its own page from «مجموع متراژ درگیر در ظرفیت به
تفکیک صلاحیت مهندس» to «مجموع متراژهای ثبت شده در ظرفیت به تفکیک صلاحیت», and `/reports` went on
showing the old name.

## Root cause

Not a save failure — the rename saved correctly. It writes `titleOverrides[locale]` and deliberately
leaves `definition.name` alone, and the comment in `ReportViewer.tsx` explains why:

> *`name` stays the original: it is what the server keeps in its own column and what the library list
> sorts and searches on, and overwriting it would push one language's wording onto every reader.*

That decision is still right. What was missing is the other half: **the library list read
`definition.name` directly and never asked for the override.** So a rename was saved, and then
ignored by the one screen most likely to be looked at next.

`resolveReportTitle(def, locale)` already existed and already did the resolution — the viewer used it,
nothing else did.

## What changed

Five places now resolve the title instead of reading `name`:

| where | why it mattered |
| --- | --- |
| library table | the reported bug |
| library **search** | filtering on `name` while showing the override meant typing the title you can see returned nothing |
| library sort | so the order matches the column being looked at |
| library **phone cards** | the same list; fixing only the desktop table would be half a fix |
| drill breadcrumb | the heading directly above it already showed the rename, so it contradicted itself on one screen |
| "add widget" picker, and a widget with no title of its own | a renamed report kept its old name on every dashboard |

## Decisions

- **`name` still is not overwritten.** The original design holds: `name` is the neutral value the
  server keeps in its own column and the fallback for a reader in a language nobody has renamed it
  into. Only the *display* changed.
- **Search and sort follow the display.** Three reads of `name` in one component, and fixing only the
  visible one would have produced a subtler version of the same complaint: "I can see it but I cannot
  find it."
- **Fixed the four other screens too.** They are the same bug in different places; leaving them would
  produce this report again next week.

## Verification

**721 tests across 88 files** (up from 718), lint, typecheck and build clean. Three new tests. Both
halves bite: putting the render back to `definition.name` fails two, putting the search back fails one.

In a browser, with an override saved exactly as a real rename leaves it: the list shows the new title
in Persian and in English, searching «متراژهای ثبت شده» finds it, the phone cards show it, and a
report nobody renamed is untouched.

**Not verified end to end through the UI.** Driving antd's inline editor with synthetic events did not
save — the title changed on screen but no override reached storage. That is the automation failing,
not the feature: the reported case already has the override saved, so the fix was verified against
that exact state instead. Renaming by hand and watching the list is worth one check.

## Follow-ups

- Deploy — this is on `main` and not yet released.
