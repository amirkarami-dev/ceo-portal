import { AppstoreOutlined } from "@ant-design/icons";
import { Button, Empty, List, Tag } from "antd";
import { useTranslation } from "react-i18next";
import { useReports } from "@/api/queries";
import { FormDrawer } from "@/components/ui";
import { labelLocaleOf, resolveReportTitle } from "@/presentation/labels";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (reportId: string, title: string) => void;
}

export function AddWidgetDrawer({ open, onClose, onPick }: Props) {
  const { t, i18n } = useTranslation();
  // A renamed report shows its new name here too: the rename lives in `titleOverrides`, and
  // `definition.name` deliberately keeps the original.
  const locale = labelLocaleOf(i18n.language);
  const reportTitle = (def: Parameters<typeof resolveReportTitle>[0]) => resolveReportTitle(def, locale);
  const { data, isLoading, isError, refetch } = useReports();

  return (
    <FormDrawer
      open={open}
      title={t("dash.addWidget")}
      onClose={onClose}
      hideSubmit
      width={380}
    >
      {isError ? (
        <Empty description={t("dash.reportsLoadError")}>
          <Button onClick={() => void refetch()}>{t("common.retry")}</Button>
        </Empty>
      ) : !isLoading && (data ?? []).length === 0 ? (
        <Empty description={t("dash.noReports")} />
      ) : (
        <List
          loading={isLoading}
          dataSource={data ?? []}
          renderItem={(r) => (
            <List.Item className="add-widget-list-item">
              <button
                type="button"
                data-testid="add-widget-item"
                className="add-widget-item"
                onClick={() => {
                  onPick(r.id, reportTitle(r.definition));
                  onClose();
                }}
              >
                <AppstoreOutlined className="add-widget-item__icon" />
                <span className="add-widget-item__content">
                  <span className="add-widget-item__title">{reportTitle(r.definition)}</span>
                  <span className="add-widget-item__meta">
                    {r.definition.dataset && <Tag bordered={false}>{r.definition.dataset}</Tag>}
                    {(r.definition.tags ?? []).map((x) => (
                      <Tag key={x}>{x}</Tag>
                    ))}
                  </span>
                </span>
              </button>
            </List.Item>
          )}
        />
      )}
    </FormDrawer>
  );
}
