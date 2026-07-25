import { Breadcrumb, Flex, Space, Typography } from "antd";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: { title: ReactNode; href?: string }[];
  /** Right-aligned actions (buttons, filters…). */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      {breadcrumbs?.length ? (
        <Breadcrumb items={breadcrumbs} style={{ marginBottom: 8 }} />
      ) : null}
      <Flex align="center" justify="space-between" gap={12} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>
            {title}
          </Typography.Title>
          {subtitle ? <Typography.Text type="secondary">{subtitle}</Typography.Text> : null}
        </div>
        {actions ? <Space wrap>{actions}</Space> : null}
      </Flex>
    </div>
  );
}
