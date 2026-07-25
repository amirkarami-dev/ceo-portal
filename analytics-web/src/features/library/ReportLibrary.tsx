// report-web/src/features/library/ReportLibrary.tsx
import { Button, Dropdown, Input, Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import type { SavedReport } from "@/api/queries";
import { useDeleteReport, useReports } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Loading,
  PageContainer,
  PageHeader,
  Toolbar,
} from "@/components/ui";

export function ReportLibrary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { data, isLoading, isError, refetch } = useReports();
  const del = useDeleteReport();
  const [q, setQ] = useState("");
  const [model, setModel] = useState<string | undefined>();
  const [tag, setTag] = useState<string | undefined>();

  const canManage =
    roles.includes("ReportDesigner") ||
    roles.includes("TenantAdmin") ||
    roles.includes("SuperAdmin");

  const rows = useMemo(() => {
    const all = data ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((r) => {
      const d = r.definition;
      if (needle && !d.name.toLowerCase().includes(needle) && !(d.description ?? "").toLowerCase().includes(needle))
        return false;
      if (model && d.dataset !== model) return false;
      if (tag && !(d.tags ?? []).includes(tag)) return false;
      return true;
    });
  }, [data, q, model, tag]);

  const allModels = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.definition.dataset))),
    [data],
  );
  const allTags = useMemo(
    () => Array.from(new Set((data ?? []).flatMap((r) => r.definition.tags ?? []))),
    [data],
  );

  const columns: ColumnsType<SavedReport> = [
    {
      title: t("library.colName"),
      dataIndex: ["definition", "name"],
      sorter: (a, b) => a.definition.name.localeCompare(b.definition.name),
      render: (_v, r) => <Link to={`/reports/${r.id}`}>{r.definition.name}</Link>,
    },
    { title: t("library.colOwner"), dataIndex: "ownerName" },
    { title: t("library.colModel"), dataIndex: ["definition", "dataset"] },
    {
      title: t("library.colTags"),
      dataIndex: ["definition", "tags"],
      render: (tags: string[] = []) => tags.map((x) => <Tag key={x}>{x}</Tag>),
    },
    {
      title: t("library.colVisibility"),
      dataIndex: "visibility",
      render: (v: string) => (
        <Tag color={v === "tenant" ? "blue" : "default"}>{t(`library.vis.${v}`)}</Tag>
      ),
    },
    {
      title: t("library.colLastRun"),
      dataIndex: "lastRunAt",
      sorter: (a, b) => (a.lastRunAt ?? "").localeCompare(b.lastRunAt ?? ""),
      render: (v?: string) => v ?? "—",
    },
    {
      title: "",
      key: "actions",
      width: 56,
      render: (_v, r) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "run",
                label: t("library.run"),
                onClick: () => navigate(`/reports/${r.id}`),
              },
              ...(canManage
                ? [
                    {
                      key: "edit",
                      label: t("library.edit"),
                      onClick: () => navigate(`/ask?from=${r.id}`),
                    },
                    { type: "divider" as const },
                    {
                      key: "delete",
                      label: t("library.delete"),
                      danger: true,
                      onClick: () => void del.mutate(r.id),
                    },
                  ]
                : []),
            ],
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label={t("library.actions")} />
        </Dropdown>
      ),
    },
  ];

  if (isLoading) return <Loading rows={6} />;
  if (isError)
    return (
      <ErrorState
        title={t("library.loadError")}
        onRetry={() => void refetch()}
      />
    );

  const toolbar = (
    <Toolbar>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input.Search
          allowClear
          placeholder={t("library.searchPlaceholder")}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 240 }}
        />
        <Select
          allowClear
          placeholder={t("library.filterModel")}
          value={model}
          onChange={setModel}
          options={allModels.map((m) => ({ value: m, label: m }))}
          style={{ width: 160 }}
        />
        <Select
          allowClear
          placeholder={t("library.filterTag")}
          value={tag}
          onChange={setTag}
          options={allTags.map((x) => ({ value: x, label: x }))}
          style={{ width: 160 }}
        />
      </div>
    </Toolbar>
  );

  const emptyNode = (
    <EmptyState
      description={t("library.empty")}
      action={
        <Button type="primary" onClick={() => navigate("/ask")}>
          {t("library.askFirst")}
        </Button>
      }
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("reports.title")}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/ask")}
          >
            {t("library.newReport")}
          </Button>
        }
      />
      <DataTable<SavedReport>
        rowKey="id"
        columns={columns}
        data={rows}
        toolbar={toolbar}
        empty={emptyNode}
        pageSize={12}
        onRow={(r) => ({ "data-testid": "report-row", "data-id": r.id })}
      />
    </PageContainer>
  );
}
