import { Card, Skeleton, Typography } from "antd";
import type { ReactNode } from "react";

export type StatTone = "neutral" | "emerald" | "blue" | "amber" | "rose";

const TONES: Record<StatTone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--ant-color-fill-quaternary)", fg: "var(--ant-color-text)" },
  emerald: { bg: "var(--ant-color-success-bg)", fg: "var(--ant-color-success-text)" },
  blue: { bg: "var(--ant-color-info-bg)", fg: "var(--ant-color-info-text)" },
  amber: { bg: "var(--ant-color-warning-bg)", fg: "var(--ant-color-warning-text)" },
  rose: { bg: "var(--ant-color-error-bg)", fg: "var(--ant-color-error-text)" },
};

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  loading?: boolean;
  /** Rendered under the value (e.g. "۱۲ مورد جدید"). */
  hint?: ReactNode;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  loading,
  hint,
  onClick,
}: StatCardProps) {
  const c = TONES[tone];
  return (
    <Card
      variant="borderless"
      onClick={onClick}
      style={{
        background: c.bg,
        borderRadius: 12,
        cursor: onClick ? "pointer" : undefined,
        height: "100%",
      }}
      styles={{ body: { padding: 16 } }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={false} />
      ) : (
        <>
          <Typography.Text style={{ color: c.fg, fontSize: 13 }}>
            {icon} {label}
          </Typography.Text>
          <div style={{ color: c.fg, fontSize: 24, fontWeight: 600, marginTop: 4 }}>{value}</div>
          {hint ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {hint}
            </Typography.Text>
          ) : null}
        </>
      )}
    </Card>
  );
}
