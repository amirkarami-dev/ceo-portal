import type { WindowsReport } from "@mabhas19/assessment-core"
import { faR, faR2, faInt } from "./format"

const TH = "border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-600"
const TD = "border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700"

function Metric({
  label,
  value,
  limit,
  pass,
}: {
  label: string
  value: string
  limit: string
  pass: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-sm font-bold tabular-nums text-slate-800">
        {value} <span className="text-[11px] font-normal text-slate-400">/ حد {limit}</span>
      </span>
      <span className={pass ? "text-[11px] font-semibold text-emerald-700" : "text-[11px] font-semibold text-red-600"}>
        {pass ? "✓ مجاز" : "✗ مردود"}
      </span>
    </div>
  )
}

/** Transparent envelope (windows) — rendered after the opaque section inside the env report. */
export function WindowsSection({ report }: { report: WindowsReport }) {
  if (report.empty) return null
  return (
    <section className="report-assembly mt-8">
      <h2 className="text-base font-extrabold text-slate-800">پوسته خارجی نورگذر (پنجره / نما)</h2>

      {report.windows.map((w, i) => (
        <div key={i} className="report-assembly mt-4 rounded-xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-700 px-1.5 text-[11px] font-bold text-white">
                {`G${faInt(i + 1)}`}
              </span>
              <span className="text-sm font-bold text-slate-800">{w.name}</span>
              <span className="text-[11px] text-slate-500">({w.typeLabel})</span>
            </div>
            {w.pass ? (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ تایید</span>
            ) : (
              <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">✗ عدم تایید</span>
            )}
          </header>

          <div className="p-3">
            <table className="w-full border-collapse" dir="rtl">
              <thead>
                <tr>
                  <th className={TH}>لایه</th>
                  <th className={TH}>نام مصالح</th>
                  <th className={TH}>ضخامت (mm)</th>
                  <th className={TH}>λ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>قاب</td>
                  <td className={TD}>{w.frameName}</td>
                  <td className={`${TD} text-center`}>-</td>
                  <td className={`${TD} text-center`}>U={faR(w.frameU)}</td>
                </tr>
                {w.layers.map((l, li) => (
                  <tr key={li}>
                    <td className={TD}>{faInt(li + 1)}</td>
                    <td className={TD}>{l.name}</td>
                    <td className={`${TD} text-center`}>{faInt(l.thickness)}</td>
                    <td className={`${TD} text-center`}>{faR(l.lambda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Metric label="U پنجره (W/m²·K)" value={faR(w.uTotal)} limit={faR2(w.uLimit)} pass={w.uPass} />
              <Metric label="SHGC" value={w.shgc == null ? "—" : faR(w.shgc)} limit={faR2(w.shgcLimit)} pass={w.shgcPass} />
              <div className="flex flex-col justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[11px] text-slate-500">ضریب سایه‌بان (PF)</span>
                <span className="text-sm font-bold tabular-nums text-slate-800">{faR(w.pf)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-5 py-3 text-center">
        <span className="text-sm font-medium text-slate-700">امتیاز پوسته نورگذر: </span>
        <span dir="ltr" className="text-base font-extrabold text-emerald-700">
          {faInt(report.score)} / {faInt(report.maxScore)}
        </span>
        <span className="ms-2 text-[12px] font-semibold">
          {report.allPassed ? (
            <span className="text-emerald-700">— تایید کامل</span>
          ) : (
            <span className="text-red-600">— برخی پنجره‌ها مردود</span>
          )}
        </span>
      </div>
    </section>
  )
}
