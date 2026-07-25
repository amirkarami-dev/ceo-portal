import type { Tenant } from "../contracts/tenant";
import type { AppRole } from "../contracts/rbac";
import type { SavedReport, DashboardRecord } from "./queries";
import {
  SEED_TENANTS,
  SEED_USERS,
  SEED_PROVIDERS,
  SEED_REPORTS,
  SEED_DASHBOARDS,
  SEED_AUDIT,
} from "./seed";

// ----- Domain row types used by admin screens -----

export interface AIProviderRow {
  id: string;
  tenantId: string;
  type: "OpenAI" | "Azure" | "Ollama" | "Claude";
  model: string;
  status: "active" | "inactive";
}

export interface UserRow {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: AppRole[];
  status: "active" | "suspended";
}

export interface AuditRow {
  id: string;
  tenantId: string;
  actorId: string;
  type: string;
  ts: string;
  tokens?: number;
  cost?: number;
}

// Reports are stored as SavedReport envelopes plus a tenantId for scoped listing.
// The tenantId is NOT part of the public SavedReport type (used only internally).
export type StoredReport = SavedReport & { tenantId: string };

// ----- Generic localStorage collection -----

interface HasId {
  id: string;
}
interface Scoped extends HasId {
  tenantId?: string;
}

const DELAY = 200;
const sleep = () => new Promise<void>((r) => setTimeout(r, DELAY));
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

function read<T extends HasId>(key: string, seed: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw) as T[];
    } catch {
      /* fall through to seed */
    }
  }
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function write<T extends HasId>(key: string, rows: T[]): void {
  localStorage.setItem(key, JSON.stringify(rows));
}

function collection<T extends Scoped>(key: string, seed: T[], idPrefix: string) {
  return {
    async list(tenantId?: string): Promise<T[]> {
      await sleep();
      const rows = read<T>(key, seed);
      return tenantId ? rows.filter((r) => r.tenantId === undefined || r.tenantId === tenantId) : rows;
    },
    async get(id: string): Promise<T | null> {
      await sleep();
      return read<T>(key, seed).find((r) => r.id === id) ?? null;
    },
    async save(entity: T): Promise<T> {
      await sleep();
      const rows = read<T>(key, seed);
      const ts = new Date().toISOString();
      const withCreated = entity as T & { createdAt?: string; updatedAt?: string };
      if (!entity.id) {
        const created = { ...entity, id: uid(idPrefix), createdAt: ts, updatedAt: ts } as T;
        write(key, [...rows, created]);
        return created;
      }
      const stamped = { ...entity, createdAt: withCreated.createdAt, updatedAt: ts } as T;
      const next = rows.map((r) => (r.id === entity.id ? stamped : r));
      write(key, next);
      return stamped;
    },
    async remove(id: string): Promise<void> {
      await sleep();
      write(key, read<T>(key, seed).filter((r) => r.id !== id));
    },
  };
}

const K = {
  reports: "report.db.reports",
  dashboards: "report.db.dashboards",
  providers: "report.db.providers",
  users: "report.db.users",
  tenants: "report.db.tenants",
  audit: "report.db.audit",
};

export const mockApi = {
  reports: collection<StoredReport>(K.reports, SEED_REPORTS, "rep"),
  dashboards: collection<DashboardRecord>(K.dashboards, SEED_DASHBOARDS, "dash"),
  providers: collection<AIProviderRow>(K.providers, SEED_PROVIDERS, "prov"),
  users: collection<UserRow>(K.users, SEED_USERS, "u"),
  tenants: collection<Tenant>(K.tenants, SEED_TENANTS, "tenant"),
  audit: collection<AuditRow>(K.audit, SEED_AUDIT, "ev"),

  resetDemoData(): void {
    write(K.reports, SEED_REPORTS);
    write(K.dashboards, SEED_DASHBOARDS);
    write(K.providers, SEED_PROVIDERS);
    write(K.users, SEED_USERS);
    write(K.tenants, SEED_TENANTS);
    write(K.audit, SEED_AUDIT);
  },
};
