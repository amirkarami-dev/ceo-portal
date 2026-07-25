import { Skeleton, Spin } from "antd";

export function Loading({
  rows = 4,
  mode = "skeleton",
}: {
  rows?: number;
  mode?: "skeleton" | "spin";
}) {
  if (mode === "spin") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }
  return <Skeleton active paragraph={{ rows }} />;
}
