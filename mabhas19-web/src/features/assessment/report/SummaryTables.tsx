import type { EnvReportSummaryGroup } from "@mabhas19/assessment-core"
import { faR } from "./format"

const TH =
  "border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600"
const TD = "border border-slate-200 px-3 py-2 text-[12px] text-slate-700"

/** The جدول ۱۹-۵-۱ summary: one table per assembly group (wall/roof/floor/door). */
export function SummaryTables({ groups }: { groups: EnvReportSummaryGroup[] }) {
  if (groups.length === 0) return null
  return (
    <div className="mt-8 flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.group} className="report-assembly">
          <h3 className="mb-2 text-sm font-bold text-slate-800">
            {g.title} <span className="font-normal text-slate-400">(جدول ۱۹-۵-۱)</span>
          </h3>
          <table className="w-full border-collapse" dir="rtl">
            <thead>
              <tr>
                <th className={TH}>کد تیپ</th>
                <th className={TH}>جزئیات جداره</th>
                <th className={TH}>R (m²·K/W)</th>
                <th className={TH}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((row) => (
                <tr key={row.code}>
                  <td className={`${TD} text-center font-bold`}>{row.code}</td>
                  <td className={TD}>{row.label}</td>
                  <td className={`${TD} text-center font-semibold`}>{faR(row.rValue)}</td>
                  <td
                    className={`${TD} text-center font-semibold ${
                      row.pass ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {row.pass ? "تایید" : "عدم تایید"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}
