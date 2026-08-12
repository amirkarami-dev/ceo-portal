# Dates read as dates, in the language the app is set to

**Date:** 2026-08-12
**Area:** analytics-web (`analytic.myceo.ir`)
**Status:** **live** — checked signed in, both languages

## What was wrong

«آخرین بروزرسانی» on a report showed the API's ISO string, printed verbatim:

```
2026-07-26T11:47:21.8869376+00:00
```

## The helper the module was missing

`format.ts` already had `formatDate` and `formatCategory`. `formatDate` answers *which day*; a
freshness stamp is really asked *when*, so `formatDateTime` sits beside them and keeps the time.

It does two things a bare `.toLocaleString()` does not:

- **Follows the app's language, not the browser's.** Switching the app to English switches the
  calendar, instead of showing a Jalali date to an English reader.
- **Shows the reader's own clock.** The API sends UTC and Tehran is three and a half hours ahead, so
  the raw value is never the time anyone there saw it happen.

| | |
| --- | --- |
| before | `2026-07-26T11:47:21.8869376+00:00` |
| fa | **۴ مرداد ۱۴۰۵، ۱۵:۱۷** |
| en | **26 Jul 2026, 15:17** |

## Two more of the same, fixed with it

- **The report library's «آخرین اجرا» column** reads «—» today only because nothing has run yet. The
  first run would have put the identical ISO string in the table.
- **The admin prompt-versions table** used `toLocaleDateString()` with no locale, which follows the
  browser rather than the app — an English reader on a Persian browser got a Jalali date.

## Checked

Six tests: no ISO string survives, RTL is Jalali and LTR is not, a time is present at all, a `Date`
works as well as a string, and rubbish comes back unchanged rather than as "Invalid Date".

On production, signed in, `/reports/1`: Persian shows **«۱ مرداد ۱۴۰۵، ۸:۰۰»**, and the English
toggle gives **"23 Jul 2026, 08:00"** under the label "Last updated" — so the calendar follows the
language rather than being pinned to `fa-IR`. **365 tests pass.**
