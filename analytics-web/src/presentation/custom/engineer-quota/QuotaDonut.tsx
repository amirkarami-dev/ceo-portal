import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useEChart } from "../../../components/charts/useEChart";
import { useUiStore } from "../../../store/ui-store";
import { chartColors } from "../../../theme/tokens";
import { currentDir, formatFitted, formatNumber } from "../../format";

/**
 * One base's capacity as a ring: consumed against remaining.
 *
 * Built on `useEChart` directly, the way `admin/audit/AuditCostChart` and `admin/ai/usage/AIUsageCost`
 * already are. Going through `EChartsRenderer` instead would mean fabricating a `QueryResult` and a
 * `ReportView` for each of four donuts — more contortion than the option below.
 *
 * ## Two slices, not four
 *
 * Design and supervision are one consumption figure. Splitting them would answer a question the
 * report does not ask and leave «ظرفیت باقی‌مانده» as a third slice competing with them; the table
 * above already breaks the two apart.
 *
 * ## Hidden from assistive tech, on purpose
 *
 * A canvas has nothing to read, and the four rings add **no** information the table above does not
 * already carry as text — used is design + supervision, both columns; remaining and total are columns
 * too. So the table is these donuts' text alternative and they are `aria-hidden`.
 *
 * That holds because this report shows both. A future custom report that draws a chart without a
 * table beside it needs its own text alternative — see the note in the design doc.
 */
/**
 * No `totalCapacity` prop, though the brief's sketch listed one: used + remaining **is** the total,
 * by construction in `buildQuotaModels`. Taking it as well would let a caller pass a third number
 * that disagrees with the other two, and the ring would have no way to say which was right.
 */
export function QuotaDonut({
  title,
  usedCapacity,
  remainingCapacity,
  engineerCount,
}: {
  title: string;
  usedCapacity: number;
  remainingCapacity: number;
  engineerCount: number;
}) {
  const { t } = useTranslation();
  const dir = currentDir();
  const themeMode = useUiStore((s) => s.themeMode);
  const colors = chartColors(themeMode);

  const usedLabel = t("quota.used");
  const remainingLabel = t("quota.remaining");

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: "item",
        confine: true,
        formatter: (p: { name?: string; value?: number; percent?: number }) =>
          `${p.name ?? ""}<br/>${formatNumber(p.value ?? 0, dir)} (${formatNumber(
            Number((p.percent ?? 0).toFixed(1)),
            dir,
          )}${dir === "rtl" ? "٪" : "%"})`,
      },
      legend: {
        bottom: 0,
        // The reading edge, as everywhere else in the app.
        left: dir === "rtl" ? "right" : "left",
        icon: "circle",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: colors.text, fontSize: 11 },
      },
      series: [
        {
          type: "pie",
          // From the brief. A thicker ring than the report donut's, because there is no total in the
          // hole here — the engineer count sits there instead and needs less room.
          radius: ["55%", "78%"],
          center: ["50%", "45%"],
          // A gap the same colour as the panel, so the two slices read as separate arcs rather than
          // one two-tone band. `#fff` verbatim from the brief would be a white seam in dark mode.
          itemStyle: { borderColor: colors.tooltipBg, borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          animation: false,
          emphasis: { scale: false },
          // An all-zero base would otherwise draw ECharts' grey placeholder ring, which reads as data.
          showEmptyCircle: false,
          /**
           * Colour is set per slice rather than left to the palette's order, and the assignment is
           * deliberate: **remaining is the brand blue and consumed is the accent.**
           *
           * The other way round — taking `series[0]` and `series[1]` in data order — put orange on
           * the *majority* of every ring, so a base with 12% consumed looked alarming at a glance.
           * On a capacity gauge the bulk should be the calm colour and the part spent should be the
           * one that catches the eye. The reference does the same thing with two greens.
           */
          data: [
            { name: usedLabel, value: usedCapacity, itemStyle: { color: colors.series[1] } },
            { name: remainingLabel, value: remainingCapacity, itemStyle: { color: colors.series[0] } },
          ],
        },
      ],
    }),
    [colors, dir, usedCapacity, remainingCapacity, usedLabel, remainingLabel],
  );

  const ref = useEChart(option);

  return (
    <figure style={{ margin: 0, textAlign: "center", flex: "1 1 200px", minWidth: 180 }}>
      <figcaption style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
        {title}
      </figcaption>

      <div style={{ position: "relative", height: 200 }}>
        <div ref={ref} aria-hidden style={{ width: "100%", height: "100%" }} />

        {/* The engineer count goes in the hole rather than becoming a third slice — it is a count of
            people, not an area, and adding it to a capacity ring would make the ring mean nothing. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            bottom: "22%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>
            {formatFitted(engineerCount, dir)}
          </span>
          <span style={{ fontSize: 11, color: colors.axis }}>{t("quota.engineers")}</span>
        </div>
      </div>
    </figure>
  );
}
