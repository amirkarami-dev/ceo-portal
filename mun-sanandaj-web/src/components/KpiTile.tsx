import { theme } from "antd";
import { toneColor, toneSurface } from "../theme/tokens";
import { useThemeMode } from "../theme/useThemeMode";
import { faNumber } from "../lib/format";

type Tone = "success" | "error" | "muted";

/** A compact stat tile: big Persian-digit value over a label, on a soft tinted surface. */
export function KpiTile({ label, value, tone = "muted" }: { label: string; value: number; tone?: Tone }) {
  const { mode } = useThemeMode();
  const { token } = theme.useToken();
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "14px 12px",
        borderRadius: 12,
        background: toneSurface(mode, tone),
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: toneColor(mode, tone) }}>
        {faNumber(value)}
      </div>
      <div style={{ fontSize: 12, marginTop: 4, color: token.colorTextSecondary }}>{label}</div>
    </div>
  );
}
