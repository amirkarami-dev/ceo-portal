import type { AppRole, Permission } from "@/contracts/rbac";
import type { SessionUser } from "@/contracts";

const KEY = "report.mockUser";
const TENANT = "tenant-acme";

const FA_NAME: Record<AppRole, string> = {
  SuperAdmin: "مدیر ارشد",
  TenantAdmin: "مدیر سازمان",
  AIManager: "مدیر هوش مصنوعی",
  ReportDesigner: "طراح گزارش",
  DashboardDesigner: "طراح داشبورد",
  PowerUser: "کاربر پیشرفته",
  Viewer: "بیننده",
};

const ALL_ROLES: AppRole[] = [
  "SuperAdmin",
  "TenantAdmin",
  "AIManager",
  "ReportDesigner",
  "DashboardDesigner",
  "PowerUser",
  "Viewer",
];

export const MOCK_PERSONAS: Record<AppRole, SessionUser> = Object.fromEntries(
  ALL_ROLES.map((r) => [
    r,
    {
      id: `mock-${r}`,
      name: FA_NAME[r],
      email: `${r.toLowerCase()}@acme.test`,
      tenantId: r === "SuperAdmin" ? null : TENANT,
      roles: [r],
      grants: [] as Permission[],
    } satisfies SessionUser,
  ]),
) as Record<AppRole, SessionUser>;

export function getMockUser(): SessionUser {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      /* fall through to default */
    }
  }
  return setMockUser(["PowerUser"]);
}

export function setMockUser(roles: AppRole[]): SessionUser {
  const primary = roles[0] ?? "Viewer";
  const base = MOCK_PERSONAS[primary];
  const user: SessionUser = { ...base, roles };
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}
