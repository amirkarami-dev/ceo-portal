import { registerCustomReport } from "../registry";
import { CITIES, DISCIPLINES, type QuotaParams } from "./contract";
import { EngineerQuotaReport } from "./EngineerQuotaReport";
import { fetchQuota } from "./fetch";

/**
 * «وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و رشته».
 *
 * Pure registration — the body lives in `EngineerQuotaReport`, the wire shape in `contract`, the data
 * in `fetch`. Importing this module is what puts the report on the map; `ReportView.tsx` does that.
 */
registerCustomReport({
  id: "EngineerQuota",
  title: {
    "fa-IR": "وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و رشته",
    "en-US": "Registered engineer quota by city and discipline",
  },
  params: [
    { key: "reshte", label: { "fa-IR": "رشته", "en-US": "Discipline" }, options: DISCIPLINES },
    { key: "cityId", label: { "fa-IR": "منطقه", "en-US": "Region" }, options: CITIES },
  ],
  // Mechanical engineering in Bijar — the combination in the reference screenshot, so the first
  // screen anyone opens can be compared against it directly.
  defaults: { cityId: 25, reshte: 4 } satisfies QuotaParams,
  fetch: fetchQuota,
  Component: EngineerQuotaReport,
});
