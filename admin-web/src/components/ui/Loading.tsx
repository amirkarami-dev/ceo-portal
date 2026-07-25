import { Skeleton, Spin, Typography } from "antd";
import type { ReactNode } from "react";

export interface LoadingProps {
  rows?: number;
  mode?: "skeleton" | "spin";
  tip?: ReactNode;
}

export function Loading({ rows = 4, mode = "skeleton", tip }: LoadingProps) {
  if (mode === "spin") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: 48,
        }}
      >
        <Spin />
        {tip ? <Typography.Text type="secondary">{tip}</Typography.Text> : null}
      </div>
    );
  }
  return <Skeleton active paragraph={{ rows }} />;
}
