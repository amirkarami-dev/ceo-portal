import { useEffect, useMemo, useState } from "react";
import { Button, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { KeyOutlined } from "@ant-design/icons";
import { rolesApi, servicesApi, usersApi } from "@/api/adminApi";
import type {
  CreateUserRequest,
  Paged,
  ServiceKey,
  UpdateUserRequest,
  UserDto,
  UserListParams,
} from "@/api/types";
import { CrudTable, PageHeader } from "@/components/ui";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { formatNumber } from "@/lib/format";
import { UserFormDrawer, type UserFormValues } from "@/features/users/UserFormDrawer";
import { ResetPasswordModal } from "@/features/users/ResetPasswordModal";
import { roleColor, roleLabel, sameSet } from "@/features/users/labels";

const emptyToNull = (v?: string): string | null => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

/** Composite edit payload — profile PUT + the role/service PUTs the page fires only when changed. */
interface SaveUserVars {
  id: string;
  profile: UpdateUserRequest;
  roles: string[];
  services: string[];
  original: UserDto;
}

export function UsersPage() {
  // ── list state ───────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Debounce the box so we don't fire a request per keystroke; reset to page 1 on a new term.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params: UserListParams = useMemo(
    () => ({ search: search || undefined, page, pageSize }),
    [search, page, pageSize],
  );

  const query = useApiQuery<Paged<UserDto>>(queryKeys.users.list(params), () =>
    usersApi.list(params),
  );

  // Keep the previous page on screen while the next one loads (no skeleton flash on paging).
  const [snapshot, setSnapshot] = useState<Paged<UserDto>>();
  useEffect(() => {
    if (query.data) setSnapshot(query.data);
  }, [query.data]);
  const paged = query.data ?? snapshot;
  const rows = useMemo(() => paged?.items ?? [], [paged]);
  const total = paged?.total ?? 0;

  // ── reference data (roles for the form, services for both the form and the table) ──
  const rolesQuery = useApiQuery<string[]>(queryKeys.roles.list(), rolesApi.list);
  const servicesQuery = useApiQuery<ServiceKey[]>(queryKeys.services.list(), servicesApi.list);
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const serviceNameOf = useMemo(() => {
    const map = new Map(services.map((s) => [s.key, s.nameFa]));
    return (key: string): string => map.get(key) ?? key;
  }, [services]);

  // ── mutations ───────────────────────────────────────────────────────────
  const createMutation = useApiMutation<CreateUserRequest, { id: string }>({
    mutationFn: (input) => usersApi.create(input),
    invalidate: [queryKeys.users.all()],
    success: "کاربر افزوده شد",
  });

  const updateMutation = useApiMutation<SaveUserVars>({
    mutationFn: async ({ id, profile, roles: nextRoles, services: nextServices, original }) => {
      await usersApi.update(id, profile);
      if (!sameSet(nextRoles, original.roles)) await usersApi.setRoles(id, nextRoles);
      if (!sameSet(nextServices, original.services)) await usersApi.setServices(id, nextServices);
    },
    invalidate: [queryKeys.users.all()],
    success: "کاربر ذخیره شد",
  });

  const deleteMutation = useApiMutation<string>({
    mutationFn: (id) => usersApi.remove(id),
    invalidate: [queryKeys.users.all()],
    success: "کاربر حذف شد",
  });

  const resetMutation = useApiMutation<{ id: string; newPassword: string }>({
    mutationFn: ({ id, newPassword }) => usersApi.resetPassword(id, newPassword),
    success: "رمز عبور تغییر کرد",
  });

  // ── drawer + modal state ──────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (record: UserDto) => {
    setEditing(record);
    setDrawerOpen(true);
  };

  const handleSave = async (values: UserFormValues) => {
    if (editing) {
      await updateMutation.mutateAsync({
        id: editing.id,
        profile: {
          userName: values.userName.trim(),
          email: emptyToNull(values.email),
          phoneNumber: emptyToNull(values.phoneNumber),
          locked: values.locked ?? false,
        },
        roles: values.roles ?? [],
        services: values.services ?? [],
        original: editing,
      });
    } else {
      const password = emptyToNull(values.password);
      await createMutation.mutateAsync({
        userName: values.userName.trim(),
        email: emptyToNull(values.email),
        phoneNumber: emptyToNull(values.phoneNumber),
        password: password ?? undefined,
        roles: values.roles ?? [],
        services: values.services ?? [],
      });
    }
  };

  // ── columns ────────────────────────────────────────────────────────────────
  const columns: ColumnsType<UserDto> = [
    {
      title: "نام کاربری",
      dataIndex: "userName",
      key: "userName",
      width: 180,
      render: (value: string | null) =>
        value ? (
          <Typography.Text strong>{value}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "ایمیل",
      dataIndex: "email",
      key: "email",
      width: 220,
      render: (value: string | null) =>
        value ? (
          <Typography.Text style={{ direction: "ltr", display: "inline-block" }} copyable>
            {value}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "موبایل",
      dataIndex: "phoneNumber",
      key: "phoneNumber",
      width: 140,
      render: (value: string | null) =>
        value ? (
          <Typography.Text style={{ direction: "ltr", display: "inline-block" }}>
            {value}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "نقش‌ها",
      dataIndex: "roles",
      key: "roles",
      width: 160,
      render: (value: string[]) =>
        value.length ? (
          <Space size={4} wrap>
            {value.map((r) => (
              <Tag key={r} color={roleColor(r)} style={{ marginInlineEnd: 0 }}>
                {roleLabel(r)}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "سرویس‌ها",
      dataIndex: "services",
      key: "services",
      width: 240,
      render: (value: string[]) =>
        value.length ? (
          <Space size={4} wrap>
            {value.map((key) => (
              <Tag key={key} color="geekblue" style={{ marginInlineEnd: 0 }}>
                {serviceNameOf(key)}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">بدون دسترسی</Typography.Text>
        ),
    },
    {
      title: "وضعیت",
      dataIndex: "isLocked",
      key: "isLocked",
      width: 110,
      align: "center",
      render: (locked: boolean) =>
        locked ? <Tag color="red">قفل‌شده</Tag> : <Tag color="green">فعال</Tag>,
    },
  ];

  return (
    <>
      <PageHeader
        title="کاربران"
        subtitle={
          query.isLoading ? "مدیریت کاربران سکو" : `${formatNumber(total)} کاربر`
        }
      />

      <CrudTable<UserDto>
        columns={columns}
        // `undefined` until the first page lands -> CrudTable shows its skeleton instead of an empty grid.
        data={paged ? rows : undefined}
        loading={query.isLoading || query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRefresh={() => void query.refetch()}
        searchable
        searchPlaceholder="جستجو بر اساس نام کاربری، ایمیل یا موبایل…"
        searchValue={searchInput}
        onSearch={setSearchInput}
        onCreate={openCreate}
        createLabel="افزودن کاربر"
        onEdit={openEdit}
        rowActions={(record) => (
          <Tooltip title="تغییر رمز عبور">
            <Button
              type="text"
              aria-label="تغییر رمز عبور"
              icon={<KeyOutlined />}
              onClick={() => setResetTarget(record)}
            />
          </Tooltip>
        )}
        onDelete={(record) => deleteMutation.mutate(record.id)}
        deleteConfirmTitle={(record) => `کاربر «${record.userName ?? record.email ?? "بدون‌نام"}» حذف شود؟`}
        deleting={deleteMutation.isPending}
        emptyText={search ? "کاربری با این جستجو یافت نشد" : "هنوز کاربری ثبت نشده است"}
        emptyAction={
          !search ? (
            <Button type="primary" onClick={openCreate}>
              افزودن کاربر
            </Button>
          ) : null
        }
        actionsWidth={150}
        scrollX={1200}
        pagination={{
          current: paged?.page ?? page,
          pageSize: paged?.pageSize ?? pageSize,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />

      <UserFormDrawer
        open={drawerOpen}
        editing={editing}
        roles={roles}
        services={services}
        rolesLoading={rolesQuery.isLoading}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSave}
      />

      <ResetPasswordModal
        open={resetTarget !== null}
        userName={resetTarget?.userName ?? resetTarget?.email}
        submitting={resetMutation.isPending}
        onClose={() => setResetTarget(null)}
        onSubmit={async (newPassword) => {
          if (resetTarget) await resetMutation.mutateAsync({ id: resetTarget.id, newPassword });
        }}
      />
    </>
  );
}

export default UsersPage;
