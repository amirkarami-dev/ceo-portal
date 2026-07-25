import { Modal } from "antd";
import type { ReactNode } from "react";
import { i18n } from "../../i18n";

export function confirmAction({
  title,
  content,
  onOk,
  okText,
}: {
  title: ReactNode;
  content?: ReactNode;
  onOk: () => void | Promise<void>;
  okText?: string;
}) {
  Modal.confirm({
    title,
    content,
    okText: okText ?? i18n.t("common.confirm"),
    cancelText: i18n.t("common.cancel"),
    okButtonProps: { danger: true },
    onOk,
  });
}
