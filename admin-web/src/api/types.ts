/**
 * TypeScript mirrors of every admin DTO the IdP's `/api/admin/*` API exposes.
 * The API serialises with System.Text.Json defaults → **camelCase** on the wire.
 */

// ── shared ───────────────────────────────────────────────────────────────────

/** The paged envelope returned by GET /api/admin/users. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** RFC9110 ProblemDetails / ValidationProblemDetails as returned by the API. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  /** Persian message on a 4xx the panel surfaces verbatim (last-admin / self-delete guards…). */
  detail?: string;
  instance?: string;
  /** Present on 400 ValidationProblemDetails: field name -> messages. */
  errors?: Record<string, string[]>;
  [key: string]: unknown;
}

// ── users ────────────────────────────────────────────────────────────────────

/** GET /api/admin/users/{id} — the read model. */
export interface UserDto {
  id: string;
  userName: string | null;
  email: string | null;
  phoneNumber: string | null;
  emailConfirmed: boolean;
  /** True when the account is disabled right now (cannot sign in). */
  isLocked: boolean;
  roles: string[];
  /** The per-service access list — each entry is a `ServiceKey.key`. */
  services: string[];
}

export interface UserListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

/** POST /api/admin/users body. */
export interface CreateUserRequest {
  userName: string;
  email?: string | null;
  phoneNumber?: string | null;
  /** Optional — omit to create a user who signs in only via OTP / Google. */
  password?: string | null;
  roles?: string[];
  services?: string[];
}

/** POST /api/admin/users response. */
export interface CreateUserResult {
  id: string;
}

/** PUT /api/admin/users/{id} body — profile fields only. */
export interface UpdateUserRequest {
  userName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  /** True disables (locks) the account; false re-enables it. */
  locked?: boolean;
}

/** PUT /api/admin/users/{id}/roles body. */
export interface RolesRequest {
  roles: string[];
}

/** PUT /api/admin/users/{id}/services body. */
export interface ServicesRequest {
  services: string[];
}

/** POST /api/admin/users/{id}/reset-password body. */
export interface ResetPasswordRequest {
  newPassword: string;
}

// ── services / roles ──────────────────────────────────────────────────────────

/** GET /api/admin/services — the platform's per-service access keys. */
export interface ServiceKey {
  key: string;
  nameFa: string;
  nameEn: string;
}
