# Kurdnezam step 7 — the mobile sweep, and what an audit found that six steps had not

- **Date:** 2026-08-03
- **Area:** `landing-panel`, `kurdnezam-web`, `src/Web`, `src/Application`
- **Design:** [2026-08-03-kurdnezam-contact-and-organs-design.md](../superpowers/specs/2026-08-03-kurdnezam-contact-and-organs-design.md) — step 7 of 7, **the feature is complete**
- **Status:** **done and deployed.** API, panel and site all rebuilt and healthy.

## Why this step found more than a mobile sweep

Step 3 changed the panel's shared `AppLayout`, which touches **all fourteen** admin pages, but only
three had been looked at. Rather than eyeball the rest, I ran a static audit across every page the
work touched plus a completeness critic over steps 1–6, then verified each reported hazard against
the code before acting. Several reported "hazards" were **refuted** on inspection and correctly not
fixed — AntD clamps Drawer width to `100vw`, so the 520/560/760px drawers were never a problem; a
260px search box inside 335px overflows nothing.

Two findings were worth the whole exercise.

## 1. One line was breaking editing on ~9 admin tables

`CrudTable` always scrolls — `scroll={{ x: scrollX ?? 900 }}` has no falsy case — but pinned the
عملیات column only `if (scrollX)`, a prop almost no page passed. So on News, Categories, Slides,
QuickLinks, FooterLinks, TabGroups, ContactSections and their nested tables, **ویرایش and حذف sat
500–740px past the right edge of a phone** and were reachable only by dragging the table all the way
across.

`fixed: "right"` unconditionally. Measured after: the actions cell holds at `left: 20, right: 140`
across the full 900px scroll range — always on screen.

Worth recording: under RTL AntD emits `ant-table-cell-fix-**left**` for `fixed: "right"`. My first
check looked for `fix-right`, found nothing, and briefly read as "the fix did not work".

## 2. A retired contact block was publicly readable

`GET /api/kurdnezam/contact-sections?includeInactive=true` is `AllowAnonymous`, and the flag bound
straight from the query string. My own comment on that parameter said *"Admin-only in practice"* —
asserting a property the code did not have. Anyone could read every deactivated block, with its
addresses and phone numbers.

Now enforced, not documented: `includeInactive && httpContext.User.IsInRole(Administrator)`, and the
by-id route 404s a retired section for non-admins so it cannot hand back what the list refuses.
Verified live — anonymous, with and without the flag, returns the same single active block.

## 3. The panel promised something the site did not do

The org-pages screen tells the editor that any page with a parent becomes a card on that parent. Only
`arkan` rendered children. Fixed by **deleting** the special case rather than adding one: `ArkanPage`
is gone, its card grid is a reusable `HubCards`, and the generic `/p/[slug]` page renders intro →
child cards → people, showing only the parts a page actually has. `arkan` is now just a page that
happens to have children.

That also fixed a lie: during an outage every page said «صفحه یافت نشد». It now distinguishes "no
such page" from "we have no content", because `/p/modir` certainly exists.

The panel's wording was corrected too — only ارکان children reach the top menu, which is a fixed slot
in the site's navigation, not a property of being a hub.

## Everything else fixed

| Where | Was | Now |
|---|---|---|
| `PeoplePage`, `MessagesPage` | `Segmented` filter, no `block` — six Persian labels forced the page ~460px wide | `block`; labels ellipsis instead |
| `SettingsPage` phones | 260px input + 32px button = ~300px non-shrinkable in ~311px | real flex row, `flex:1 minWidth:0` |
| `OrgPagesPage` | flat `scrollX={1100}` despite five columns hiding below md/lg/xl | breakpoint-aware 560→1100 |
| `ContactSectionsPage` | برچسب hidden below `md`, reachable nowhere | falls back into the مقدار cell via `.only-narrow` |
| Header search overlay | `max-w-xl` never engages at 375, form ran edge to edge | `px-4` on the backdrop |
| Header drawer links | 36px targets, flush together, and below `lg` the drawer is the only nav | `py-3` + `space-y-1` |
| `/p/[slug]` headings | `text-5xl` has line-height 1; a long admin title collided with its own second line | `text-3xl leading-snug sm:text-4xl lg:text-5xl`, `break-words` |
| `mapUrl` | `neshan.org/…` resolved against kurdnezam.ir | reuses the channels' `externalHref` |
| `zap` icon | drew `Flame` — identical to `flame`, so «برق» and «گاز» looked the same | `Zap` |
| Panel fax hint | said a fax would not become a link; the site dials it | `fax` added to `LINKED_CHANNEL_KINDS` |
| Panel معرفی | `NotEmpty` on the server, no rule in the form → raw English error | marked required |
| Slug rename | silently orphaned every child (they reference the parent by slug) | refused, with a message saying to move the children first |

## Verified

Live, after deploying all three:

```
anonymous ?includeInactive=true   → 1 section ['دفتر مرکزی']   (same as without the flag)
kurdnezam.ir  / /p/arkan /p/tamas /p/modir /p/majmaeomumi /p/advar /news   all 200
/p/arkan       five cards still rendered from data
/p/advar       renders, and emits no empty card grid
panel, api, auth, vms, room, refahi, election   all 200
11 kurdnezam API routes                          all 200
```

Panel at 375px: actions column pinned at 20–140px across a 900px scroll; settings phone row fits with
nothing overflowing; `.only-narrow` computes `inline` below `md`.

Public at 375px, against the **live** site: no sideways scroll on any page; person cards 343px, one
per row; drawer 319px with 49px links; inputs 16px/50px. Both header triggers measure 44×44 once the
`before:-inset` hit area is accounted for — my first probe under-read them by a pixel per side and I
nearly "fixed" something that was already correct.

## Still open, deliberately

Three follow-ups are spun off rather than folded in — all pre-existing, all affecting pages this
feature never touched:

1. **Panel lint gate** is red on `RichTextEditor.tsx`.
2. **Site lint gate** is red on three React Compiler `set-state-in-effect` errors in `Header.tsx` and
   `i18n.tsx` (the hydration-safe clock, the route-change reset).
3. **Panel form controls are 14px/32px** — under 16px, iOS zooms on focus; under 44px for touch. It
   is an AntD theme default across all fourteen pages.

Not done, and named so it is not forgotten:

- **`TitleKu` column.** The Kurdish organ titles still come from a slug→key map. The principled fix
  mirrors `Settings.NameKu`; it is a schema change and deserves its own step.
- **Responsive columns** on News, Submissions, Forms, Units, TabGroups, QuickLinks, FooterLinks —
  their tables are 760–1420px with no `responsive` config. The pinned actions column makes them
  *usable*; it does not make them *good*.
- **Body-scroll lock** on the public site's drawer and search overlay.

## The feature, end to end

`/p/tamas` and «ارکان سازمان» are now entirely editable from the panel: contact blocks with typed
rows, the intro paragraph, the map caption and link, and org pages whose parent, icon and card text
drive the cards, the menu and the page together. Nothing about either is written in the code any
more.
