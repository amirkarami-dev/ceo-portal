import type { EnvReportAssembly } from "@mabhas19/assessment-core"
import { faR, faR2, faInt } from "./format"
import { LayerBar } from "./LayerBar"

const TH =
  "border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-600"
const TD = "border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700"

/** One جداره: header (required vs computed R), per-layer table, layer-bar, pass/fail. */
export function AssemblyCard({ assembly }: { assembly: EnvReportAssembly }) {
  const { pass } = assembly
  return (
    <section className="report-assembly mt-5 rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-700 px-1.5 text-[11px] font-bold text-white">
            {assembly.code}
          </span>
          <span className="text-sm font-bold text-slate-800">{assembly.label}</span>
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <span className="text-slate-500">
            R موردنیاز:{" "}
            <span className="font-semibold text-slate-800">{faR2(assembly.requiredR)}</span>
          </span>
          <span className="text-slate-500">
            R محاسبه‌شده:{" "}
            <span className={pass ? "font-bold text-emerald-700" : "font-bold text-red-600"}>
              {faR(assembly.totalR)}
            </span>
          </span>
        </div>
      </header>

      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse" dir="rtl">
          <thead>
            <tr>
              <th className={TH}>ردیف</th>
              <th className={TH}>گروه</th>
              <th className={TH}>نام مصالح</th>
              <th className={TH}>تولیدکننده</th>
              <th className={TH}>ضخامت (mm)</th>
              <th className={TH}>چگالی</th>
              <th className={TH}>λ</th>
              <th className={TH}>R</th>
              <th className={TH}>استاندارد</th>
            </tr>
          </thead>
          <tbody>
            {assembly.layers.map((l) => (
              <tr key={l.index}>
                <td className={`${TD} text-center`}>{faInt(l.index)}</td>
                <td className={TD}>{l.categoryLabel}</td>
                <td className={TD}>{l.material}</td>
                <td className={`${TD} text-center`}>{l.manufacturer}</td>
                <td className={`${TD} text-center`}>{faInt(l.thickness)}</td>
                <td className={`${TD} text-center`}>{l.density}</td>
                <td className={`${TD} text-center`}>{faR(l.lambda)}</td>
                <td className={`${TD} text-center font-semibold`}>{faR(l.rValue)}</td>
                <td className={`${TD} text-center`}>{l.standard}</td>
              </tr>
            ))}
            <tr>
              <td className={`${TD} bg-slate-50 text-center font-bold`} colSpan={7}>
                مجموع مقاومت (R)
              </td>
              <td className={`${TD} bg-slate-50 text-center font-bold`} colSpan={2}>
                {faR(assembly.totalR)}
              </td>
            </tr>
          </tbody>
        </table>

        <LayerBar layers={assembly.layers} />

        <div className="mt-3 flex items-center justify-center">
          {pass ? (
            <span className="rounded-md bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
              ✓ تایید (R &gt; Min)
            </span>
          ) : (
            <span className="rounded-md bg-red-50 px-3 py-1 text-[12px] font-semibold text-red-600">
              ✗ عدم تایید (R ≤ Min)
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
