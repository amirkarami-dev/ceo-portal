# Kurdnezam — a managed contact page and managed ارکان سازمان — design

- **Date:** 2026-08-03
- **Asked for:** three things — (1) the favicon, (2) `/p/tamas` fully editable from the panel with
  contact details classified by section, (3) «ارکان سازمان» able to add / edit / delete its sections.
- **Status:** design. Item 1 is already done (see §8); items 2 and 3 are built one step at a time.

## 1. What is hard-coded today

I read the live data before designing, so this is what is actually there — not what the code implies.

| Thing | Where it lives now | Editable? |
|---|---|---|
| The favicon | `create-next-app` default `.ico`, untouched since the initial commit | ✅ **fixed** |
| Contact intro paragraph | a string literal in `p/[slug]/page.tsx` | ❌ |
| نشانی / تلفن / کدپستی | `settings` — **one flat set for the whole organisation** | partly |
| Map caption «سنندج، میدان کوهنورد» | a string literal | ❌ |
| The 5 ارکان cards (icon + title + text + link) | `const arkanCards = [...]` | ❌ |
| The ارکان **nav dropdown** (6 entries) | a second hard-coded list in `Header.tsx` | ❌ |

Two facts that shaped the design:

- **There is no `tamas` row in `orgPages`.** There are exactly 6: `arkan` plus the 5 organs. So the
  contact intro has nowhere to live yet — but `orgPages` already has an `Intro` field and an admin
  editor, so it costs one row, not a new table.
- **«واحدهای سازمان» is already dynamic** (7 units, from `content.units`), while «ارکان سازمان» is
  hard-coded twice. The nav proves the pattern works; ارکان simply never got it.

## 2. Decisions (answered 2026-08-03)

| Question | Answer |
|---|---|
| Contact sections: own list, or reuse the 7 units? | **Own list**, separate from units |
| Should the form let the visitor choose a section? | **Yes** — «بخش مربوطه» dropdown, stored on the message |

**Why the own list wins.** A contact block and a department are not the same thing. «دفتر مرکزی» and
«روابط عمومی» are not units, and a unit like «واحد نقشه‌برداری» may have no public phone. Tying the
two would force every unit onto the page and forbid anything else. The cost is one extra list to
manage; the benefit is that neither list constrains the other.

## 3. Data model

### 3.1 New — contact sections (two levels, like TabGroup/TabItem)

The repo already has a parent/child CRUD pair in `KurdnezamTabGroup` + `KurdnezamTabItem`; this
follows it rather than inventing a shape.

```
KurdnezamContactSection            KurdnezamContactChannel
  Id                                 Id
  Title          «واحد حقوقی»        SectionId  → Section (cascade delete)
  Description?   one line            Kind       phone | mobile | fax | email
  Icon?          lucide name                    | address | postal | hours
  SortOrder                                     | telegram | instagram | website
  IsActive                           Label?     «داخلی ۱۰۳»
                                     Value      «08733564876»
                                     SortOrder
```

`Kind` drives the icon, the `dir="ltr"` on numbers, and whether the value renders as a `tel:` /
`mailto:` / external link. It is a **string** with a CHECK constraint, not an enum — the API
serialises enums as numbers (GOTCHAS), and a number in the admin dropdown would be unreadable.

`IsActive` exists so a section can be taken off the page for a while without deleting its rows.

### 3.2 Changed — `KurdnezamOrgPage` grows three columns

```
+ ParentSlug   string?   "arkan" for the five organs; null for a top-level page
+ Icon         string?   lucide name shown on the card
+ Summary      string    the one-line card text
```

This is the whole of item 3. An ارکان card **is** an org page, so:

- **add** an org page with `ParentSlug = "arkan"` → a new card, a new dropdown entry and a new
  `/p/<slug>` page all appear together;
- **edit** its title/summary/icon → all three update;
- **delete** it → all three go.

The alternative — a separate "cards" table — would let a card and its page drift apart, and would
leave the nav dropdown still hard-coded. Rejected.

A data migration backfills the 5 existing organs with `ParentSlug = "arkan"`, their current icons
(`Vote`, `UsersRound`, `Landmark`, `Gavel`, `ScrollText`) and their current card text, so the page
looks identical the moment it ships.

### 3.3 Changed — `KurdnezamContactMessage` gains a section

```
+ SectionId    int?   → KurdnezamContactSection, ON DELETE SET NULL
```

Nullable and `SET NULL`, because messages must outlive the section they were sent to — deleting
«واحد حقوقی» must never delete its inbox history.

### 3.4 Changed — `KurdnezamSettings`

```
+ MapLabel     string?   caption on the map panel; falls back to Address when empty
+ MapUrl       string?   optional link, turns the dead placeholder into something clickable
```

## 4. The intro paragraph

No new table. Seed one `orgPages` row:

```
slug = "tamas", title = "تماس با ما", group = null, sortOrder = 0,
intro = "برای طرح پرسش، پیشنهاد یا شکایت می‌توانید …"   (today's text, moved not rewritten)
```

