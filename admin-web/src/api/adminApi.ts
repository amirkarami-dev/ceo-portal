import { api, qs, ADMIN_PREFIX } from "./client";
import type {
  CreateUserRequest,
  CreateUserResult,
  Paged,
  ResetPasswordRequest,
  RolesRequest,
  ServiceKey,
  ServicesRequest,
  UpdateUserRequest,
  UserDto,
  UserListParams,
} from "./types";

const A = ADMIN_PREFIX;

/** GUIDs are URL-safe, but encode defensively in case an id ever contains a reserved char. */
const idPath = (id: string): string => encodeURIComponent(id);

// ── users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  list: (params?: UserListParams): Promise<Paged<UserDto>> =>
    api.get<Paged<UserDto>>(`${A}/users${qs({ ...params })}`),
  byId: (id: string): Promise<UserDto> => api.get<UserDto>(`${A}/users/${idPath(id)}`),
  /** Resolves to the new user's id. Roles/services can be supplied inline in the body. */
  create: (input: CreateUserRequest): Promise<CreateUserResult> =>
    api.post<CreateUserResult>(`${A}/users`, input),
  /** Profile fields only (userName/email/phoneNumber/locked). 204. */
  update: (id: string, input: UpdateUserRequest): Promise<void> =>
    api.put(`${A}/users/${idPath(id)}`, input),
  /** Replaces the whole role set. 204. */
  setRoles: (id: string, roles: string[]): Promise<void> =>
    api.put(`${A}/users/${idPath(id)}/roles`, { roles } satisfies RolesRequest),
  /** Replaces the whole per-service access list. 204. */
  setServices: (id: string, services: string[]): Promise<void> =>
    api.put(`${A}/users/${idPath(id)}/services`, { services } satisfies ServicesRequest),
  resetPassword: (id: string, newPassword: string): Promise<void> =>
    api.post<void>(`${A}/users/${idPath(id)}/reset-password`, {
      newPassword,
    } satisfies ResetPasswordRequest),
  /** 400s with a Persian `detail` when the backend refuses (last admin / deleting yourself). */
  remove: (id: string): Promise<void> => api.del(`${A}/users/${idPath(id)}`),
};

// ── roles ────────────────────────────────────────────────────────────────────

export const rolesApi = {
  /** e.g. ["Administrator", "User"]. */
  list: (): Promise<string[]> => api.get<string[]>(`${A}/roles`),
};

// ── services ─────────────────────────────────────────────────────────────────

export const servicesApi = {
  /** The 5 platform services (mabhas19, analytics, mun-sanandaj, landing-panel, plan). */
  list: (): Promise<ServiceKey[]> => api.get<ServiceKey[]>(`${A}/services`),
};
