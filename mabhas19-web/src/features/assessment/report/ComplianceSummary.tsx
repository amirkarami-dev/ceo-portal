import type { EnvOpaqueReport } from "@mabhas19/assessment-core"
import { faInt, faNum } from "./format"

const TD = "border border-slate-200 px-3 py-2 text-[12px] text-slate-700"

const yesNo = (v: string | null) => (v === "yes" ? "بله" : v === "no" ? "خیر" : "—")

/** Compliance status + thermal-bridge table + shading/special conditions + total score. */
export function ComplianceSummary({ report }: { report: EnvOpaqueReport }) {
  const { bridge, shading, scores, allPass } = report
  const dirs: Array<[string, number | null]> = [
    ["جنوب", bridge.south],
    ["شمال", bridge.north],
    ["شرق", bridge.east],
    ["غرب", bridge.west],
  ]

  return (
    <div className="mt-8 flex flex-col gap-5">
      {/* Compliance */}
      <section className="report-assembly rounded-xl border border-slate-200">
        <h3 className="rounded-t-xl border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800">
          وضعیت انطباق جداره‌ها (پوسته خارجی غیر نورگذر)
        </h3>
        <div className="px-4 py-3">
          {allPass ? (
            <span className="text-[13px] font-semibold text-emerald-700">
              ✓ تایید کامل (تمامی جداره‌ها استاندارد هستند)
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-red-600">
              ✗ برخی جداره‌ها به حد استاندارد نمی‌رسند
            </span>
          )}
        </div>
      </section>

      {/* Thermal bridges */}
      <section className="report-assembly rounded-xl border border-slate-200">
        <h3 className="rounded-t-xl border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800">
          وضعیت پل‌های حرارتی
        </h3>
        <div className="p-3">
          <table className="w-full border-collapse" dir="rtl">
            <tbody>
              {dirs.map(([label, val]) => (
                <tr key={label}>
                  <td className={TD}>
                    نسبت مساحت پل حرارتی به کل نمای <span className="font-semibold">{label}</span> (٪)
                  </td>
                  <td className={`${TD} w-32 text-center`}>{faNum(val)}</td>
                </tr>
              ))}
              <tr>
                <td className="border border-slate-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-slate-800">
                  عایق حرارتی (مجموع پوسته و پل حرارتی) — امتیاز از ۹۰
                </td>
                <td className="border border-slate-200 bg-amber-50 px-3 py-2 text-center text-[13px] font-bold text-slate-900">
                  {faInt(scores.insulation)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Shading / special conditions */}
      <section className="report-assembly rounded-xl border border-slate-200">
        <h3 className="rounded-t-xl border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800">
          بازتاب و سایه‌اندازی — امتیاز از ۱۵:{" "}
          <span className="text-slate-900">{faInt(scores.shading)}</span>
        </h3>
        <div className="p-3">
          <table className="w-full border-collapse" dir="rtl">
            <tbody>
              <tr>
                <td className={TD}>
                  ۱) آیا حداقل ۷۵٪ سطح بام در سایهٔ اجزای ساختمان قرار دارد؟
                </td>
                <td className={`${TD} w-24 text-center font-semibold`}>{yesNo(shading.q1)}</td>
              </tr>
              <tr>
                <td className={TD}>
                  ۲) آیا سطح خارجی بام حداقل ضریب بازتاب ۷۵٪ مادون قرمز را دارد؟
                </td>
                <td className={`${TD} w-24 text-center font-semibold`}>{yesNo(shading.q2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Total */}
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
        <span className="text-sm font-medium text-slate-700">مجموع امتیاز این بخش: </span>
        <span dir="ltr" className="text-lg font-extrabold text-emerald-700">
          {faInt(scores.total)} / {faInt(scores.max)}
        </span>
      </div>
    </div>
  )
}
