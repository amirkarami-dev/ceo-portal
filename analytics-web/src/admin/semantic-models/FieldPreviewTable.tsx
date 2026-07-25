import { Table, Tag, Space } from "antd";
import { useTranslation } from "react-i18next";
import type { Field } from "../../contracts";

interface FieldPreviewTableProps {
  fields: Field[];
  entityId?: string;
}

export function FieldPreviewTable({ fields, entityId }: FieldPreviewTableProps) {
  const { t } = useTranslation();

  return (
    <Table<Field>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={fields}
      columns={[
        { title: t("admin.sm.field"), dataIndex: "id" as const },
        {
          title: t("admin.sm.label"),
          dataIndex: "label" as const,
          render: (lbl: Field["label"]) => lbl["fa-IR"] || lbl["en-US"],
        },
        {
          title: t("admin.sm.type"),
          dataIndex: "type" as const,
          render: (ty: string) => <Tag>{t(`admin.sm.fieldType.${ty}`)}</Tag>,
        },
        {
          title: t("admin.sm.kind"),
          render: (_: unknown, f: Field) => {
            const isMeasure = f.role === "measure";
            const testId = entityId ? `field-kind-${entityId}.${f.id}` : `field-kind-${f.id}`;
            return (
              <span data-testid={testId}>
                <Tag color={isMeasure ? "blue" : "geekblue"}>
                  {isMeasure ? t("admin.sm.measure") : t("admin.sm.dimension")}
                </Tag>
              </span>
            );
          },
        },
        {
          title: t("admin.sm.defaultAgg"),
          dataIndex: "defaultAggregation" as const,
          render: (a?: string) => (a ? t(`agg.${a}`) : "—"),
        },
        {
          title: t("admin.sm.synonyms"),
          dataIndex: "synonyms" as const,
          render: (syn?: string[]) =>
            syn?.length ? (
              <Space size={4} wrap>
                {syn.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </Space>
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}
