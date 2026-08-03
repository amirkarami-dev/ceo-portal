# Kurdnezam step 6 — the last two hard-coded lists deleted

- **Date:** 2026-08-03
- **Area:** `kurdnezam-web` — `/p/arkan`, `Header.tsx`, new `src/lib/orgPages.ts`
- **Design:** [2026-08-03-kurdnezam-contact-and-organs-design.md](../superpowers/specs/2026-08-03-kurdnezam-contact-and-organs-design.md) — step 6 of 7
- **Status:** **done and deployed.** «ارکان سازمان» is now fully manageable from the panel.

## What changed

`arkanCards` (5 entries) and the header's hard-coded ارکان dropdown (6 entries) are **gone**. Both now
read `orgPages` filtered by `parentSlug`, through one shared helper — `childrenOf()` in
`src/lib/orgPages.ts` — so the cards and the menu cannot drift apart. Adding a page with parent
«ارکان سازمان» in the panel creates a card, a menu entry and a `/p/{slug}` page together.

## The plan was reviewed before it was written, and it was wrong in three ways

Three independent adversarial reviews (correctness / regression / simplicity) all returned
**sound-with-changes** and converged on the same defects. All are fixed:

**1. The i18n override had to be Kurdish-only.** My plan was "if the slug has a known key, render
`t(key)`". That fires in Persian too — and `t("organs.board")` returns the Persian dictionary
string, so `page.title` would **never be read**. Renaming a page in the panel would update its
heading and its card but silently not the menu, defeating the entire point of this step. It is now
`lang === "ku" && key ? t(key) : page.title`: **Persian always reads the database**, Kurdish keeps
its five real translations.

**2. `item.children ?` is truthy for `[]`.** With `EMPTY_CONTENT` (any content-fetch failure) the
ارکان button would open onto a blank white box. Worse, the obvious guard — `children?.length ?` —
falls through to `<Link href={item.href!} />`, and these entries have no `href`: undefined throws in
dev and dereferences undefined in production. Fixed **both** halves: the branch now tests `.length`
in the desktop *and* mobile renderers (which also fixes the pre-existing units/categories case), and
`useNav` filters out any entry with neither an href nor children, so the crashing branch is
unreachable by construction. The ارکان entry additionally keeps its hub as a **static** first child,
so it survives an outage as a working link.

**3. React keys were the human title.** Production already contains both «هیئت مدیره» and
«هیئت مدیره ادوار»; once titles are admin-editable a collision is one rename away. `NavChild` gained
a `key` field (slug / `c{id}` / `u{id}`); the cards key on `page.id`.

Also from the reviews: non-mutating sort with an `id` tie-break (`content.orgPages` is the array the
whole app shares — sorting it in place would reorder content everywhere); an empty `summary` no
longer emits a `<p>` with a stray `mt-2`; a null icon falls back to `Landmark` rather than a generic
ℹ; `/p/arkan`'s H1 and breadcrumb now come from the hub row so a rename applies everywhere; the grid
is not rendered at all when there are no cards; and the four orphaned lucide imports were removed so
the file stays lint-clean.

## One improvement beyond the plan

The reviews surfaced that a Kurdish reader clicking «دەستەی بەڕێوەبردن» has **always** landed on a
page headed «هیئت مدیره». The same helper now applies to the destination page's H1 and breadcrumb,
which closes that. Persian is byte-identical to before; only Kurdish improves.

## Verified

Against production content, and in the **failure** state:

| Check | Result |
|---|---|
| `/p/arkan` cards | 5, from the database, correct order/summaries/icons |
| Header dropdown (fa) | hub + 5 children, matching the cards |
| Header dropdown (ku) | **all six Kurdish titles intact** — کۆبوونەوەی گشتی، دەستەی بەڕێوەبردن، دەستەی سەرۆکایەتی، ئەنجومەنی تەمبیهی، پشکنەران |
| `/p/modir` in ku | now «دەستەی بەڕێوەبردن» (was «هیئت مدیره») |
| Persian, everywhere | unchanged |
| **API down** | units dropdown **disappears** instead of opening empty; ارکان survives via the hub; `/p/arkan` renders its heading with no empty grid; **no crash**, only the layout's own expected log |
| 375 px | 5 cards at 343 px, no sideways scroll, mobile drawer lists all six |
| Live | `/p/arkan` 200 with all five cards server-rendered; all 8 `/p/*` pages 200; `arkanCards` returns **0** across every JS chunk; «دەستەی بەڕێوەبردن» still ships |

The `/p/*` sweep includes **`advar`**, the page added since step 2 — it is top-level, so it correctly
does *not* appear as a card or a menu entry. Giving it parent «ارکان سازمان» in the panel is all it
would take.

Note: the dropdown's children are **not** in the home page's server HTML. That is pre-existing — the
menu renders its items only when opened (`{open === item.title && <motion.ul>}`). The `/p/arkan`
cards *are* server-rendered.

## Follow-ups spun off, not smuggled in

- **`kurdnezam-web` lint**: 3 pre-existing React Compiler `set-state-in-effect` errors in
  `Header.tsx` (the hydration-safe clock, the route-change reset) and `i18n.tsx`. Untouched here; the
  unused-`content` warning this step *could* fix is fixed, taking 4 problems → 3.
- **`TitleKu` column.** One reviewer argued convincingly that the right long-term fix is a nullable
  `TitleKu` on `KurdnezamOrgPage`, mirroring `Settings.NameKu` — the one field-level translation
  mechanism this repo already ships. That is a schema change and belongs in its own step; the
  Kurdish-only map delivers the same visible result today and the file says so.

## Next

Step 7: the mobile sweep across everything touched, then the final deploy and close-out.
