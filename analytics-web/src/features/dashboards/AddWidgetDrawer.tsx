import { Empty, List, Tag } from "antd";
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
  const { data } = useReports();

  return (
    <FormDrawer
      open={open}
      title={t("dash.addWidget")}
      onClose={onClose}
      hideSubmit
      width={380}
    >
      {(data ?? []).length === 0 ? (
        <Empty description={t("dash.noReports")} />
      ) : (
        <List
          dataSource={data ?? []}
          renderItem={(r) => (
            <List.Item
              data-testid="add-widget-item"
              className="add-widget-item"
              style={{ cursor: "pointer" }}
              onClick={() => {
                onPick(r.id, r.definition.name);
                onClose();
              }}
            >
              <List.Item.Meta
                title={r.definition.name}
                description={(r.definition.tags ?? []).map((x) => (
                  <Tag key={x}>{x}</Tag>
                ))}
              />
            </List.Item>
          )}
        />
      )}
    </FormDrawer>
  );
}
