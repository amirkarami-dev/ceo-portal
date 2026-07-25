import { Card, type CardProps } from "antd";

export function SectionCard(props: CardProps) {
  return (
    <Card
      styles={{ body: { padding: 16 } }}
      style={{ borderRadius: 12 }}
      {...props}
    />
  );
}
