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

export const apiGet = <T,>(path: string) => request<T>("GET", path);
export const apiPost = <T,>(path: string, body?: unknown) => request<T>("POST", path, body);
export const apiPut = <T,>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const apiDelete = <T,>(path: string) => request<T>("DELETE", path);
