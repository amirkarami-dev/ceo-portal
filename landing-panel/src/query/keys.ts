import type { ContactListParams, NewsListParams, PersonGroup, SubmissionListParams } from "@/api/types";

/**
 * Every cache key in the panel. Each resource exposes:
 *   `all()`  — the invalidation prefix (invalidating it drops lists AND details)
 *   `list()` — the list query key (may take params)
 *   `byId()` — a detail key, where the API has one
 *
 * Pass `all()` as the `key` of `useCrud` so a mutation invalidates every view of the resource.
 */
export const queryKeys = {
  content: {
    all: () => ["content"] as const,
    get: (newsLimit?: number) => ["content", { newsLimit }] as const,
  },
  news: {
    all: () => ["news"] as const,
    list: (params?: NewsListParams) => ["news", "list", params ?? {}] as const,
    byId: (id: number) => ["news", "detail", id] as const,
  },
  categories: {
    all: () => ["categories"] as const,
    list: () => ["categories", "list"] as const,
    byId: (id: number) => ["categories", "detail", id] as const,
  },
  slides: {
    all: () => ["slides"] as const,
    list: () => ["slides", "list"] as const,
    byId: (id: number) => ["slides", "detail", id] as const,
  },
  quickLinks: {
    all: () => ["quick-links"] as const,
    list: () => ["quick-links", "list"] as const,
  },
  footerLinks: {
    all: () => ["footer-links"] as const,
    list: () => ["footer-links", "list"] as const,
  },
  people: {
    all: () => ["people"] as const,
    list: (group?: PersonGroup) => ["people", "list", group ?? "all"] as const,
  },
  units: {
    all: () => ["units"] as const,
    list: () => ["units", "list"] as const,
  },
  tabGroups: {
    all: () => ["tab-groups"] as const,
    list: () => ["tab-groups", "list"] as const,
    byId: (id: number) => ["tab-groups", "detail", id] as const,
  },
  orgPages: {
    all: () => ["org-pages"] as const,
    list: () => ["org-pages", "list"] as const,
    bySlug: (slug: string) => ["org-pages", "detail", slug] as const,
  },
  forms: {
    all: () => ["forms"] as const,
    list: () => ["forms", "list"] as const,
    byId: (id: number) => ["forms", "detail", id] as const,
  },
  submissions: {
    all: () => ["submissions"] as const,
    list: (params?: SubmissionListParams) => ["submissions", "list", params ?? {}] as const,
  },
  contactMessages: {
    all: () => ["contact-messages"] as const,
    list: (params?: ContactListParams) => ["contact-messages", "list", params ?? {}] as const,
  },
  settings: {
    all: () => ["settings"] as const,
    get: () => ["settings", "get"] as const,
  },
} as const;

export type QueryKey = readonly unknown[];
