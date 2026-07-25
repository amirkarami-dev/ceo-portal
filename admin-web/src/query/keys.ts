import type { UserListParams } from "@/api/types";

/**
 * Every cache key in the panel. Each resource exposes:
 *   `all()`  — the invalidation prefix (invalidating it drops lists AND details)
 *   `list()` — the list query key (may take params)
 *   `byId()` — a detail key, where the API has one
 */
export const queryKeys = {
  users: {
    all: () => ["users"] as const,
    list: (params?: UserListParams) => ["users", "list", params ?? {}] as const,
    byId: (id: string) => ["users", "detail", id] as const,
  },
  roles: {
    all: () => ["roles"] as const,
    list: () => ["roles", "list"] as const,
  },
  services: {
    all: () => ["services"] as const,
    list: () => ["services", "list"] as const,
  },
} as const;

export type QueryKey = readonly unknown[];
