/**
 * Every cache key in the dashboard. Each resource exposes:
 *   `all()`  — the invalidation prefix (invalidating it drops lists AND details)
 *   plus its concrete query keys.
 */
export const queryKeys = {
  me: {
    all: () => ["me"] as const,
    get: () => ["me", "engineer"] as const,
  },
  services: {
    all: () => ["services"] as const,
    active: () => ["services", "active"] as const,
    admin: () => ["services", "admin"] as const,
  },
  pools: {
    all: () => ["pools"] as const,
    admin: (serviceId?: number) => ["pools", "admin", serviceId ?? 0] as const,
    forDate: (serviceId: number, date: string) => ["pools", "for-date", serviceId, date] as const,
    calendar: (serviceId: number) => ["pools", "calendar", serviceId] as const,
  },
  reservations: {
    all: () => ["reservations"] as const,
    mine: () => ["reservations", "mine"] as const,
    admin: (params: object) => ["reservations", "admin", params] as const,
  },
  payments: {
    all: () => ["payments"] as const,
    admin: (params: object) => ["payments", "admin", params] as const,
  },
} as const;

export type QueryKey = readonly unknown[];
