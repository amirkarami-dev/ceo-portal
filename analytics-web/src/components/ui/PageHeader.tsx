import { Breadcrumb, Flex, Space, Typography } from "antd";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  titleNode,
  subtitle,
  breadcrumbs,
  actions,
}: {
  title?: ReactNode;
  /**
   * Replaces the heading outright, for a caller that renders its own — an editable title, say.
   *
   * It exists because passing such a node as `title` puts a heading **inside** a heading: this
   * component's own `Typography.Title` wrapping another one. The DOM is invalid and
   * `getByRole("heading")` starts throwing "found multiple elements" in every test that touches the
   * page. Use this instead and the caller's element is the heading.
   */
  titleNode?: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: { title: ReactNode; href?: string }[];
  actions?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {breadcrumbs?.length ? (
        <Breadcrumb items={breadcrumbs} style={{ marginBottom: 8 }} />
      ) : null}
      <Flex align="center" justify="space-between" gap={12} wrap>
        <div>
          {titleNode ?? (
            <Typography.Title level={3} style={{ margin: 0, fontWeight: 500 }}>
              {title}
            </Typography.Title>
          )}
          {subtitle ? (
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
          ) : null}
        </div>
        {actions ? <Space wrap>{actions}</Space> : null}
      </Flex>
    </div>
  );
}
