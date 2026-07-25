/**
 * TypeScript mirrors of every kurdnezam DTO the API exposes.
 * The API serialises with System.Text.Json defaults → **camelCase** on the wire.
 *
 * Convention: `X` = the read model (has `id`), `XInput` = the write body (POST/PUT payload,
 * no `id`, no server-computed fields such as `newsCount` / `submissionCount` / `categoryTitle`).
 */

// ── shared ───────────────────────────────────────────────────────────────────

/** Every paged endpoint returns this envelope. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** RFC9110 ProblemDetails / ValidationProblemDetails as returned by the API. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Present on 400 ValidationProblemDetails: field name -> messages. */
  errors?: Record<string, string[]>;
  [key: string]: unknown;
}

// ── settings ─────────────────────────────────────────────────────────────────

export interface FooterLinkItem {
  title: string;
  href: string;
}

export interface SiteStats {
  totalVisits: number;
  todayVisits: number;
  /** Distinct sessions seen in the last few minutes. */
  online: number;
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
  /** Read-only here — edit through `footerLinksApi` (own resource). */
  footerLinks: FooterLinkItem[];
  /** Read-only — server-computed visit counters. */
  stats: SiteStats;
}

/** PUT /settings body — deliberately WITHOUT footerLinks/stats. */
export interface SettingsInput {
  nameFa: string;
  nameKu: string;
  nameEn: string;
  tagline: string;
  address: string;
  phones: string[];
  postalCode: string;
  telegram: string;
  instagram: string;
}

// ── categories ───────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  title: string;
  sortOrder: number;
  /** Server-computed. DELETE 400s while this is > 0. */
  newsCount: number;
}

export interface CategoryInput {
  title: string;
  sortOrder: number;
}

// ── news ─────────────────────────────────────────────────────────────────────

export interface News {
  id: number;
  title: string;
  summary: string;
  body: string;
  /** Display date as typed by the editor (Jalali string, e.g. "۱۴۰۳/۰۵/۱۲"). */
  date: string;
  /** Real timestamp used for sorting/paging (ISO-8601). */
  publishedAt: string;
  author: string;
  categoryId: number;
  categoryTitle?: string | null;
  unitId?: number | null;
  image: string;
  featured: boolean;
  /** Downloadable files, already ordered by the server. */
  attachments?: NewsAttachment[];
}

/** One downloadable file on an article. */
export interface NewsAttachment {
  id?: number;
  /** Stored reference, e.g. "/api/kurdnezam/media/ab12….pdf". */
  url: string;
  /** Original name — shown in the UI and used as the download name. */
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sortOrder?: number;
}

export interface NewsInput {
  title: string;
  summary: string;
  body: string;
  date: string;
  author: string;
  categoryId: number;
  image: string;
  featured: boolean;
  unitId?: number | null;
  /** Omit to let the server stamp "now". */
  publishedAt?: string | null;
  /**
   * The COMPLETE list — the server replaces the article's files with exactly this, so dropping
   * one here deletes it. Order of the array becomes the display order.
   */
  attachments?: NewsAttachment[];
}

export interface NewsListParams {
  categoryId?: number;
  q?: string;
  featured?: boolean;
  unitId?: number;
  page?: number;
  pageSize?: number;
}

// ── slides ───────────────────────────────────────────────────────────────────

export interface Slide {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  /** The article the slide links to. */
  newsId: number;
  newsTitle?: string | null;
  badge: string;
  sortOrder: number;
}

export interface SlideInput {
  title: string;
  subtitle: string;
  image: string;
  newsId: number;
  badge: string;
  sortOrder: number;
}

// ── quick links ──────────────────────────────────────────────────────────────

/** The API rejects any other value. */
export const QUICK_LINK_ICONS = [
  "engineer",
  "owner",
  "badge",
  "membership",
  "automation",
  "gas",
  "power",
] as const;

export type QuickLinkIcon = (typeof QUICK_LINK_ICONS)[number];

/** Persian labels for the icon <Select>. */
export const QUICK_LINK_ICON_LABELS: Record<QuickLinkIcon, string> = {
  engineer: "مهندس",
  owner: "مالک",
  badge: "پروانه",
  membership: "عضویت",
  automation: "اتوماسیون",
  gas: "گاز",
  power: "برق",
};

export interface QuickLink {
  id: number;
  title: string;
  href: string;
  icon: QuickLinkIcon;
  sortOrder: number;
}

export interface QuickLinkInput {
  title: string;
  href: string;
  icon: QuickLinkIcon;
  sortOrder: number;
}

// ── footer links ─────────────────────────────────────────────────────────────

