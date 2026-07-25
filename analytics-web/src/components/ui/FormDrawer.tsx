import { Button, Drawer, Space } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function FormDrawer({
  open,
  title,
  onClose,
  onSubmit,
  submitting,
  hideSubmit,
  children,
  width = 480,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  submitting?: boolean;
  /** When true, renders only the Cancel button (omits the primary Save button).
   *  Use for selection-only drawers where clicking an item commits the action. */
  hideSubmit?: boolean;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useTranslation();
  return (
    <Drawer
      open={open}
      title={title}
      onClose={onClose}
      width={width}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          {!hideSubmit && (
            <Button type="primary" loading={submitting} onClick={onSubmit}>
              {t("common.save")}
            </Button>
          )}
        </Space>
      }
    >
      {children}
    </Drawer>
  );
}
