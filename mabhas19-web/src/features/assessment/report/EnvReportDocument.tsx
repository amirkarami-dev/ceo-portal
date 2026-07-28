import type { EnvOpaqueReport, WindowsReport } from "@mabhas19/assessment-core"
import { ReportHeader, type EnvReportHeader } from "./ReportHeader"
import { AssemblyCard } from "./AssemblyCard"
import { SummaryTables } from "./SummaryTables"
import { ComplianceSummary } from "./ComplianceSummary"
import { WindowsSection } from "./WindowsSection"

/**
 * The printable envelope report — opaque assemblies plus the transparent (windows)
 * section. Always light/white (a document) so it reads the same on screen, in dark mode,
 * and on paper. RTL Persian regardless of UI locale.
 */
export function EnvReportDocument({
  header,
  report,
  windows,
}: {
  header: EnvReportHeader
  report: EnvOpaqueReport
  windows?: WindowsReport
}) {
  return (
    <div
      dir="rtl"
      className="report-page mx-auto w-full max-w-[820px] bg-white px-8 py-8 text-slate-900 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0"
    >
      <ReportHeader header={header} />

      {!report.empty ? (
        <>
          <h2 className="mt-6 text-base font-extrabold text-slate-800">
            پوسته خارجی غیر نورگذر (دیوار / سقف / کف / در)
          </h2>
          {report.assemblies.map((a) => (
            <AssemblyCard key={a.code} assembly={a} />
          ))}

          <SummaryTables groups={report.summaryGroups} />
          <ComplianceSummary report={report} />
        </>
      ) : null}

      {windows ? <WindowsSection report={windows} /> : null}

      <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] leading-relaxed text-slate-400">
        <p>
          سلب مسئولیت: تمامی محاسبات صرفاً بر اساس داده‌های ورودی انجام می‌شود. مسئولیت نهایی
          انتخاب مصالح، تعیین ضخامت‌ها و انطباق با مبحث ۱۹ مقررات ملی ساختمان بر عهدهٔ طراح و
          ناظر پروژه است.
        </p>
        <p className="mt-1">https://mabhas19.ir — مبحث ۱۹، ویرایش ۵</p>
      </footer>
    </div>
  )
}
