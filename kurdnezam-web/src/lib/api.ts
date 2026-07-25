/* ─────────────────────────────────────────────────────────────
   Typed client for the kurdnezam backend.
   Safe to import from both Server Components and Client Components:
   nothing here touches `next/headers`, cookies or the DOM.
   ───────────────────────────────────────────────────────────── */

import type { Content, NewsItem } from "@/data/content";

/** Base URL of the API. Baked at build time (NEXT_PUBLIC_*). */
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000"
).replace(/\/+$/, "");

/* ── errors ─────────────────────────────────────────────── */

/** RFC 9110 ProblemDetails / ValidationProblemDetails, as ASP.NET Core emits it. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** ValidationProblemDetails only — field name → messages. */
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;

  constructor(
    message: string,
    status: number,
    problem: ProblemDetails | null = null
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    // keeps `instanceof ApiError` working after transpilation
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** Field errors from ValidationProblemDetails (`{}` when there are none). */
  get errors(): Record<string, string[]> {
    return this.problem?.errors ?? {};
  }

  /** True when the server rejected the payload with per-field messages. */
  get isValidation(): boolean {
    return this.status === 400 && Object.keys(this.errors).length > 0;
  }

  /**
   * First error message for a field, matched case-insensitively
   * (ASP.NET Core pascal-cases keys, e.g. `FullName` for `fullName`).
   */
  fieldError(field: string): string | undefined {
    const wanted = field.toLowerCase();
    for (const [key, messages] of Object.entries(this.errors)) {
      if (key.toLowerCase() === wanted) return messages[0];
    }
    return undefined;
  }
}

/* ── low-level request helper ───────────────────────────── */

async function request<T>(
  path: string,
  init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch (cause) {
    throw new ApiError(
      `Network error while calling ${url}: ${(cause as Error)?.message ?? cause}`,
      0
    );
  }

  if (!res.ok) {
    let problem: ProblemDetails | null = null;
    try {
      const text = await res.text();
      if (text) problem = JSON.parse(text) as ProblemDetails;
    } catch {
      // non-JSON error body — keep problem null
    }
    throw new ApiError(
      problem?.title ?? problem?.detail ?? `${res.status} ${res.statusText}`,
      res.status,
      problem
    );
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/* ── content ────────────────────────────────────────────── */

/** Cache tag for the whole-site content payload (usable with `revalidateTag`). */
export const CONTENT_TAG = "kurdnezam-content";

/**
 * The entire site content in one payload. Called from the SERVER (root layout).
 * ISR: cached for 60s so CMS edits appear without a redeploy.
 * Throws `ApiError` — callers should fall back to `EMPTY_CONTENT`.
 */
export function getContent(revalidate = 60): Promise<Content> {
  return request<Content>("/api/kurdnezam/content", {
    next: { revalidate, tags: [CONTENT_TAG] },
  });
}

/** Zero-value content, for rendering the shell when the API is unreachable. */
export const EMPTY_CONTENT: Content = {
  settings: {
    nameFa: "",
    nameKu: "",
    nameEn: "",
    tagline: "",
    address: "",
    phones: [],
    postalCode: "",
    telegram: "",
    instagram: "",
    footerLinks: [],
    stats: { totalVisits: 0, todayVisits: 0, online: 0 },
  },
  slides: [],
  quickLinks: [],
  categories: [],
  news: [],
  people: [],
  units: [],
  tabGroups: [],
  forms: [],
  orgPages: [],
};

/* ── news ───────────────────────────────────────────────── */

export interface NewsQuery {
  categoryId?: number;
  q?: string;
  featured?: boolean;
  unitId?: number;
  page?: number;
  pageSize?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Server-side search + paging over news. Uncached by default (search is per-request). */
export function getNews(
  params: NewsQuery = {},
  revalidate = 0
): Promise<Paged<NewsItem>> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const query = qs.toString();
  const suffix = query ? `?${query}` : "";
  return request<Paged<NewsItem>>(`/api/kurdnezam/news${suffix}`, {
    next: { revalidate },
  });
}

export function getNewsById(
  id: number | string,
  revalidate = 60
): Promise<NewsItem> {
  return request<NewsItem>(`/api/kurdnezam/news/${id}`, {
    next: { revalidate },
  });
}

/* ── writes (all anonymous) ─────────────────────────────── */

export interface FormSubmissionInput {
  fullName: string;
  nationalId: string;
  membershipNo: string;
  mobile: string;
  notes?: string;
}

/** 201 on success. Throws `ApiError` (400 when the form is closed / invalid, 404 when unknown). */
export function submitForm(
  formId: number | string,
  body: FormSubmissionInput
): Promise<void> {
  return request<void>(`/api/kurdnezam/forms/${formId}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface ContactMessageInput {
  name: string;
  phone: string;
  subject: string;
  message: string;
}

/** 201 on success. Throws `ApiError` on validation failure. */
export function sendContactMessage(body: ContactMessageInput): Promise<void> {
  return request<void>("/api/kurdnezam/contact-messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Fire-and-forget visit ping that feeds the footer counters.
 * Never throws — a failed analytics ping must not break the page.
 */
export async function trackVisit(
  sessionId: string,
  path: string
): Promise<void> {
  try {
    await request<void>("/api/kurdnezam/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, path }),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

/* ── media ──────────────────────────────────────────────── */

/**
 * Resolve an image reference coming from the API.
 * - `/images/...`      → legacy asset still shipped in `public/`, returned unchanged
 * - absolute / data:   → returned unchanged
 * - anything else      → prefixed with `API_BASE` (e.g. `/api/kurdnezam/media/x.png`)
 */
export function imageUrl(src: string): string {
  if (!src) return src;
  if (src.startsWith("/images/")) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
  return `${API_BASE}${src.startsWith("/") ? "" : "/"}${src}`;
}
