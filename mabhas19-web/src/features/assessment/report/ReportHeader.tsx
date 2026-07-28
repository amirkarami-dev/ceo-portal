export interface EnvReportHeader {
  projectTitle: string
  climateCode: string
  climateLabel: string
  client: string
  usage: string
  totalArea: string
  floorCount: string
  unitCount: string
  deed: string
  parcel: string
  systemId: string
  buildingGroup: string
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-slate-200 px-3 py-2">
      <span className="text-[12px] font-semibold text-slate-600">{label}</span>
      <span className="truncate text-[12px] text-slate-800">{value || "-"}</span>
    </div>
  )
}

/** Title band + project identity grid (top of the report). */
export function ReportHeader({ header }: { header: EnvReportHeader }) {
  return (
    <header className="report-assembly">
      <div className="rounded-xl border border-slate-300 bg-slate-50 px-5 py-4 text-center">
        <h1 className="text-lg font-extrabold text-slate-900">
          سامانه جامع آنالیز انرژی (مبحث ۱۹)
        </h1>
        <p className="mt-1 text-[12px] text-slate-500">
          ویرایش ۵ — نظام مهندسی — اقلیم {header.climateCode}
          {header.climateLabel ? ` (${header.climateLabel})` : ""}
        </p>
        <p className="mt-2 text-sm font-bold text-slate-700">{header.projectTitle}</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-px sm:grid-cols-2">
        <Field label="نام کارفرما" value={header.client} />
        <Field label="کاربری ساختمان" value={header.usage} />
        <Field label="متراژ کل (m²)" value={header.totalArea} />
        <Field label="گروه ساختمانی" value={header.buildingGroup} />
        <Field label="تعداد طبقات" value={header.floorCount} />
        <Field label="تعداد واحد" value={header.unitCount} />
        <Field label="پلاک ثبتی" value={header.deed} />
        <Field label="شماره قطعه" value={header.parcel} />
        <Field label="شناسه نظام مهندسی" value={header.systemId} />
      </div>
    </header>
  )
}
