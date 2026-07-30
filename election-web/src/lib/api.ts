import { getUserManager } from "../auth/oidc";

const API_BASE = import.meta.env.VITE_API_BASE as string;

/** An API failure carrying the server's Persian reason. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Field name → messages, straight from ValidationProblemDetails. */
    readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeaders(json: boolean): Promise<HeadersInit> {
  const user = await getUserManager().getUser();
  return {
    ...(user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

/**
 * Turns a failed response into an ApiError that carries the SERVER'S message.
 *
 * This matters more than usual here. The election API answers with a specific Persian reason for every
 * refusal — «حداقل یک کاندیدا لازم است», «رأی‌گیری آغاز شده است و این انتخابات قابل ویرایش نیست»,
 * «برگه‌های رأی نسبت به شمارش قبلی تغییر کرده‌اند» — and each one tells the admin exactly what to do.
 * Throwing "PUT failed: 400" instead would waste all of it.
 */
async function toError(response: Response): Promise<ApiError> {
  let errors: Record<string, string[]> = {};
  let message = "";

  try {
    const body = (await response.json()) as
      | string
      | { errors?: Record<string, string[]>; title?: string; detail?: string };

    if (typeof body === "string") {
      // TypedResults.BadRequest("...") serialises as a bare JSON string. The upload endpoint answers
      // that way, and its messages are written in Persian for the admin — losing them here would turn
      // "the image is over 2 MB" into "unexpected error (400)".
      message = body;
    } else {
      errors = body.errors ?? {};
      // Prefer a field message; those are the ones written for a human.
      message = Object.values(errors).flat()[0] ?? body.detail ?? body.title ?? "";
    }
  } catch {
    // Non-JSON body (a 502 from the proxy, say) — fall through to a generic message.
  }

  if (!message) {
    message =
      response.status === 401 || response.status === 403
        ? "دسترسی شما به این بخش مجاز نیست"
        : response.status === 404
          ? "موردی یافت نشد"
          : `خطای غیرمنتظره (${response.status})`;
  }

  return new ApiError(message, response.status, errors);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: await authHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) throw await toError(response);

  // 204, and 200 with an empty body, are both normal here (publish / cancel / delete).
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Resolves a stored image reference to something an `<img>` can render.
 * - absolute URL or data: URI → unchanged
 * - `/api/…` → prefixed with the API origin, because this SPA is served from a different host
 * - anything else → unchanged; it is a path on some other site and will simply not load
 *
 * Same rules as `landing-panel/src/api/client.ts`. Without the prefix a candidate photo resolves
 * against the SPA's own origin and 404s — and on a ballot, a card whose photo silently fails while
 * others load is not a cosmetic bug: the design requires every card to look the same, or the layout
 * itself becomes a form of campaigning.
 */
export function mediaUrl(pathOrUrl?: string | null): string {
  const p = (pathOrUrl ?? "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p) || p.startsWith("data:")) return p;
  if (p.startsWith("/api/")) return `${API_BASE}${p}`;
  return p;
}

/** What the upload endpoint returns. */
export interface UploadedMedia {
  fileName: string;
  /** Server-relative, e.g. "/api/ElectionMedia/ab12….jpg". Resolve with {@link mediaUrl}. */
  url: string;
}

/**
 * Uploads a candidate photo to the election service's own folder in object storage.
 *
 * Multipart, so it cannot go through `request<T>` — that one sets `Content-Type: application/json`,
 * and setting any Content-Type by hand on a `FormData` body drops the multipart boundary the server
 * needs to parse it. Let fetch write the header itself.
 */
export async function uploadImage(file: File): Promise<UploadedMedia> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${API_BASE}/api/ElectionMedia`, {
    method: "POST",
    headers: await authHeaders(false),
    body,
  });

  if (!response.ok) throw await toError(response);
  return (await response.json()) as UploadedMedia;
}

export const apiGet = <T,>(path: string) => request<T>("GET", path);
export const apiPost = <T,>(path: string, body?: unknown) => request<T>("POST", path, body);
export const apiPut = <T,>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const apiDelete = <T,>(path: string) => request<T>("DELETE", path);
