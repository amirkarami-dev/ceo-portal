import { useMemo, useState } from "react";
import { Tag, Space, Select, DatePicker, Button } from "antd";
import { useTranslation } from "react-i18next";
import { useAuditEvents, type AuditFilter } from "../../api/queries";
import { AuditEventDrawer, type AuditRowExt } from "./AuditEventDrawer";
import { AuditCostChart } from "./AuditCostChart";
import { downloadBlob } from "../../features/export/download";
import {
  PageHeader,
  PageContainer,
  DataTable,
  EmptyState,
} from "../../components/ui";

const KNOWN_TYPES = [
  "ai.generate",
  "report.run",
  "export.csv",
  "AiRequest",
  "ReportExecution",
  "Export",
  "FailedQuery",
  "UserActivity",
  "ProviderChange",
] as const;

/** Minimal RFC-4180 CSV helper — avoids importing QueryResult-based toCsv. */
function escapeCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(
  headers: string[],
  rows: Record<string, string | number | null | undefined>[],
): string {
  const head = headers.map(escapeCell).join(",");
  const body = rows
    .map((r) => headers.map((h) => escapeCell(r[h])).join(","))
    .join("\r\n");
  return rows.length ? `${head}\r\n${body}` : head;
}

export function AuditLog() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AuditFilter>({});
  const { data: events, isLoading, error } = useAuditEvents(filter);
  const [selected, setSelected] = useState<AuditRowExt | null>(null);

  const list = (events ?? []) as AuditRowExt[];

  const exportCsv = () => {
    const headers = ["id", "ts", "actorId", "actorName", "type", "status", "tokens", "cost"];
    const rows = list.map((e) => ({
      id: e.id,
      ts: e.ts,
      actorId: e.actorId,
      actorName: e.actorName ?? null,
      type: e.type,
      status: e.status ?? null,
      tokens: e.tokens ?? null,
      cost: e.cost ?? null,
    }));
    downloadBlob(rowsToCsv(headers, rows), `audit-${Date.now()}.csv`, "text/csv");
  };

  const columns = useMemo(
    () => [
      {
        title: t("admin.audit.time"),
        dataIndex: "ts",
        render: (ts: string) => new Date(ts).toLocaleString(),
      },
      {
        title: t("admin.audit.actor"),
        dataIndex: "actorId",
        render: (_: unknown, e: AuditRowExt) => e.actorName ?? e.actorId,
      },
      {
        title: t("admin.audit.eventType"),
        dataIndex: "type",
        render: (ty: string) => (
          <Tag>{t(`admin.audit.type.${ty}`, { defaultValue: ty })}</Tag>
        ),
      },
      {
        title: t("admin.audit.status"),
        dataIndex: "status",
        render: (s?: string) => {
          if (!s) return "—";
          const color = s === "ok" ? "green" : s === "error" ? "red" : undefined;
          return (
            <Tag color={color}>
              {t(`admin.audit.statusValue.${s}`, { defaultValue: s })}
            </Tag>
          );
        },
      },
      {
        title: t("admin.audit.tokens"),
        dataIndex: "tokens",
        render: (v?: number) => v ?? "—",
      },
      {
        title: t("admin.audit.cost"),
        dataIndex: "cost",
        render: (v?: number) => (v != null ? `$${v.toFixed(4)}` : "—"),
      },
    ],
    [t],
  );

  const toolbar = (
    <Space wrap style={{ marginBottom: 16 }}>
      <DatePicker.RangePicker
        onChange={(_d, [from, to]) =>
          setFilter((f) => ({ ...f, from: from || undefined, to: to || undefined }))
        }
      />
      <Select
        allowClear
        placeholder={t("admin.audit.eventType")}
        style={{ width: 200 }}
        options={KNOWN_TYPES.map((ty) => ({
          value: ty,
          label: t(`admin.audit.type.${ty}`, { defaultValue: ty }),
        }))}
        onChange={(ty: string | undefined) => setFilter((f) => ({ ...f, type: ty }))}
      />
      <Select
        allowClear
        placeholder={t("admin.audit.status")}
        style={{ width: 140 }}
        options={[
          { value: "ok", label: t("admin.audit.statusValue.ok") },
          { value: "error", label: t("admin.audit.statusValue.error") },
        ]}
        onChange={(s: string | undefined) => setFilter((f) => ({ ...f, status: s }))}
      />
      <Button onClick={exportCsv} disabled={list.length === 0}>
        {t("admin.audit.exportCsv")}
      </Button>
    </Space>
  );

  return (
    <PageContainer>
      <PageHeader title={t("admin.audit.title")} />
      <div style={{ marginBottom: 16 }}>
        <AuditCostChart />
      </div>
      <DataTable<AuditRowExt>
        rowKey="id"
        columns={columns}
        data={list}
        loading={isLoading}
        error={error}
        toolbar={toolbar}
        empty={<EmptyState description={t("admin.audit.empty")} />}
        onRow={(e) => ({
          onClick: () => setSelected(e),
          style: { cursor: "pointer" },
        })}
      />
      <AuditEventDrawer event={selected} onClose={() => setSelected(null)} />
    </PageContainer>
  );
}
