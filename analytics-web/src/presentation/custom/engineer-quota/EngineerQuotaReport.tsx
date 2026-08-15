import { Alert, Table } from "antd";
import { useTranslation } from "react-i18next";
import { currentDir, formatNumber } from "../../format";
import { CITIES, DISCIPLINES, type QuotaParams, type QuotaRow } from "./contract";
import { QuotaDonut } from "./QuotaDonut";
import { buildQuotaModels, type QuotaModel } from "./quota";

/**
 * «وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و رشته».
 *
 * A table of the four engineer bases, then the same four as rings. It renders only what it is handed:
 * the row comes from the registry entry's `fetch`, and the arithmetic from `buildQuotaModels`, so
 * this file has no business logic to get wrong beyond laying the numbers out.
 *
 * The table is also the donuts' **text alternative** — every number in a ring appears here as text,
 * which is what lets the canvases be `aria-hidden`. See `QuotaDonut`.
 */
export function EngineerQuotaReport({ data, params }: { data: QuotaRow; params: QuotaParams }) {
  const { t } = useTranslation();
  const dir = currentDir();
  const models = buildQuotaModels(data);

  // The reference puts the selected city and discipline in the column headers rather than only in
  // the picker, so a printed or exported table still says what it is about.
  const city = CITIES.find((c) => c.value === params.cityId)?.label ?? String(params.cityId);
  const reshte = DISCIPLINES.find((d) => d.value === params.reshte)?.label ?? String(params.reshte);

  const num = (v: number) => formatNumber(v, dir);

  return (
    <div data-testid="engineer-quota">
      {/*
        Verbatim from the reference. It is not decoration: without it «پایه» reads as the engineer's
        licence grade in general, when the figures are per-city and use the highest grade active in
        that city. A reader who misses that will think the numbers are wrong.
      */}
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t("quota.note")} />

      <Table<QuotaModel>
        data-testid="quota-table"
        rowKey="base"
        size="middle"
        pagination={false}
        /**
         * A **number**, not `"max-content"`, and not absent. All three were measured:
         *
         * - **absent** — nothing in the table's ancestry scrolls. At 375px the table is 394px wide in
         *   a 287px box with `overflow: visible` everywhere, so ~107px is simply **clipped and
         *   unreachable**; in RTL that is «ظرفیت باقی‌مانده» and «ظرفیت کل». The page not moving
         *   sideways looked like success and was not.
         * - **`"max-content"`** — stops the headers wrapping, so the six long composed headers claim
         *   their intrinsic width and the table overflows at ordinary desktop widths too.
         * - **a number** — a min-width. Wider than it, the columns share the space and the headers
         *   wrap; narrower, the wrapper scrolls and every column stays reachable.
         */
        scroll={{ x: 640 }}
        dataSource={models}
        columns={[
          { title: t("quota.base", { city }), dataIndex: "title", key: "title" },
          {
            title: t("quota.design", { reshte }),
            key: "design",
            align: "start",
            render: (_, m) => num(m.designUsed),
          },
          {
            title: t("quota.supervision", { reshte }),
            key: "supervision",
            align: "start",
            render: (_, m) => num(m.supervisionUsed),
          },
          {
            title: t("quota.count", { city }),
            key: "engineers",
            align: "start",
            render: (_, m) => num(m.engineerCount),
          },
          {
            title: t("quota.remaining"),
            key: "remaining",
            align: "start",
            render: (_, m) => num(m.remainingCapacity),
          },
          {
            title: t("quota.total"),
            key: "total",
            align: "start",
            render: (_, m) => num(m.totalCapacity),
          },
        ]}
      />

      {/*
        One row of four, wrapping on a narrow screen. `models` is already in display order — ارشد،
        یک، دو، سه — so the rings and the table rows cannot disagree about which base is which.
      */}
      <div
        data-testid="quota-donuts"
        style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24 }}
      >
        {models.map((m) => (
          <QuotaDonut
            key={m.base}
            title={m.title}
            usedCapacity={m.usedCapacity}
            remainingCapacity={m.remainingCapacity}
            engineerCount={m.engineerCount}
          />
        ))}
      </div>
    </div>
  );
}
