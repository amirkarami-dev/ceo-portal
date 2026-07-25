import { useMemo, useState, useCallback } from "react";
import { Tag, Button, Space, message } from "antd";
import { useTranslation } from "react-i18next";
import type { Tenant, TenantStatus } from "../../contracts";
import { useTenants, useUpsertTenant, useSetTenantStatus } from "../../api/queries";
import { TenantFormModal } from "./TenantFormModal";
import { useTenantStore } from "@/store/tenant-store";
import {
  PageHeader,
  PageContainer,
  DataTable,
  EmptyState,
  confirmAction,
} from "../../components/ui";

const STATUS_COLOR: Record<TenantStatus, string> = {
  active: "green",
  trial: "gold",
  suspended: "red",
};

export function TenantList() {
  const { t } = useTranslation();
  const { data: tenants, isLoading, error } = useTenants();
  const upsert = useUpsertTenant();
  const setStatus = useSetTenantStatus();
  const setCurrentTenant = useTenantStore((s) => s.setCurrentTenant);
  const [modal, setModal] = useState<{ open: boolean; initial?: Tenant }>({ open: false });

  const suspend = useCallback(
    (tn: Tenant) => {
      confirmAction({
        title: t("admin.tenants.suspendTitle"),
        content: t("admin.tenants.suspendWarn", { name: tn.displayName }),
        onOk: () => setStatus.mutate({ id: tn.id, status: "suspended" }),
      });
    },
    [t, setStatus],
  );

  const switchTenant = useCallback(
    (tn: Tenant) => {
      setCurrentTenant(tn.id);
      void message.success(t("admin.tenants.switched", { name: tn.displayName }));
    },
    [setCurrentTenant, t],
  );

  const openModal = useCallback((initial?: Tenant) => setModal({ open: true, initial }), []);
  const closeModal = useCallback(() => setModal({ open: false }), []);

  const columns = useMemo(
    () => [
      { title: t("admin.tenants.displayName"), dataIndex: "displayName" },
      { title: t("admin.tenants.slug"), dataIndex: "slug" },
      {
        title: t("admin.tenants.plan"),
        dataIndex: "plan",
        render: (p: string) => t(`admin.tenant.planValue.${p}`),
      },
      {
        title: t("admin.tenants.status"),
        dataIndex: "status",
        render: (s: TenantStatus) => (
          <Tag color={STATUS_COLOR[s]}>{t(`admin.tenants.statusValue.${s}`)}</Tag>
        ),
      },
      {
        title: t("common.actions"),
        render: (_: unknown, tn: Tenant) => (
          <Space>
            <Button size="small" onClick={() => openModal(tn)}>
              {t("common.edit")}
            </Button>
            <Button size="small" type="primary" onClick={() => switchTenant(tn)}>
              {t("admin.tenants.switch")}
            </Button>
            {tn.status === "suspended" ? (
              <Button
                size="small"
                onClick={() => setStatus.mutate({ id: tn.id, status: "active" })}
              >
                {t("admin.tenants.reactivate")}
              </Button>
            ) : (
              <Button size="small" danger onClick={() => suspend(tn)}>
                {t("admin.tenants.suspend")}
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [t, openModal, setStatus, suspend, switchTenant],
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("admin.tenants.title")}
        actions={
          <Button type="primary" onClick={() => openModal()}>
            {t("admin.tenants.create")}
          </Button>
        }
      />
      <DataTable<Tenant>
        rowKey="id"
        columns={columns}
        data={tenants}
        loading={isLoading}
        error={error}
        empty={
          <EmptyState
            description={t("admin.tenants.empty")}
            action={
              <Button type="primary" onClick={() => openModal()}>
                {t("admin.tenants.create")}
              </Button>
            }
          />
        }
      />
      <TenantFormModal
        open={modal.open}
        initial={modal.initial}
        onCancel={closeModal}
        onSave={(tn) => {
          upsert.mutate(tn);
          closeModal();
        }}
      />
    </PageContainer>
  );
}
