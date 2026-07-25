import type { ReactNode } from "react";

export function PageContainer({
  children,
  maxWidth = 1280,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div style={{ maxWidth, margin: "0 auto", padding: "20px 24px", width: "100%" }}>
      {children}
    </div>
  );
}
