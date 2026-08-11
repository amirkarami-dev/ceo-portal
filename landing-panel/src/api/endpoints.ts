import { api, qs, uploadMedia, mediaUrl, downloadProtectedFile, KURDNEZAM_PREFIX } from "./client";
import type {
  Category,
  CategoryInput,
  ContactChannelInput,
  ContactListParams,
  ContactMessage,
  ContactSection,
  ContactSectionInput,
  FooterLink,
  FooterLinkInput,
  FormSubmission,
  MediaUpload,
  News,
  NewsInput,
  NewsListParams,
  OrgPage,
  OrgPageInput,
  Paged,
  Person,
  PersonGroup,
  PersonInput,
  QuickLink,
  QuickLinkInput,
  Settings,
  SettingsInput,
  SiteContent,
  SiteForm,
  SiteFormInput,
  Slide,
  SlideInput,
  SubmissionListParams,
  TabGroup,
  TabGroupInput,
  TabItemInput,
  Unit,
  UnitInput,
} from "./types";

const P = KURDNEZAM_PREFIX;

/**
 * One module per resource. Every `create` resolves to the new **id** (the API returns
 * `201 Created` with the bare int); every `update`/`remove` resolves to void (`204`).
 */

// ── whole-site payload ───────────────────────────────────────────────────────

export const contentApi = {
  get: (newsLimit?: number): Promise<SiteContent> =>
    api.get<SiteContent>(`${P}/content${qs({ newsLimit })}`),
};

// ── news ─────────────────────────────────────────────────────────────────────

export const newsApi = {
  list: (params?: NewsListParams): Promise<Paged<News>> =>
    api.get<Paged<News>>(`${P}/news${qs({ ...params })}`),
  byId: (id: number): Promise<News> => api.get<News>(`${P}/news/${id}`),
  create: (input: NewsInput): Promise<number> => api.post<number>(`${P}/news`, input),
  update: (id: number, input: NewsInput): Promise<void> => api.put(`${P}/news/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/news/${id}`),
};

// ── categories ───────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: (): Promise<Category[]> => api.get<Category[]>(`${P}/categories`),
  byId: (id: number): Promise<Category> => api.get<Category>(`${P}/categories/${id}`),
  create: (input: CategoryInput): Promise<number> => api.post<number>(`${P}/categories`, input),
  update: (id: number, input: CategoryInput): Promise<void> =>
    api.put(`${P}/categories/${id}`, input),
  /** 400s while the category still has news attached. */
  remove: (id: number): Promise<void> => api.del(`${P}/categories/${id}`),
};

// ── slides ───────────────────────────────────────────────────────────────────

export const slidesApi = {
  list: (): Promise<Slide[]> => api.get<Slide[]>(`${P}/slides`),
  byId: (id: number): Promise<Slide> => api.get<Slide>(`${P}/slides/${id}`),
  create: (input: SlideInput): Promise<number> => api.post<number>(`${P}/slides`, input),
  update: (id: number, input: SlideInput): Promise<void> => api.put(`${P}/slides/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/slides/${id}`),
};

// ── quick links ──────────────────────────────────────────────────────────────

export const quickLinksApi = {
  list: (): Promise<QuickLink[]> => api.get<QuickLink[]>(`${P}/quick-links`),
  byId: (id: number): Promise<QuickLink> => api.get<QuickLink>(`${P}/quick-links/${id}`),
  create: (input: QuickLinkInput): Promise<number> => api.post<number>(`${P}/quick-links`, input),
  update: (id: number, input: QuickLinkInput): Promise<void> =>
    api.put(`${P}/quick-links/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/quick-links/${id}`),
};

// ── footer links ─────────────────────────────────────────────────────────────

export const footerLinksApi = {
  list: (): Promise<FooterLink[]> => api.get<FooterLink[]>(`${P}/footer-links`),
  create: (input: FooterLinkInput): Promise<number> => api.post<number>(`${P}/footer-links`, input),
  update: (id: number, input: FooterLinkInput): Promise<void> =>
    api.put(`${P}/footer-links/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/footer-links/${id}`),
};

// ── people ───────────────────────────────────────────────────────────────────

export const peopleApi = {
  list: (group?: PersonGroup): Promise<Person[]> => api.get<Person[]>(`${P}/people${qs({ group })}`),
  byId: (id: number): Promise<Person> => api.get<Person>(`${P}/people/${id}`),
  create: (input: PersonInput): Promise<number> => api.post<number>(`${P}/people`, input),
  update: (id: number, input: PersonInput): Promise<void> => api.put(`${P}/people/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/people/${id}`),
};

// ── units ────────────────────────────────────────────────────────────────────

export const unitsApi = {
  list: (): Promise<Unit[]> => api.get<Unit[]>(`${P}/units`),
  byId: (id: number): Promise<Unit> => api.get<Unit>(`${P}/units/${id}`),
  create: (input: UnitInput): Promise<number> => api.post<number>(`${P}/units`, input),
  update: (id: number, input: UnitInput): Promise<void> => api.put(`${P}/units/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/units/${id}`),
};

// ── tab groups (+ nested items) ──────────────────────────────────────────────

