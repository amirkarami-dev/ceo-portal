# Kurdnezam: builder credit in the footer

**Date:** 2026-08-07
**Area:** kurdnezam-web
**Status:** live at kurdnezam.ir

## Goal

Add `© 2026 JAPRA. All rights reserved.` to the landing page footer, with `JAPRA` linking to
`https://japra.ir`.

## What changed

One file: `kurdnezam-web/src/components/Footer.tsx`, bottom bar.

The footer already had a copyright line, translated per language
(`footer.rights` → «© ۱۴۰۵ تمامی حقوق برای سازمان نظام مهندسی…»). That one belongs to the
organisation, so the JAPRA credit is a **second line under it**, not a replacement.

Three small decisions:

- **Not translated.** The company name and this wording are the same in every language, so the
  string is in the component rather than `i18n.tsx`.
- **`dir="ltr"`** on that line only. The page is RTL; without it, `© 2026 JAPRA.` renders with the
  full stop on the wrong side.
- **`©&nbsp;2026`** so the symbol and the year can never split across two lines.

Only the word `JAPRA` is the link, which is the usual shape for a builder credit.

## Verified

Live on kurdnezam.ir after deploying:

- renders as `© 2026 JAPRA. All rights reserved.`, non-breaking space present
- `https://japra.ir/`, opens in a new tab with `rel="noopener noreferrer"`
- the organisation's own copyright line is untouched above it
- contrast on the dark footer: **4.88:1** for the grey text, **8.52:1** for the link — both pass AA
  at 12px
- mobile 375px: no sideways scroll, the line does not wrap, the bar stacks and centres

## One thing checked and deliberately left alone

The `JAPRA` link's tap target is 38×18px, under the 44px rule this repo normally follows. Measured
the neighbours first: every inline text link in this footer is 16–20px — privacy 16, terms 16, admin
panel 16, the nav lists 20. The 44px rule was applied here to the **icon buttons** (there is a
comment in the file saying exactly that), and WCAG 2.5.8 exempts links inside a sentence.

Making only this one link 44px would look wrong and match nothing. Matching the neighbours is
correct.
