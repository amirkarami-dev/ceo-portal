# Kurdnezam step 5 — /p/tamas rebuilt from the database

- **Date:** 2026-08-03
- **Area:** `kurdnezam-web` — the public contact page
- **Design:** [2026-08-03-kurdnezam-contact-and-organs-design.md](../superpowers/specs/2026-08-03-kurdnezam-contact-and-organs-design.md) — step 5 of 7
- **Status:** **done and deployed** — live at `kurdnezam.ir/p/tamas`. First visitor-facing change of the seven.

## What is no longer written in the code

| | before | now |
|---|---|---|
| Intro paragraph | a string literal | the `tamas` org page's `intro` |
| نشانی / تلفن / کدپستی | three fixed rows off flat settings | any number of blocks, each with its own rows |
| Map caption | a string literal | `settings.mapLabel`, and a link when `mapUrl` is set |
| Which unit a message is for | not asked | «بخش مربوطه» on the form, stored with the message |

## Decisions worth naming

- **The row's icon comes from its `kind`, not from an editor choice.** The row already says what it
  is; letting someone put a printer beside an email address could only ever be a mistake.
- **`kind` drives three things at once** — the icon, `dir="ltr"` on numbers and URLs, and whether the
  value becomes a `tel:` / `mailto:` / external link. The address stays RTL; everything numeric does
  not.
- **Phone numbers are transliterated for `tel:`.** `۰۹۱۲…` becomes `0912…` and everything but digits
  and a leading `+` is stripped — a `tel:` link with a Persian digit in it is silently dead on a
  phone, which is exactly where it matters.
- **The «بخش مربوطه» dropdown only appears when there is more than one block.** With one block, or
  none, it would be a control whose answer is already known. Production has one today, so it is not
  visible yet — that is correct, not missing.
- **A fallback when every block is switched off.** The page rebuilds one block from the
  organisation-wide address/phones/postcode rather than showing a contact page with no way to make
  contact.
- **The kind is announced to screen readers but not printed.** `«تلفن ثابت: ۰۸۷…»` on every row is
  noise for a sighted reader and essential for a blind one, so it is `sr-only`.

## An icon registry, and one lint rule worth knowing

`src/lib/siteIcons.tsx` maps the editor's icon keys to lucide components. Fixed, not dynamic:
`lucide-react` has **5,978 exports** and cannot resolve a runtime string without bundling all of
them. lucide has also **dropped its brand icons**, so Telegram and Instagram reuse `Send` and
`AtSign` — the shapes the footer already uses for them, rather than a second convention.

The first version resolved the icon in the caller's render body (`const Icon = siteIcon(...)`) and
the React Compiler lint rejected it: **`Cannot create components during render`** — it cannot tell a
lookup from a factory. Fixed by moving the lookup inside `<SiteIcon>` / `<ChannelIcon>` components,
which is tidier at the call sites anyway.

## Verified

Against **production content**, through a temporary `NEXT_PUBLIC_API_BASE` pointed at the live API
(reverted; `grep` for `TEMP-LOCAL` and `TEMP-PROOF` returns nothing).

```
intro            from the tamas org page, not a literal
دفتر مرکزی        block, description «پاسخگویی در ساعات اداری»
rows             نشانی (RTL, wraps to 2 lines) · 3 × tel: links · کدپستی
sr-only labels   5, measured 1×1 px — announced, not drawn
direction        address inherit; phones/postal ltr
map caption      «سنندج، میدان کوهنورد — جنب بانک مسکن» from settings
```

**The section picker was proven by temporarily relaxing its gate**, then restored: label «بخش
مربوطه», options «انتخاب کنید (اختیاری)» + «دفتر مرکزی», and the form's payload captured with a
fetch interceptor rather than sent — `{name, phone, subject, message, sectionId: 1}`, `sectionId` a
number. **Nothing reached the real inbox**, which was the point of intercepting rather than posting.

**375 px:** no sideways scroll, nothing overflows, the long address wraps instead of widening the
card, every input **16 px / 50 px** and the submit button 48 px tall — so no iOS zoom-on-focus and
every target above the 44 px minimum. (The public site was already right about this; it is the
*admin panel* that is not — see step 4.)

**Live:** `/p/tamas` 200, all six database-driven strings present, and the old hard-coded rows return
**0** matches across every JS chunk. arkan, modir, the panel, api, auth, vms, room and refahi
unchanged.

## Still hard-coded, deliberately

`/p/arkan`'s five cards and the header's ارکان dropdown — that is step 6. Nothing on this page
depends on them.

## Note

`npm run lint` in `kurdnezam-web` fails on **pre-existing** errors in `Header.tsx` and `i18n.tsx`
(`set-state-in-effect`), both untouched here. Every file this step touched is clean. `Header.tsx` is
step 6's file, so its warning gets fixed there.

## Next

Step 6: `/p/arkan` and the header dropdown driven by `parentSlug` — deleting both hard-coded lists.
