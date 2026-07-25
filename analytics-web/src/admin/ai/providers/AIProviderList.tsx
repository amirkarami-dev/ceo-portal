import { useCallback, useMemo, useState } from "react";
import { Tag, Button, Space, Alert, message } from "antd";
import { useTranslation } from "react-i18next";
import type { ProviderConfig } from "../../../contracts";
import { useTenantAIConfig, useUpdateTenantAIConfig, useTestProvider } from "../../../api/queries";
import { ProviderFormModal } from "./ProviderFormModal";
import {
  PageHeader,
  DataTable,
  EmptyState,
  confirmAction,
} from "../../../components/ui";

export function AIProviderList() {
  const { t } = useTranslation();
  const { data: cfg, isLoading, error } = useTenantAIConfig();
  const update = useUpdateTenantAIConfig();
  const test = useTestProvider();
  const [modal, setModal] = useState<{ open: boolean; initial?: ProviderConfig }>({ open: false });
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; latencyMs: number; error?: string } | null>(null);

  const providers = cfg?.providers ?? [];

  const save = (p: ProviderConfig) => {
    if (!cfg) return;
    const exists = cfg.providers.some((x) => x.id === p.id);
    const providersNext = exists ? cfg.providers.map((x) => (x.id === p.id ? p : x)) : [...cfg.providers, p];
    update.mutate({ ...cfg, providers: providersNext });
    setModal({ open: false });
  };

  const remove = useCallback(
    (id: string) => {
      if (!cfg) return;
      confirmAction({
        title: t("common.delete"),
        onOk: () => {
          update.mutate({
            ...cfg,
            providers: cfg.providers.filter((x) => x.id !== id),
            fallbackChain: cfg.fallbackChain.filter((f) => f !== id),
          });
        },
      });
    },
    [cfg, update, t],
  );

  const runTest = useCallback(
    async (id: string) => {
      const r = await test.mutateAsync(id);
      setTestResult({ id, ...r });
      if (r.ok) void message.success(t("admin.ai.testOk", { ms: r.latencyMs }));
    },
    [test, t],
  );

  const columns = useMemo(
    () => [
      { title: t("admin.ai.colType"), dataIndex: "type", render: (v: string) => t(`admin.ai.type.${v}`) },
      { title: t("admin.ai.model"), dataIndex: "model" },
      { title: t("admin.ai.apiKey"), dataIndex: "keyRef", render: (k: string | null) => (k ? "•••••" : <Tag>{t("admin.ai.noKey")}</Tag>) },
      { title: t("admin.ai.status"), dataIndex: "enabled", render: (e: boolean) => <Tag color={e ? "green" : "default"}>{e ? t("admin.ai.enabled") : t("admin.ai.disabled")}</Tag> },
      {
        title: t("common.actions"),
        render: (_: unknown, r: ProviderConfig) => (
          <Space>
            <Button size="small" loading={test.isPending} onClick={() => void runTest(r.id)}>{t("admin.ai.testConnection")}</Button>
            <Button size="small" onClick={() => setModal({ open: true, initial: r })}>{t("common.edit")}</Button>
            <Button size="small" danger onClick={() => remove(r.id)}>{t("common.delete")}</Button>
          </Space>
        ),
      },
    ],
    [t, test.isPending, runTest, remove],
  );

  return (
    <div>
      <PageHeader
        title={t("admin.ai.providersTitle")}
        actions={
          <Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.ai.addProvider")}</Button>
        }
      />
      {testResult && !testResult.ok && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("admin.ai.testFailed")}
          description={testResult.error}
          closable
          onClose={() => setTestResult(null)}
        />
      )}
      <DataTable<ProviderConfig>
        rowKey="id"
        columns={columns}
        data={providers}
        loading={isLoading}
        error={error}
        empty={
          <EmptyState
            description={t("admin.ai.noProviders")}
            action={<Button type="primary" onClick={() => setModal({ open: true })}>{t("admin.ai.addProvider")}</Button>}
          />
        }
      />
      <ProviderFormModal
        open={modal.open}
        initial={modal.initial}
        onCancel={() => setModal({ open: false })}
        onSave={save}
      />
    </div>
  );
}
