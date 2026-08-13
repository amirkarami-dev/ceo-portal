// Jalali (شمسی) date picker, replacing the free-text filter box.
//
// Ported from walfare-web's JalaliFields.tsx — same library, same string contract. Built on
// antd-jalali (antd v5 pickers generated over dayjs + jalaliday), so it looks and behaves like a
// native AntD picker — RTL, fa_IR locale, theme tokens — but the panel is the Persian calendar.
//
// IMPORTANT: antd-jalali extends the (deduped) dayjs instance itself, and <JalaliLocaleListener/> in
// providers.tsx switches it to the Jalali calendar. Do NOT extend dayjs with another jalaliday copy
// here — a second version double-patches the prototype and breaks the picker's display.
//
// The value stays the warehouse's own string, "1405/03/17": the KurdNezam column is nvarchar holding
// Jalali text, so the picker reads and writes exactly what the filter already contains. Nothing
// converts to Gregorian and back, which is the whole reason a Gregorian picker could not do this job.
import dayjs, { type Dayjs } from "dayjs";
import { DatePicker as DatePickerJalali } from "antd-jalali";

const DATE_FORMAT = "YYYY/MM/DD";

function enDigits(v: string): string {
  return v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** "1405/03/17" (or its Persian-digit form) → a Dayjs on the Jalali calendar, or null. */
function parseJalaliDate(v: string | undefined): Dayjs | null {
  if (!v) return null;
  const m = enDigits(v).trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const padded = `${m[1]}/${m[2].padStart(2, "0")}/${m[3].padStart(2, "0")}`;
  // jalaliday 2.x parse convention (the same call antd-jalali makes internally).
  const d = dayjs(padded, { format: DATE_FORMAT, jalali: true } as never);
  return d.isValid() ? d : null;
}

interface Props {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export function JalaliDateField({ value, onChange, placeholder, style }: Props) {
  return (
    <DatePickerJalali
      style={style}
      value={parseJalaliDate(value)}
      format={DATE_FORMAT}
      placeholder={placeholder ?? "انتخاب تاریخ"}
      // NOTE: never call d.calendar("jalali") here — antd-jalali also loads dayjs/plugin/calendar,
      // whose instance .calendar() (the calendar-time formatter) overwrites jalaliday's and returns
      // a string. The instance is already on the Jalali calendar, so format directly.
      onChange={(d: Dayjs | null) => onChange?.(d ? d.format(DATE_FORMAT) : "")}
    />
  );
}
