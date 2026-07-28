import { Fragment } from "react"
import type { ChecklistReport, ChecklistReportSection } from "@mabhas19/assessment-core"
import { ReportHeader, type EnvReportHeader } from "./ReportHeader"
import { faInt } from "./format"

const TH = "border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-600"
const TD = "border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700"

function StatusCell({ pass, answered }: { pass: boolean; answered: boolean }) {
  if (pass) return <span className="font-bold text-emerald-700">✓</span>
  if (answered) return <span className="font-bold text-red-600">✗</span>
  return <span className="text-slate-400">—</span>
}

function SectionRows({ section }: { section: ChecklistReportSection }) {
  if (section.rows.length === 0) return null
  return (
    <table className="w-full border-collapse" dir="rtl">
      <thead>
        <tr>
          <th className={`${TH} w-10`}>ردیف</th>
          <th className={TH}>پرسش</th>
          <th className={`${TH} w-40`}>پاسخ</th>
          <th className={`${TH} w-16`}>وضعیت</th>
        </tr>
      </thead>
      <tbody>
        {section.rows.map((row, i) => {
          const prevCategory = i > 0 ? section.rows[i - 1].category : undefined
          const showCat = !!row.category && row.category !== prevCategory
          return (
            <Fragment key={i}>
              {showCat ? (
                <tr>
                  <td colSpan={4} className="border border-slate-200 bg-slate-100/70 px-2 py-1.5 text-[11px] font-bold text-slate-700">
                    {row.category}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className={`${TD} text-center`}>{faInt(i + 1)}</td>
                <td className={TD}>{row.label}</td>
                <td className={`${TD} text-center`}>{row.answer}</td>
                <td className={`${TD} text-center`}>
                  <StatusCell pass={row.pass} answered={row.answered} />
                </td>
              </tr>
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

/** Questionnaire-style section report (mechanical / electrical / monitoring / integrated). */
export function ChecklistReportDocument({
  header,
  title,
  report,
}: {
  header: EnvReportHeader
  title: string
  report: ChecklistReport
}) {
  return (
    <div
      dir="rtl"
      className="report-page mx-auto w-full max-w-[820px] bg-white px-8 py-8 text-slate-900 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0"
    >
      <ReportHeader header={header} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-slate-800">{title}</h2>
        {report.buildingGroup ? (
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700">
            گروه ساختمانی: {report.buildingGroup}
          </span>
        ) : null}
      </div>

      {report.sections.map((section, i) => (
        <section key={i} className="report-assembly mt-5 rounded-xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-sm font-bold text-slate-800">{section.title}</span>
            {section.max != null ? (
              <span
                className={
                  section.pass
                    ? "rounded-md bg-emerald-50 px-2 py-0.5 text-[12px] font-bold text-emerald-700"
                    : "rounded-md bg-red-50 px-2 py-0.5 text-[12px] font-bold text-red-600"
                }
              >
                {faInt(section.score)} / {faInt(section.max)}
              </span>
            ) : (
              <span className="text-[12px] font-semibold text-slate-600">
                {faInt(section.passedCount)} / {faInt(section.activeCount)} تایید
              </span>
            )}
          </header>
          <div className="p-3">
            {section.note ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-slate-700">{section.note}</p>
            ) : null}
            <SectionRows section={section} />
          </div>
        </section>
      ))}

      <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
        <span className="text-sm font-medium text-slate-700">مجموع امتیاز این بخش: </span>
        <span dir="ltr" className="text-lg font-extrabold text-emerald-700">
          {faInt(report.totalScore)} / {faInt(report.maxScore)}
        </span>
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] leading-relaxed text-slate-400">
        <p>
          سلب مسئولیت: تمامی محاسبات صرفاً بر اساس داده‌های ورودی انجام می‌شود. مسئولیت نهایی صحت
          اطلاعات و انطباق با مبحث ۱۹ مقررات ملی ساختمان بر عهدهٔ طراح و ناظر پروژه است.
        </p>
        <p className="mt-1">https://mabhas19.ir — مبحث ۱۹، ویرایش ۵</p>
      </footer>
    </div>
  )
}
