import { Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { QueryResult, ReportDefinition } from "@/contracts";
import type { ReportView } from "@/contracts/presentation";
import { EditableLabel } from "@/components/ui";
import { useColumnLabel } from "@/presentation/labels";
import { seriesKeysOf } from "@/presentation/series-keys";
import { chartColors } from "@/theme/tokens";
import { useUiStore } from "@/store/ui-store";

export interface SeriesLabelBarProps {
  view: ReportView | undefined;
  def: ReportDefinition | undefined;
  result: QueryResult | undefined;
  /** Rename one series. Rejecting keeps the editor open with the text intact. */
  onRename: (columnKey: string, next: string) => Promise<unknown>;
  /** Hidden entirely when false — no point showing a pencil nobody can use. */
  canEdit: boolean;
}

/**
 * Rename the series a chart draws.
 *
 * **Why it sits beside the chart and not on the legend.** The obvious place is the legend text
 * itself. It would have worked under recharts, whose legend was HTML — which is exactly why this
 * control is not there: ECharts draws its legend into a **canvas**, so there is no element to mount
 * an editor into, at any price. Deciding the answer per library would have meant charts you can
 * rename and charts you cannot. Now that every chart is ECharts, there is only the canvas.
 *
 * The swatch is not decoration — it is the only thing tying a row here to a line on the chart, since
 * the two are no longer adjacent. It uses the same palette in the same order the renderers do.
 *
 * Renaming here changes the legend **and** the tooltip, because both read the series `name` — the
 * renderer sets it once, so the two cannot drift apart.
 */
export function SeriesLabelBar({ view, def, result, onRename, canEdit }: SeriesLabelBarProps) {
  const { t } = useTranslation();
  const label = useColumnLabel(def, result);
  const themeMode = useUiStore((s) => s.themeMode);
  const keys = seriesKeysOf(view, result);

  if (!canEdit || keys.length === 0) return null;

  const palette = chartColors(themeMode).series;

  return (
    <div
      data-testid="series-labels"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        marginBottom: 8,
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t("viewer.seriesLabels")}
      </Typography.Text>

      {keys.map((key, i) => (
        <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: palette[i % palette.length],
              flex: "0 0 auto",
            }}
          />
          <EditableLabel
            as="text"
            value={label(key)}
            onSave={(next) => onRename(key, next)}
            // The column key, so a screen reader hears which series this pencil edits rather than
            // «ویرایش» five times over.
            tooltip={t("viewer.renameSeries", { name: label(key) })}
            maxLength={80}
          />
        </span>
      ))}
    </div>
  );
}
