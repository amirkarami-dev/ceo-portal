import { Typography } from "antd";
import type { ReactNode } from "react";

/**
 * Page title + optional subtitle on the start, optional actions on the end.
 *
 * `level={1}` because this is the page's real heading — the shell around it has
 * no other, so anything lower would leave every screen starting at h4. The size
 * is set here rather than taken from the level: AntD's h1 is built for a landing
 * page, and this is a work screen.
 */
export function PageHeader({
  title,
  subtitle,
  extra,
}: {
  title: string;
  subtitle?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div>
        <Typography.Title
          level={1}
          style={{
            margin: 0,
            fontSize: "clamp(20px, 2.6vw, 26px)",
            fontWeight: 700,
            letterSpacing: "-0.4px",
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {extra && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{extra}</div>}
    </div>
  );
}
