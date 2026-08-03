/* ─────────────────────────────────────────────────────────────
   Shape of the site content served by the backend.
   Source of truth: GET /api/kurdnezam/content  (camelCase JSON).

   This module is TYPES ONLY — there is no mock/default content any
   more. Fetch with `getContent()` from `@/lib/api`; the root layout
   seeds it into `<ContentProvider initialContent>`.
   ───────────────────────────────────────────────────────────── */

export interface Category {
  id: number;
  title: string;
  sortOrder: number;
  /** Number of published news items in this category (computed by the API). */
  newsCount: number;
}

export interface NewsItem {
  id: number;
  title: string;
  summary: string;
  body: string;
  /** Jalali display string, e.g. ۱۴۰۵/۴/۲۱ */
  date: string;
  /** ISO-8601 timestamp — use for sorting. */
  publishedAt: string;
  author: string;
  categoryId: number;
  /** Denormalised category title — no need to join against `categories`. */
  categoryTitle: string;
  /** Owning organisational unit, when the news item belongs to one. */
  unitId: number | null;
  /** `/images/...` (legacy static) or `/api/kurdnezam/media/...` — resolve with `imageUrl()`. */
  image: string;
  featured: boolean;
  /** Downloadable files (بخشنامه / فرم), ordered by the server. */
  attachments?: NewsAttachment[];
}

/** A file attached to a news item. Served from the API host, not the site. */
export interface NewsAttachment {
  id: number;
  /** `/api/kurdnezam/media/...` — resolve with `imageUrl()`. */
  url: string;
  /** Original name, shown to the visitor and used as the download name. */
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sortOrder: number;
}

export interface Slide {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  /** Linked news item, when the slide points at one. */
  newsId: number | null;
  newsTitle: string | null;
  badge: string;
  sortOrder: number;
}

export interface QuickLink {
  id: number;
  title: string;
  href: string;
  /** lucide icon name key */
  icon: string;
  sortOrder: number;
}

export type PersonGroup =
  | "modir"
  | "hayatraise"
  | "bazrsin"
  | "shorayeentezami"
  | "majmaeomumi";

export interface Person {
  id: number;
  name: string;
  role: string;
  image?: string | null;
  group: PersonGroup;
  sortOrder: number;
}

export interface Unit {
  id: number; // matches /tab-item/[id]
  title: string;
  description: string;
  /** Flattened head-of-unit (was `head: { name, role }`). */
  headName: string | null;
  headRole: string | null;
  sortOrder: number;
}

export interface TabGroupItem {
  id: number;
  title: string;
  href: string | null;
  note: string | null;
  sortOrder: number;
}

export interface TabGroup {
  /** Numeric primary key. The stable string key the UI switches on is `slug`. */
  id: number;
  /** e.g. "units" | "offices" | "groups" | "education" | "statistics" | "tariff" */
  slug: string;
  title: string;
  sortOrder: number;
  /** Empty for the `units` group — render `content.units` instead. */
  items: TabGroupItem[];
}

export interface FormItem {
  id: number;
  title: string;
  note: string;
  deadline: string;
  image: string;
  /** Closed forms reject submissions with 400. */
  isOpen: boolean;
  sortOrder: number;
  submissionCount: number;
}

/** Static organisational pages under /p/[slug]. `arkan` has `group: null`. */
export interface OrgPage {
  id: number;
  slug: string;
  title: string;
  group: PersonGroup | null;
  intro: string;
  /**
   * Slug of the hub this page sits under — "arkan" for the five organs, null for a top-level page.
   * A page with a parent is ALSO a card on the parent's page and an entry in the header dropdown,
   * so all three come from this one field instead of three hard-coded lists.
   */
  parentSlug: string | null;
  /** Icon key, resolved by `siteIcon()`; unknown or null falls back to a default. */
  icon: string | null;
  /** One-line card text shown on the parent page. Empty for pages that are never a card. */
  summary: string;
  sortOrder: number;
}

/**
 * What a contact row holds. Decides the icon, whether the value is forced to LTR, and whether it
 * becomes a tel: / mailto: / external link. Mirrors `KurdnezamContactChannelKinds` on the server,
 * which also enforces it with a CHECK constraint.
 */
export type ContactChannelKind =
  | "phone"
  | "mobile"
  | "fax"
  | "email"
  | "address"
  | "postal"
  | "hours"
  | "telegram"
  | "instagram"
  | "website";

export interface ContactChannel {
  id: number;
  kind: ContactChannelKind;
  /** Optional qualifier beside the value — «داخلی ۱۰۳». */
  label: string | null;
  value: string;
  sortOrder: number;
}

/** A block of contact details on /p/tamas. Only active sections reach the site. */
export interface ContactSection {
  id: number;
  title: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  channels: ContactChannel[];
}

export interface Settings {
  nameFa: string;
  nameKu: string;
  nameEn: string;
  tagline: string;
  address: string;
  phones: string[];
  postalCode: string;
  telegram: string;
  instagram: string;
  /**
   * Caption on the contact page's map panel. Already resolved by the API — it substitutes the full
   * `address` when the stored short form is blank, so this is never empty in practice.
   */
  mapLabel: string;
  /** Optional outbound map link; empty means the panel is not clickable. */
  mapUrl: string;
  footerLinks: { title: string; href: string }[];
  /** Raw counters — format in the UI with `toLocaleString("fa-IR" | "ckb-IR")`. */
  stats: { totalVisits: number; todayVisits: number; online: number };
}

export interface Content {
  settings: Settings;
  slides: Slide[];
  quickLinks: QuickLink[];
  categories: Category[];
  news: NewsItem[];
  people: Person[];
  units: Unit[];
  tabGroups: TabGroup[];
  forms: FormItem[];
  orgPages: OrgPage[];
  contactSections: ContactSection[];
}