export interface FooterLink {
  id: number;
  title: string;
  href: string;
  sortOrder: number;
}

export interface FooterLinkInput {
  title: string;
  href: string;
  sortOrder: number;
}

// ── people ───────────────────────────────────────────────────────────────────

/** The API rejects any other value. */
export const PERSON_GROUPS = [
  "modir",
  "hayatraise",
  "bazrsin",
  "shorayeentezami",
  "majmaeomumi",
] as const;

export type PersonGroup = (typeof PERSON_GROUPS)[number];

export const PERSON_GROUP_LABELS: Record<PersonGroup, string> = {
  modir: "مدیران",
  hayatraise: "هیئت رئیسه",
  bazrsin: "بازرسین",
  shorayeentezami: "شورای انتظامی",
  majmaeomumi: "مجمع عمومی",
};

export interface Person {
  id: number;
  name: string;
  role: string;
  image?: string | null;
  group: PersonGroup;
  sortOrder: number;
}

export interface PersonInput {
  name: string;
  role: string;
  group: PersonGroup;
  sortOrder: number;
  image?: string | null;
}

// ── units ────────────────────────────────────────────────────────────────────

export interface Unit {
  id: number;
  title: string;
  description: string;
  headName?: string | null;
  headRole?: string | null;
  sortOrder: number;
}

export interface UnitInput {
  title: string;
  description: string;
  headName?: string | null;
  headRole?: string | null;
  sortOrder: number;
}

// ── tab groups ───────────────────────────────────────────────────────────────

export interface TabItem {
  id: number;
  title: string;
  href?: string | null;
  note?: string | null;
  sortOrder: number;
}

export interface TabItemInput {
  title: string;
  href?: string | null;
  note?: string | null;
  sortOrder: number;
}

/** GET /tab-groups returns groups WITH their nested items. */
export interface TabGroup {
  id: number;
  slug: string;
  title: string;
  sortOrder: number;
  items: TabItem[];
}

export interface TabGroupInput {
  slug: string;
  title: string;
  sortOrder: number;
}

// ── org pages ────────────────────────────────────────────────────────────────

export interface OrgPage {
  id: number;
  slug: string;
  title: string;
  group?: string | null;
  intro: string;
  sortOrder: number;
}

export interface OrgPageInput {
  slug: string;
  title: string;
  intro: string;
  sortOrder: number;
  group?: string | null;
}

// ── forms + submissions ──────────────────────────────────────────────────────

/** Named `SiteForm` (not `Form`) so pages can `import { Form } from "antd"` without a clash. */
export interface SiteForm {
  id: number;
  title: string;
  note: string;
  /** Free-text deadline as shown on the site (e.g. "۳۱ شهریور"). */
  deadline: string;
  image: string;
  isOpen: boolean;
  sortOrder: number;
  /** Server-computed. */
  submissionCount: number;
}

export interface SiteFormInput {
  title: string;
  note: string;
  deadline: string;
  image: string;
  isOpen: boolean;
  sortOrder: number;
}

export interface FormSubmission {
  id: number;
  formId: number;
  formTitle?: string | null;
  fullName: string;
  nationalId: string;
  membershipNo: string;
  mobile: string;
  notes?: string | null;
  isHandled: boolean;
  /** ISO-8601. */
  created: string;
}

export interface SubmissionListParams {
  formId?: number;
  handled?: boolean;
  page?: number;
  pageSize?: number;
}

// ── contact messages ─────────────────────────────────────────────────────────

export interface ContactMessage {
  id: number;
  name: string;
  phone: string;
  subject: string;
  message: string;
  isRead: boolean;
  /** ISO-8601. */
  created: string;
}

export interface ContactListParams {
  isRead?: boolean;
  page?: number;
  pageSize?: number;
}

// ── media ────────────────────────────────────────────────────────────────────

export interface MediaUpload {
  fileName: string;
  /** Server-relative, e.g. "/api/kurdnezam/media/ab12….png". Resolve with `mediaUrl()`. */
  url: string;
  /** Name as uploaded, kept so attachments download under it instead of the 32-hex key. */
  originalName: string;
  contentType: string;
  sizeBytes: number;
}

// ── whole-site payload ───────────────────────────────────────────────────────

/** GET /content — everything in one request (used by the dashboard). */
export interface SiteContent {
  settings: Settings;
  slides: Slide[];
  quickLinks: QuickLink[];
  categories: Category[];
  news: News[];
  people: Person[];
  units: Unit[];
  tabGroups: TabGroup[];
  forms: SiteForm[];
  orgPages: OrgPage[];
}