export const tabGroupsApi = {
  /** Groups come back WITH their nested `items`. */
  list: (): Promise<TabGroup[]> => api.get<TabGroup[]>(`${P}/tab-groups`),
  byId: (id: number): Promise<TabGroup> => api.get<TabGroup>(`${P}/tab-groups/${id}`),
  create: (input: TabGroupInput): Promise<number> => api.post<number>(`${P}/tab-groups`, input),
  update: (id: number, input: TabGroupInput): Promise<void> =>
    api.put(`${P}/tab-groups/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/tab-groups/${id}`),

  createItem: (groupId: number, input: TabItemInput): Promise<number> =>
    api.post<number>(`${P}/tab-groups/${groupId}/items`, input),
  updateItem: (itemId: number, input: TabItemInput): Promise<void> =>
    api.put(`${P}/tab-groups/items/${itemId}`, input),
  removeItem: (itemId: number): Promise<void> => api.del(`${P}/tab-groups/items/${itemId}`),
};

// ── contact sections ─────────────────────────────────────────────────────────

export const contactSectionsApi = {
  /**
   * Sections come back WITH their nested `channels`.
   * `includeInactive` is what the panel wants — without it a retired section is invisible here too
   * and could never be switched back on.
   */
  list: (): Promise<ContactSection[]> =>
    api.get<ContactSection[]>(`${P}/contact-sections?includeInactive=true`),
  byId: (id: number): Promise<ContactSection> =>
    api.get<ContactSection>(`${P}/contact-sections/${id}`),
  create: (input: ContactSectionInput): Promise<number> =>
    api.post<number>(`${P}/contact-sections`, input),
  update: (id: number, input: ContactSectionInput): Promise<void> =>
    api.put(`${P}/contact-sections/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/contact-sections/${id}`),

  createChannel: (sectionId: number, input: ContactChannelInput): Promise<number> =>
    api.post<number>(`${P}/contact-sections/${sectionId}/channels`, input),
  updateChannel: (channelId: number, input: ContactChannelInput): Promise<void> =>
    api.put(`${P}/contact-sections/channels/${channelId}`, input),
  removeChannel: (channelId: number): Promise<void> =>
    api.del(`${P}/contact-sections/channels/${channelId}`),
};

// ── org pages ────────────────────────────────────────────────────────────────

export const orgPagesApi = {
  list: (): Promise<OrgPage[]> => api.get<OrgPage[]>(`${P}/org-pages`),
  bySlug: (slug: string): Promise<OrgPage> =>
    api.get<OrgPage>(`${P}/org-pages/${encodeURIComponent(slug)}`),
  create: (input: OrgPageInput): Promise<number> => api.post<number>(`${P}/org-pages`, input),
  update: (id: number, input: OrgPageInput): Promise<void> => api.put(`${P}/org-pages/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/org-pages/${id}`),
};

// ── forms ────────────────────────────────────────────────────────────────────

export const formsApi = {
  list: (): Promise<SiteForm[]> => api.get<SiteForm[]>(`${P}/forms`),
  byId: (id: number): Promise<SiteForm> => api.get<SiteForm>(`${P}/forms/${id}`),
  create: (input: SiteFormInput): Promise<number> => api.post<number>(`${P}/forms`, input),
  update: (id: number, input: SiteFormInput): Promise<void> => api.put(`${P}/forms/${id}`, input),
  remove: (id: number): Promise<void> => api.del(`${P}/forms/${id}`),
};

// ── form submissions (the registration inbox) ────────────────────────────────

export const submissionsApi = {
  list: (params?: SubmissionListParams): Promise<Paged<FormSubmission>> =>
    api.get<Paged<FormSubmission>>(`${P}/forms/submissions${qs({ ...params })}`),
  setHandled: (id: number, isHandled: boolean): Promise<void> =>
    api.put(`${P}/forms/submissions/${id}/handled`, { isHandled }),
  remove: (id: number): Promise<void> => api.del(`${P}/forms/submissions/${id}`),

  /**
   * Saves one attachment to the administrator's machine. Not a URL you can put in an `href` —
   * the route is admin-only, so the bytes are fetched with the access token. See
   * `downloadProtectedFile`.
   */
  downloadAttachment: (attachmentId: number, fileName: string): Promise<void> =>
    downloadProtectedFile(`${P}/forms/attachments/${attachmentId}`, fileName),
};

// ── contact messages ─────────────────────────────────────────────────────────

export const contactApi = {
  list: (params?: ContactListParams): Promise<Paged<ContactMessage>> =>
    api.get<Paged<ContactMessage>>(`${P}/contact-messages${qs({ ...params })}`),
  setRead: (id: number, isRead: boolean): Promise<void> =>
    api.put(`${P}/contact-messages/${id}/read`, { isRead }),
  remove: (id: number): Promise<void> => api.del(`${P}/contact-messages/${id}`),
};

// ── settings ─────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: (): Promise<Settings> => api.get<Settings>(`${P}/settings`),
  /** Body must NOT contain footerLinks/stats — they are separate resources. */
  update: (input: SettingsInput): Promise<void> => api.put(`${P}/settings`, input),
};

// ── media ────────────────────────────────────────────────────────────────────

export const mediaApi = {
  upload: (file: File): Promise<MediaUpload> => uploadMedia(file),
  /** Absolute URL for an <img src>. See client.mediaUrl. */
  url: (pathOrUrl?: string | null): string => mediaUrl(pathOrUrl),
};
