# Kurdnezam step 4 — ارکان becomes editable, and the panel ships

- **Date:** 2026-08-03
- **Area:** `landing-panel` — صفحات سازمان, تنظیمات, پیام‌ها
- **Design:** [2026-08-03-kurdnezam-contact-and-organs-design.md](../superpowers/specs/2026-08-03-kurdnezam-contact-and-organs-design.md) — step 4 of 7
- **Status:** **done and deployed** at `landing-panel.myceo.ir`, together with step 3.

## صفحات سازمان — the screen that makes ارکان manageable

Three fields, and the whole of the "add / edit / delete ارکان" request falls out of them.

- **زیرمجموعهٔ کدام صفحه؟** — pick «ارکان سازمان» and the page becomes a card on `/p/arkan` **and** an
  entry in the site's ارکان dropdown **and** its own `/p/<slug>` page. One row, three places.
- **آیکون کارت** — the grouped picker from `siteMeta.ts`, shared with بخش‌های تماس.
- **متن کارت** — the one line under the card title.

Things the screen does so the admin does not have to hold them in their head:

| | |
|---|---|
| List order | parents first, children indented under them with `└`. Sorting by `sortOrder` alone would interleave a child numbered 1 with a top-level page numbered 1. |
| Parent options | only top-level pages, never the page being edited. |
| A hub with children | parent select **disabled**, with the reason — matching the server rule that refuses to orphan five pages. |
| Deleting a hub | the confirm text changes to say its children will be left without a parent. |
| Card fields | an inline note appears the moment a parent is chosen, explaining that آیکون and متن کارت are what the parent page shows. |
| A page whose parent is missing | still listed, at the end, rather than silently vanishing. |

## تنظیمات — the map panel

**نقشه در صفحهٔ تماس با ما**: `mapLabel` (falls back to the full نشانی when blank — the API resolves
that, not the site) and an optional `mapUrl` that turns the dead placeholder into a link.

## پیام‌ها — where a message was sent

A **بخش مربوطه** column, with three distinct states: the section's name, «—» when the sender chose
nothing, and «حذف‌شده» when the id outlived the block. The column hides below `lg`, so the section,
phone and date are **repeated inside the expanded row** — expanding a message must never be the one
thing a phone user cannot reach.

## Verified against the live API

Reads are anonymous, so صفحات سازمان and تنظیمات were driven with **real production content**:

```
ارکان سازمان        [بنای رسمی]   ۱
└ مجمع عمومی        [رأی‌گیری]     ۱   عالی‌ترین رکن سازمان، متشکل از کلیه اعضای…
└ هیئت مدیره        [هیئت]        ۲   اداره امور سازمان و اجرای مصوبات مجمع عمومی.
└ هیئت رئیسه        [بنای رسمی]   ۳   مدیریت اجرایی و راهبری روزانه سازمان.
└ شورای انتظامی     [چکش داوری]   ۴   مرجع رسیدگی به تخلفات حرفه‌ای اعضای سازمان.
└ بازرسین           [طومار]       ۵   نظارت بر عملکرد مالی و اجرایی سازمان.
تماس با ما          [پشتیبانی]    ۲
هیئت مدیره ادوار    [—]           ۶

edit مجمع عمومی → parent «ارکان سازمان (arkan)», icon «رأی‌گیری», card note shown
edit ارکان سازمان → parent select disabled, «این صفحه خودش زیرمجموعه دارد…»
settings          → mapLabel «سنندج، میدان کوهنورد — جنب بانک مسکن», mapUrl empty, dir=ltr
```

**پیام‌ها is Administrator-only, so it 401s without a token** — confirmed it was a 401 and not a
rendering fault, then stubbed just that list to exercise all three section states. The expanded row
reads `بخش مربوطه: واحد حقوقی | تلفن: … | تاریخ: … | متن پیام: …`.

Worth noting: production now has an **eighth** org page, `advar` (هیئت مدیره ادوار), added since step
2. It is top-level, so it does **not** appear in the ارکان menu — setting its parent in this screen is
now all it would take.

## Mobile, at 375 px

| Screen | Result |
|---|---|
| صفحات سازمان | no sideways page scroll; table scrolls in its own box; columns drop to عنوان + عملیات, and the `└` marker plus the card text stay in the name cell, so the outline survives |
| تنظیمات | no overflow; both map fields full width |
| پیام‌ها | section/phone/date fall back into the expanded row |

## Deployed

`landing-panel` rebuilt and recreated; healthy in 5 s. The live bundle carries `contact-sections`,
`parentSlug`, `mapLabel`, `sectionTitle` and every new Persian string. A deliberately nonsense needle
returned 0 in the same check, so the greps are discriminating rather than matching everything.
kurdnezam, api, auth, vms, room and refahi all unchanged.

## Two pre-existing problems found, not fixed here

Both predate this work, affect all fourteen pages, and are spun off rather than folded in:

- `npm run lint` fails on a warning in `RichTextEditor.tsx`, a file untouched by steps 3–4.
- Every form control is 14 px / 32 px — under 16 px, **iOS Safari zooms the page on focus**, and 32 px
  is below the 44 px touch minimum. Fixing it is an AntD theme change across the whole panel.

## Next

Step 5: the public `/p/tamas` rebuilt from the API — sections, the intro from the `tamas` page, the
map caption, and the section dropdown on the form.
