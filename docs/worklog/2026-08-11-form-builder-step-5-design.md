# Form builder step 5: the design and phone pass

**Date:** 2026-08-11
**Area:** kurdnezam-web
**Status:** live — the feature is complete

Design: [`docs/design/2026-08-07-kurdnezam-form-builder.md`](../design/2026-08-07-kurdnezam-form-builder.md)

## Goal

A `polish` pass over the public form, on both surfaces. Refinement, not redesign: the site's own
world — petrol and copper, Vazirmatn, `rounded-3xl` cards, `shadow-card` — is kept exactly.

## What a real form showed

Built a six-field form (four text, two file) so the layout had something honest to render, then
looked at it. Four defects, all fixed in one pass.

**1. The browser's English chrome, in the middle of a Persian form.** A native file input paints its
own «Choose File» / «No file chosen» — left-to-right, in English, in a right-to-left Persian form
asking for a licence scan. The worst thing on the page and entirely invisible in code review.

The input is now driven by a real button and clipped rather than shown (`sr-only`, not
`display:none`, so it still works). The button reads «انتخاب فایل» / «انتخاب فایل‌ها», says
«فایلی انتخاب نشده» or how many are chosen, and switches to «تغییر فایل» / «افزودن فایل دیگر» once
there are some. Dashed border, so it reads as a drop zone rather than a text box.

That forced a smaller correctness fix: a `<label>` can only point at a labelable control, and a
button is not one. Text fields keep their `<label htmlFor>`; file fields render a plain wrapper and
the button borrows the same words through `aria-labelledby`.

**2. Two lines lost in step 4.** The page this component replaced explained the star and promised
confidentiality. Both are back — the second matters most on the one form that asks for a national id
and a licence scan, because that is the moment someone decides whether to fill it in.

**3. Weak keyboard focus.** The site's inputs only tint a 1px border on focus. Every control here now
takes a copper border **and** a 2px ring, on `focus-visible` so a mouse click stays quiet.

**4. Small print at 4.52:1.** Passing AA, with nothing spare, at 12px. Help lines and the intro moved
from `text-steel` to `text-ink/70` — **8.45:1**.

## Verified on kurdnezam.ir

| | |
| --- | --- |
| English chrome | **none** |
| help text / intro contrast | **8.45:1** (was 4.52) |
| file button label | 4.93:1 |
| keyboard focus | copper border + 2px ring, `:focus-visible` matched under a real Tab |
| tap targets at 375px | 7 controls, smallest **46px**, none under 44 |
| input font size | 16px, so iOS does not zoom on focus |
| layout at 375px | one column, nothing wider than the screen |
| impeccable detector | `[]` |

## Two probes of mine that were wrong

Worth writing down, because both would have caused a pointless "fix".

**The focus ring looked missing.** Measuring after a programmatic `.focus()` reported
`outline: none` and no shadow — but `:focus-visible` deliberately does not match programmatic focus.
Pressing Tab for real showed `matchesFocusVisible: true` with the ring present. The probe was wrong,
not the code.

**ESLint caught what I got wrong.** I put `aria-invalid` on the file button; it is not valid on
`role=button`. Removed — the red border shows the problem and `aria-describedby` points at the
message, which is already `role=alert`.

## Left to do

- **The panel screens still have not been clicked through** (open since step 3). Everything else in
  this feature is proven end to end; the builder itself has only been proven by the shape it
  produces, not by using it.
- The duplicate-submission hole from step 4 stands: a network drop after the server accepts looks
  like a failure, and sending again creates a second row. It needs an idempotency key.
