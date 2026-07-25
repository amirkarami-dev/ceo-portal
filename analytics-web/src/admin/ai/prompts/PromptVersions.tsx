import { Table, Tag, Button } from "antd";
import { useTranslation } from "react-i18next";
import { usePromptVersions, type PromptTemplate } from "../usePromptVersions";
import { PageHeader } from "../../../components/ui";

export function PromptVersions() {
  const { t } = useTranslation();
  const { data } = usePromptVersions();

  return (
    <div>
      <PageHeader title={t("admin.ai.promptsTitle")} />
      <Table<PromptTemplate>
        rowKey="id"
        dataSource={data ?? []}
        size="middle"
        pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
        columns={[
          { title: t("admin.ai.templateName"), dataIndex: "name" },
          {
            title: t("admin.ai.activeVersion"),
            dataIndex: "activeVersion",
            render: (v: string) => <Tag color="green">{v}</Tag>,
          },
          { title: t("admin.ai.versionCount"), render: (_, r) => r.versions.length },
        ]}
        expandable={{
          expandedRowRender: (r) => (
            <Table
              rowKey="version"
              size="small"
              pagination={false}
              dataSource={r.versions}
              columns={[
                { title: t("admin.ai.version"), dataIndex: "version" },
                { title: t("admin.ai.note"), dataIndex: "note" },
                {
                  title: t("admin.ai.createdAt"),
                  dataIndex: "createdAt",
                  render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—"),
                },
                {
                  title: t("admin.ai.status"),
                  dataIndex: "active",
                  render: (a: boolean) =>
                    a ? (
                      <Tag color="green">{t("admin.ai.active")}</Tag>
                    ) : (
                      <Button size="small">{t("admin.ai.rollTo")}</Button>
                    ),
                },
              ]}
            />
          ),
        }}
      />
    </div>
  );
}
