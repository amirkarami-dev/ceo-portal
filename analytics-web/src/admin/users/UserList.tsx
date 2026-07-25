import { useCallback, useMemo, useState } from "react";
import { Tag, Button, Space, Switch, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";
import { isGlobal, type AppRole } from "../../contracts";
import { useAuth } from "../../auth/useAuth";
import { useUsers, useUpsertUser, useSetUserActive, type UserRow } from "../../api/queries";
import { useTenantStore } from "../../store/tenant-store";
import { UserFormModal, type AdminUser } from "./UserFormModal";
import {
  PageHeader,
  PageContainer,
  DataTable,
  EmptyState,
} from "../../components/ui";

const ADMIN_ROLES: AppRole[] = ["SuperAdmin", "TenantAdmin"];

/** Convert a UserRow (status string) to an AdminUser (active boolean). */
function rowToAdminUser(u: UserRow): AdminUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    tenantId: u.tenantId ?? "",
    active: u.status === "active",
  };
}

/** Convert an AdminUser back to the UserRow shape for persistence. */
function adminUserToRow(u: AdminUser): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    tenantId: u.tenantId,
    status: u.active ? "active" : "suspended",
  };
}

export function UserList() {
  const { t } = useTranslation();
  const { user: me, roles } = useAuth();
  // Tenant scope: the switched tenant wins, falling back to the signed-in user's own tenant.
  const currentTenantId = useTenantStore((s) => s.currentTenantId);
  const tenantId = currentTenantId ?? (me?.tenantId ?? null);

  const { data: rawUsers, isLoading, error } = useUsers();
  const upsert = useUpsertUser();
  const setActive = useSetUserActive();

  const [modal, setModal] = useState<{ open: boolean; initial?: AdminUser }>({ open: false });
  const [search, setSearch] = useState("");

  const users = useMemo(() => (rawUsers ?? []).map(rowToAdminUser), [rawUsers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? users.filter(
          (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        )
      : users;
  }, [users, search]);

  const activeAdmins = useMemo(
    () => users.filter((u) => u.active && u.roles.some((r) => ADMIN_ROLES.includes(r))),
    [users],
  );

  const toggleActive = useCallback(
    (u: AdminUser, next: boolean) => {
      const isLastAdmin =
        !next &&
        u.roles.some((r) => ADMIN_ROLES.includes(r)) &&
        activeAdmins.length <= 1;
      const isSelf = u.id === me?.id;
      const proceed = () => setActive.mutate({ id: u.id, active: next });

      if (isLastAdmin) {
        Modal.confirm({
          title: t("admin.users.lastAdminTitle"),
          content: t("admin.users.lastAdminWarn"),
          okButtonProps: { disabled: true },
          okText: t("common.ok"),
          cancelText: t("common.cancel"),
        });
        return;
      }
      if (isSelf && !next) {
        Modal.confirm({
          title: t("admin.users.selfDeactivateTitle"),
          content: t("admin.users.selfDeactivateWarn"),
          okText: t("common.confirm"),
          cancelText: t("common.cancel"),
          onOk: proceed,
        });
        return;
      }
      proceed();
    },
    [t, activeAdmins.length, me?.id, setActive],
  );

  const columns = useMemo(
    () => [
      { title: t("admin.users.name"), dataIndex: "name" },
      { title: t("admin.users.email"), dataIndex: "email" },
      {
        title: t("admin.users.roles"),
        dataIndex: "roles",
        render: (rs: AppRole[]) => (
          <Space size={4} wrap>
            {rs.map((r) => (
              <Tag key={r}>{t(`rbac.role.${r}`)}</Tag>
            ))}
          </Space>
        ),
      },
      {
        title: t("admin.users.status"),
        dataIndex: "active",
        render: (_: boolean, u: AdminUser) => (
          <Switch checked={u.active} onChange={(v) => toggleActive(u, v)} />
        ),
      },
      {
        title: t("admin.users.lastActive"),
        dataIndex: "lastActiveAt",
        render: (d?: string) => (d ? new Date(d).toLocaleString() : "—"),
      },
      {
        title: t("common.actions"),
        render: (_: unknown, u: AdminUser) => (
          <Button size="small" onClick={() => setModal({ open: true, initial: u })}>
            {t("common.edit")}
          </Button>
        ),
      },
    ],
    [t, toggleActive],
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("admin.users.title")}
        actions={
          <Button type="primary" onClick={() => setModal({ open: true })}>
            {t("admin.users.inviteUser")}
          </Button>
        }
      />
      <Input.Search
        placeholder={t("common.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />
      <DataTable<AdminUser>
        rowKey="id"
        columns={columns}
        data={filtered}
        loading={isLoading}
        error={error}
        empty={
          <EmptyState
            description={t("admin.users.empty")}
            action={
              <Button type="primary" onClick={() => setModal({ open: true })}>
                {t("admin.users.inviteUser")}
              </Button>
            }
          />
        }
      />
      <UserFormModal
        open={modal.open}
        initial={modal.initial}
        tenantId={tenantId}
        allowSuperAdmin={isGlobal(roles)}
        onCancel={() => setModal({ open: false })}
        onSave={(u) => {
          upsert.mutate(adminUserToRow(u));
          setModal({ open: false });
        }}
      />
    </PageContainer>
  );
}
