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

/**
 * The media token a guest carries, set for the lifetime of the meeting screen.
 *
 * A guest in a public presentation has no account, so chat cannot be authenticated by a bearer token.
 * What they do have is the token the server signed for them, which names one room and expires — so it
 * travels in its own header and the API verifies it.
 *
 * Its own header, not `Authorization`: that one belongs to the IdP's tokens, and a second,
 * differently-issued JWT in it would be validated against the IdP and fail for the wrong reason.
 */
let roomToken: string | null = null;

export function setRoomToken(token: string | null) {
  roomToken = token;
}

async function authHeaders(json: boolean): Promise<HeadersInit> {
  const user = await getUserManager().getUser();
  return {
    ...(user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {}),
    ...(roomToken ? { "X-Room-Token": roomToken } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

/**
 * Turns a failed response into an ApiError that carries the SERVER'S message.
 *
 * The room API answers with a specific Persian reason for every refusal — «لینک عمومی فقط برای
 * ارائه امکان‌پذیر است», «این کد ملی در سامانه نظام مهندسی یافت نشد», «هنوز زمان ورود به جلسه نرسیده
 * است» — and each one tells the person exactly what to do next. Throwing "PUT failed: 400" instead
 * would waste all of it.
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

  // 204, and 200 with an empty body, are both normal here (activate / delete / invite).
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Uploads one file as multipart.
 *
 * `Content-Type` is deliberately NOT set. `fetch` writes it itself for a `FormData` body, including
 * the boundary it generated — supplying our own would send a header whose boundary does not match the
 * body, and the server would parse zero parts and answer "no file" for a request that had one.
 *
 * The field name must stay `file`: the endpoint binds an `IFormFile file` parameter by name.
 */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: await authHeaders(false),
    body: form,
  });

  if (!response.ok) throw await toError(response);

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Fetches a protected file and hands it to the browser to save.
 *
 * <b>This cannot be an `<a href>`.</b> A plain navigation carries no `Authorization` header and no
 * `X-Room-Token`, so the request would arrive uncredentialled and be refused — and the browser would
 * show that refusal as a broken page instead of an error we wrote. So the bytes are fetched with the
 * same headers as every other call, wrapped in an object URL, and saved through a link we click
 * ourselves.
 *
 * The object URL is revoked afterwards; without that the whole file stays in memory until reload.
 */
export async function apiDownload(path: string, fileName: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: await authHeaders(false),
  });

  if (!response.ok) throw await toError(response);

  const url = URL.createObjectURL(await response.blob());
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // A moment's grace: revoking in the same tick can cancel the save in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export const apiGet = <T,>(path: string) => request<T>("GET", path);
export const apiPost = <T,>(path: string, body?: unknown) => request<T>("POST", path, body);
export const apiPut = <T,>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const apiDelete = <T,>(path: string) => request<T>("DELETE", path);
