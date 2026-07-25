import { Empty } from "antd";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  description?: ReactNode;
  /** e.g. the "افزودن" button, so an empty table is still actionable. */
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({
  description = "موردی یافت نشد",
  action,
  icon,
}: EmptyStateProps) {
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
