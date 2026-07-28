import { AppstoreOutlined } from "@ant-design/icons";
import { Button, Empty, List, Tag } from "antd";
import { useTranslation } from "react-i18next";
import { useReports } from "@/api/queries";
import { FormDrawer } from "@/components/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (reportId: string, title: string) => void;
}

export function AddWidgetDrawer({ open, onClose, onPick }: Props) {
  const { t } = useTranslation();
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
                  onPick(r.id, r.definition.name);
                  onClose();
                }}
              >
                <AppstoreOutlined className="add-widget-item__icon" />
                <span className="add-widget-item__content">
                  <span className="add-widget-item__title">{r.definition.name}</span>
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