The page then reads `content.orgPages.find(p => p.slug === "tamas")?.intro`, exactly as `arkan`
already does. It becomes editable in the existing **صفحات سازمانی** admin page with no new UI.

## 5. Icons

`lucide-react` cannot resolve an arbitrary runtime string without bundling the whole library. So a
fixed registry of ~24 icons lives in the site (`ICONS: Record<string, LucideIcon>`), the admin offers
exactly those names in a picker with a live preview, and an unknown or empty name falls back to a
default. Adding a new icon is a one-line change in one file.

## 6. API surface

| Route | Method | Auth |
|---|---|---|
| `/api/kurdnezam/contact-sections` | GET | anonymous |
| `/api/kurdnezam/contact-sections` | POST | Administrator |
| `/api/kurdnezam/contact-sections/{id}` | GET / PUT / DELETE | GET anonymous, writes Administrator |
| `/api/kurdnezam/contact-sections/{id}/channels` | POST | Administrator |
| `/api/kurdnezam/contact-channels/{id}` | PUT / DELETE | Administrator |
| `/api/kurdnezam/content` | GET | gains `contactSections` |

Handler method names must be globally unique — `EndpointRouteBuilderExtensions` derives the endpoint
name from the method name, and a collision 500s the entire API (GOTCHAS).

## 7. Build order

Each step ends buildable, and nothing is half-wired at a step boundary.

| Step | What |
|---|---|
| **1** ✅ | Domain + EF config + migration for contact sections/channels, the 3 `OrgPage` columns, the message `SectionId`, the 2 settings fields. Backfill the 5 organs and insert the `tamas` row. **Shipped as two migrations** — SQL Server compiles a batch before running it, so the backfill cannot name a column the same batch adds. See the [step-1 worklog](../../worklog/2026-08-03-kurdnezam-step-1-schema.md). |
| **2** ✅ | Application layer + endpoints for contact sections/channels; extend the OrgPage and Settings DTOs; add `contactSections` to the content payload. Deployed, and the step-1 migrations applied with it. See the [step-2 worklog](../../worklog/2026-08-03-kurdnezam-step-2-api.md). |
| **3** ✅ | Admin: new **بخش‌های تماس** page — master/detail CRUD, ordering by number, grouped icon picker (no preview: the panel has no lucide). Router + nav entry. Also fixed the panel's mobile layout, which was broken on **every** page. See the [step-3 worklog](../../worklog/2026-08-03-kurdnezam-step-3-contact-admin.md). |
| **4** ✅ | Admin: **صفحات سازمان** gains Parent / Icon / Summary — which is the whole of the ارکان request; **تنظیمات** gains the map fields; **پیام‌ها** shows the section. Panel deployed with step 3. See the [step-4 worklog](../../worklog/2026-08-03-kurdnezam-step-4-admin-fields.md). |
| **5** ✅ | Public `/p/tamas` rebuilt from the API — blocks, intro, map caption, and the section dropdown (shown only when there is more than one block). **Live.** See the [step-5 worklog](../../worklog/2026-08-03-kurdnezam-step-5-contact-page.md). |
| **6** ✅ | Public `/p/arkan` + `Header.tsx` nav driven by `parentSlug` through one shared helper; both hard-coded lists deleted. Kurdish titles preserved via a **ku-only** override — a Persian-wide override would have stopped panel renames reaching the menu. **Live.** See the [step-6 worklog](../../worklog/2026-08-03-kurdnezam-step-6-arkan-nav.md). |
| **7** | Mobile pass at 375 px on every page and component touched, then deploy, worklog, commit. |

Steps 1–2 are backend and cannot be seen; step 5 is the first visible change. Steps 3–4 need the API
from step 2, and 5–6 need step 2 but not 3–4.

## 8. Item 1 — the favicon (done)

`src/app/icon.png` is now `cropped-logo-nezam-min-1-1-32x32.png`, and the default
`src/app/favicon.ico` was removed so it cannot win the browser's pick. Verified on the dev server:
one `<link rel="icon" href="/icon.png" sizes="32x32" type="image/png">`, 760 bytes served — byte-for-byte
the supplied file — and `/favicon.ico` now 404s.

**One limit worth stating:** 32×32 is the whole source. It is right for a browser tab and too small
for an iOS home-screen icon (`apple-icon.png` wants 180×180). If a larger export of the same teal
mark exists, send it and that becomes a one-file addition. `public/images/logo.png` is the same mark
at high resolution but in dark ink, not the teal.

## 9. Not in this scope

- Rewriting the contact **form** beyond adding the section dropdown.
- A real embedded map. The panel stays a styled placeholder, just with editable text and an optional
  outbound link.
- Per-section inboxes or email forwarding. The section is recorded on the message; routing it
  onward is a separate job.
- Touching «واحدهای سازمان», which already works.
