import { Empty } from "antd";
import type { ReactNode } from "react";

export function EmptyState({
  description = "موردی یافت نشد",
  action,
  icon,
}: {
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Empty
      image={icon ?? Empty.PRESENTED_IMAGE_SIMPLE}
      description={description}
      style={{ padding: "40px 0" }}
    >
      {action}
    </Empty>
  );
}
