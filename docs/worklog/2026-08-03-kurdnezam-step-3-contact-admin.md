# Kurdnezam step 3 — the بخش‌های تماس admin screen, and a panel that never worked on a phone

- **Date:** 2026-08-03
- **Area:** `landing-panel`
- **Design:** [2026-08-03-kurdnezam-contact-and-organs-design.md](../superpowers/specs/2026-08-03-kurdnezam-contact-and-organs-design.md) — step 3 of 7
- **Status:** **built and verified against the live API. Not deployed** — step 4 is also panel-only, so
  the two ship together rather than recreating the container twice.

## What was built

`ContactSectionsPage.tsx`, master/detail in the same shape as the existing `TabGroupsPage`: sections
in the outer table, each row expanding to its own channels table. Both use the shared `CrudTable`, so
search, refresh, delete-confirm and the empty state come for free.

- **Section drawer** — عنوان, توضیح, آیکون, ترتیب, and a **نمایش در سایت** switch.
- **Channel drawer** — نوع, مقدار, برچسب, ترتیب. The **value field follows the kind**: it flips to
  `dir="ltr"` for numbers, emails and URLs, its placeholder changes with the kind, and it says
  «سایت این مقدار را به پیوند قابل کلیک تبدیل می‌کند» for the kinds that become links.
- `src/lib/siteMeta.ts` holds the Persian labels, the placeholders, and the icon list — step 4 needs
  the same icon list for org pages.
- Nav entry **بخش‌های تماس** sits next to **پیام‌ها**, since they are the two halves of the contact page.

**No icon preview, on purpose.** `landing-panel` does not carry lucide, and drawing a preview with a
*different* icon set would be a picture of something the visitor never sees. The picker is grouped
(عمومی / راه‌های تماس / ارکان سازمان / حوزه‌های کاری) with a Persian description of each real icon.

## The bigger find: the panel was broken on a phone — every page, not just this one

Checking the new screen at 375 px turned up a defect that predates it.

| | before | after |
|---|---|---|
| page scrolls sideways | **yes** (scrollWidth 900, then 528) | no (375) |
| Sider at 375 px | **still in the flex row, 232 px** | not rendered |
| table | stretched the page | scrolls inside its own 335 px box |
| menu trigger | 32 px | 44 × 44 |

Two separate causes, both already written down in GOTCHAS and both missed here:

1. **The inner `Layout` had no `minWidth: 0`.** It is a flex child, and a flex child defaults to
   `min-width: auto`, so `CrudTable`'s deliberate 900 px scroll floor stretched the column instead of
   scrolling inside it.
2. **The 232 px Sider stayed in the flex row below `md`.** Collapsing is not enough — a collapsed
   Sider is still a flex child. It now leaves the row entirely and the same menu is served from a
   right-placed Drawer, with one `menu()` helper feeding both so they cannot drift.

This affects **every** page in the panel, so all fourteen screens get it. It is fixed here rather
than deferred because the standing rule for this project is that a page is not done until it works
on a phone, and the page I added is one of the fourteen.

## Verified against the real API

Reads on `/api/kurdnezam/contact-sections` are anonymous, so the screen was driven with **real
production content** — «دفتر مرکزی» with its five real rows — rather than a fixture:

```
sections   دفتر مرکزی | پاسخگویی در ساعات اداری | ساختمان | ۵ | فعال | ۱
channels   نشانی   سنندج - میدان کوهنورد - جنب بانک مسکن - …      ۱
           تلفن ثابت 08733564876 / 08733564874 / 08733564878   ۲ ۳ ۴
           کدپستی  6619775411                                  ۱۰۰
drawer     «افزودن ردیف تماس / دفتر مرکزی», default نوع = تلفن ثابت,
           value input dir=ltr, placeholder ۰۸۷۳۳۵۶۴۸۷۶, link hint shown,
           footer انصراف / ذخیره, 520 px inside a 1280 px viewport
375 px     no sideways scroll, sider gone, 4 columns (آیکون/ترتیب hidden), trigger 44×44
1280 px    sider 232 px, no drawer, header does not repeat the app name, 6 columns
```

Getting real data in needed a **temporary Vite dev proxy** to `api.myceo.ir` — production CORS
rightly refuses `localhost:5175`, and going through the dev server makes the browser see a
same-origin request. That, a `VITE_DEV_BYPASS_AUTH` guard and `.env.local` are **all reverted**;
`grep` for `TEMP-LOCAL`, `DEV_BYPASS` and `proxy` returns nothing.

## What could not be verified here, and why

**`requestAnimationFrame` never fires in this preview pane** — measured directly, it returns `false`
after 1.2 s, and screenshots fail with *"the Browser pane is not displayed, so the page is not
compositing frames"*. rc-motion advances its transition on the next animation frame, so **any AntD
Drawer stays parked at `-appear-start`**, and the Sider's collapse width does not change either.

This matters because it looks exactly like the real reduced-motion drawer bug fixed earlier today in
`vms-web` and `room-web` — and it is not the same thing. Here the transitions are a normal `0.2s`;
there was no blanket duration override to blame. Drawer *content* was verified by reading the DOM;
the slide itself cannot be seen until the pane is displayed.

## Not done here

- **Not deployed.** Step 4 also touches only the panel, so both deploy together.
- `npm run lint` fails on a **pre-existing** warning in `RichTextEditor.tsx` — a file this task never
  opened, unmodified in the diff. Typecheck and build are clean. Spun off as its own task, because a
  lint gate that is already red cannot catch anything new.

## Next

Step 4: **صفحات سازمانی** gains Parent / Icon / Summary, **تنظیمات** gains the map fields, and
**پیام‌ها** shows which section a message was sent to. Then the panel deploys.
