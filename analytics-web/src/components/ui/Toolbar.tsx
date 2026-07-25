import { Flex } from "antd";
import type { ReactNode } from "react";

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 12 }}>
      {children}
    </Flex>
  );
}
