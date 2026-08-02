import { getUserManager } from "../auth/oidc";

const API_BASE = import.meta.env.VITE_API_BASE as string;

/**
 * The media gateway — go2rtc behind Traefik on the VPS.
 *
 * A different origin from the API on purpose: video never touches the main box. That is also why the
 * media session is a **cookie** rather than a header — a `<video>` element and a WebSocket handshake
 * cannot carry an `Authorization` header, so the browser has to attach the credential itself.
 */
export const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE as string)?.replace(/\/$/, "") ?? "";

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
 * The camera API answers with a specific Persian reason for every refusal — «این شهر در فهرست شهرها
 * نیست», «دوربین دیگری با همین آدرس، پورت و کانال ثبت شده است» — and each one tells the admin exactly
 * what to change. Throwing "PUT failed: 400" instead would waste all of it.
 */
async function toError(response: Response): Promise<ApiError> {
  let errors: Record<string, string[]> = {};
  let message = "";

  try {
    const body = (await response.json()) as
      | string
      | { errors?: Record<string, string[]>; title?: string; detail?: string };

    if (typeof body === "string") {
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
      response.status === 401
        ? "برای ادامه باید وارد شوید"
        : response.status === 403
          ? "دسترسی شما به این بخش مجاز نیست"
          : response.status === 404
            ? "موردی یافت نشد"
            : response.status === 503
              ? "سرویس تصویر پیکربندی نشده است"
              : `خطای غیرمنتظره (${response.status})`;
  }

  return new ApiError(message, response.status, errors);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: await authHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),

    // The media session route answers with a Set-Cookie the browser must keep, and the API is a
    // different origin from this SPA. Without this the cookie is silently dropped and every tile
    // shows a 401 that looks like a gateway fault.
    credentials: "include",
  });

  if (!response.ok) throw await toError(response);

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiGet = <T,>(path: string) => request<T>("GET", path);
export const apiPost = <T,>(path: string, body?: unknown) => request<T>("POST", path, body);
export const apiPut = <T,>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const apiDelete = <T,>(path: string) => request<T>("DELETE", path);
