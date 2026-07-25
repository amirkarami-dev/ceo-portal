import { Card, Typography } from "antd";
import { ToolOutlined } from "@ant-design/icons";

/** Body of a Phase-1 placeholder page. Phase 2 replaces the page body, not this file. */
export function ComingSoon({ note }: { note?: string }) {
  return (
    <Card variant="borderless" style={{ background: "var(--ant-color-fill-quaternary)" }}>
      <Typography.Paragraph style={{ margin: 0, textAlign: "center" }}>
        <ToolOutlined style={{ marginInlineEnd: 8 }} />
        به‌زودی
      </Typography.Paragraph>
      {note ? (
        <Typography.Paragraph
          type="secondary"
          style={{ margin: "8px 0 0", textAlign: "center", fontSize: 13 }}
        >
          {note}
        </Typography.Paragraph>
      ) : null}
    </Card>
  );
}
