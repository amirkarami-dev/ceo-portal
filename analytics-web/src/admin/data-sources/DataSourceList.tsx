import { useMemo, useState, useCallback } from "react";
import { Tag, Button, Space, Alert, message } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { DataSourceRecord } from "../../api/queries";
import { useDataSources, useTestDataSource } from "../../api/queries";
import {
  PageHeader,
  PageContainer,
  DataTable,
  EmptyState,
} from "../../components/ui";

const STATUS_COLOR: Record<DataSourceRecord["status"], string> = {
  connected: "green",
  error: "red",
  unconfigured: "default",
};

export function DataSourceList() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data: sources, isLoading, error } = useDataSources();
  const test = useTestDataSource();
  const [err, setErr] = useState<string | null>(null);

  const runTest = useCallback(
    async (id: string) => {
      const r = await test.mutateAsync(id);
      if (r.ok) {
        void message.success(t("admin.ds.testOk"));
      } else {
        setErr(r.error ?? t("admin.ds.testFailed"));
      }
    },
    [test, t],
  );

  const goToModel = useCallback(
    (id: string) => nav(`/admin/semantic-models?model=${id}`),
    [nav],
  );

  const syncSchema = useCallback(() => {
    void message.success(t("admin.ds.syncOk"));
  }, [t]);

  const columns = useMemo(
    () => [
      { title: t("admin.ds.name"), dataIndex: "name" as const },
      {
        title: t("admin.ds.kindLabel"),
        dataIndex: "kind" as const,
        render: (k: string) => t(`admin.ds.kind.${k}`),
      },
      {
        title: t("admin.ds.rowCount"),
        dataIndex: "rowCount" as const,
        render: (n?: number) => (n !== undefined ? n.toLocaleString() : "—"),
      },
      {
        title: t("admin.ds.status"),
        dataIndex: "status" as const,
        render: (s: DataSourceRecord["status"]) => (
          <Tag color={STATUS_COLOR[s]}>{t(`admin.ds.statusValue.${s}`)}</Tag>
        ),
      },
      {
        title: t("admin.ds.semanticModel"),
        dataIndex: "semanticModelId" as const,
        render: (id: string) => (
          <Button type="link" onClick={() => goToModel(id)}>
            {id}
          </Button>
        ),
      },
      {
        title: t("common.actions"),
        render: (_: unknown, r: DataSourceRecord) => (
          <Space>
            <Button size="small" onClick={() => void runTest(r.id)}>
              {t("admin.ds.testConnection")}
            </Button>
            <Button size="small" onClick={syncSchema}>
              {t("admin.ds.syncSchema")}
            </Button>
          </Space>
        ),
      },
    ],
    [t, goToModel, runTest, syncSchema],
  );

  const list = sources ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={t("admin.ds.title")}
        actions={<Button type="primary">{t("admin.ds.addSource")}</Button>}
      />
      {err && (
        <Alert
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message={t("admin.ds.testFailed")}
          description={err}
          onClose={() => setErr(null)}
        />
      )}
      <DataTable<DataSourceRecord>
        rowKey="id"
        columns={columns}
        data={list}
        loading={isLoading}
        error={error}
        empty={
          <EmptyState
            description={t("admin.ds.empty")}
            action={
              <Space>
                <Button type="primary">{t("admin.ds.addSource")}</Button>
                <Button onClick={() => nav("/admin/semantic-models")}>
                  {t("admin.ds.useSamples")}
                </Button>
              </Space>
            }
          />
        }
      />
    </PageContainer>
  );
}
