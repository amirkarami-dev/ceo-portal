import type { Lang, TKey } from "@/lib/i18n";
import type { OrgPage } from "@/data/content";

/** The hub whose children are «ارکان سازمان». Also special-cased by the /p/[slug] router. */
export const ARKAN_SLUG = "arkan";

/**
 * A hub's children, in the order the admin panel gives them.
 *
 * `filter` first so the sort never touches `content.orgPages` itself — that array is the one the
 * ContentProvider hands to the header, the footer and every page, and sorting it in place would
 * reorder content for the whole app. `id` breaks ties because nothing stops two children sharing a
 * sortOrder.
 */
export function childrenOf(pages: OrgPage[], parentSlug: string): OrgPage[] {
  return pages
    .filter((p) => p.parentSlug === parentSlug)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function findOrgPage(pages: OrgPage[], slug: string): OrgPage | undefined {
  return pages.find((p) => p.slug === slug);
}

/**
 * Kurdish titles for the six ارکان pages, which are the only database rows on this site that have
 * a translation at all.
 *
 * Why a map keyed on slug: the five organs are fixed by the نظام مهندسی law, their slugs are already
 * load-bearing elsewhere (`slug === "arkan"` in the router, `/p/arkan` in the header and the home
 * dock), and these six strings existed as real translations before the menu became data-driven.
 * Dropping them to satisfy a principle would make the Kurdish site worse for no gain.
 *
 * `Partial<>` is deliberate: with `Record<string, TKey>` TypeScript would happily type
 * `t(MAP[slug])` for a slug that is not in the map, and `t(undefined)` renders *blank* rather than
 * throwing — an invisible menu entry. The `Partial` forces the explicit `key ? … : …` below.
 *
 * The proper fix is a `TitleKu` column beside `Settings.NameKu`, which is the one field-level
 * translation mechanism this repo already has. That is a schema change and belongs in its own step.
 */
const ORGAN_KU_KEYS: Partial<Record<string, TKey>> = {
  arkan: "nav.organs",
  majmaeomumi: "organs.assembly",
  modir: "organs.board",
  hayatraise: "organs.presidium",
  shorayeentezami: "organs.disciplinary",
  bazrsin: "organs.inspectors",
};

/**
 * The title to show for an org page.
 *
 * **Persian always reads the database.** The override is gated on `ku` on purpose: without that
 * gate `t("organs.board")` would return the Persian dictionary string and `page.title` would never
 * be read, so renaming a page in the panel would update its own heading and its card but silently
 * not the menu — exactly the editability this step exists to deliver.
 */
export function orgPageTitle(
  page: Pick<OrgPage, "slug" | "title">,
  lang: Lang,
  t: (key: TKey) => string,
): string {
  const key = ORGAN_KU_KEYS[page.slug];
  return lang === "ku" && key ? t(key) : page.title;
}
