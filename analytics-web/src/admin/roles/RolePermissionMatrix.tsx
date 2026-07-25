import { useCallback, useMemo, useState } from "react";
import { Table, Checkbox, Tag, Alert } from "antd";
import { useTranslation } from "react-i18next";
import { ROLE_PERMISSIONS, isGlobal, type AppRole, type Permission } from "../../contracts";
import { useAuth } from "../../auth/useAuth";
import { PageHeader, PageContainer } from "../../components/ui";

const ROLES: AppRole[] = [
  "SuperAdmin",
  "TenantAdmin",
  "AIManager",
  "ReportDesigner",
  "DashboardDesigner",
  "PowerUser",
  "Viewer",
];

const PERMS: Permission[] = [
  "reports:write",
  "reports:delete",
  "reports:execute",
  "data:export",
  "ai:manage",
  "datasources:manage",
  "users:manage",
  "audit:read",
];

export function RolePermissionMatrix() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const editable = isGlobal(roles);

  const [overrides, setOverrides] = useState<Record<AppRole, Set<Permission>>>(() => {
    const m = {} as Record<AppRole, Set<Permission>>;
    for (const r of ROLES) m[r] = new Set(ROLE_PERMISSIONS[r]);
    return m;
  });

  const granted = useCallback(
    (r: AppRole, p: Permission) => overrides[r].has(p),
    [overrides],
  );

  const toggle = useCallback(
    (r: AppRole, p: Permission) => {
      if (!editable) return;
      setOverrides((prev) => {
        const next = { ...prev, [r]: new Set(prev[r]) };
        if (next[r].has(p)) { next[r].delete(p); } else { next[r].add(p); }
        return next;
      });
    },
    [editable],
  );

  const columns = useMemo(
    () => [
      {
        title: t("rbac.roleHeader"),
        dataIndex: "role",
        render: (r: AppRole) => <Tag>{t(`rbac.role.${r}`)}</Tag>,
      },
      ...PERMS.map((p) => ({
        title: <span data-testid={`perm-col-${p}`}>{t(`rbac.perm.${p}`)}</span>,
        key: p,
        align: "center" as const,
        render: (_: unknown, rec: { role: AppRole }) => (
          <span
            data-testid={`cell-${rec.role}-${p}`}
            data-granted={String(granted(rec.role, p))}
          >
            <Checkbox
              checked={granted(rec.role, p)}
              disabled={!editable}
              onChange={() => toggle(rec.role, p)}
            />
          </span>
        ),
      })),
    ],
    [t, editable, granted, toggle],
  );

  return (
    <PageContainer>
      <div data-testid="role-permission-matrix">
        <PageHeader title={t("admin.users.rolesTitle")} />
        {!editable && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t("admin.users.matrixReadOnly")}
          />
        )}
        <Table
          rowKey="role"
          pagination={false}
          dataSource={ROLES.map((role) => ({ role }))}
          columns={columns}
          size="middle"
          onRow={(rec) => ({ "data-testid": `role-row-${rec.role}` } as React.HTMLAttributes<HTMLElement>)}
        />
      </div>
    </PageContainer>
  );
}
