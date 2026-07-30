// Jalali (شمسی) date + time pickers for forms, replacing the free-text inputs.
// Built on antd-jalali (antd v5 pickers generated over dayjs + jalaliday), so
// they look and behave exactly like native AntD pickers — RTL, fa_IR locale,
// theme tokens — but the calendar panel is the Persian calendar.
//
// IMPORTANT: antd-jalali extends the (deduped) dayjs instance itself and
// <JalaliLocaleListener/> in providers.tsx switches it to the Jalali calendar.
// Do NOT extend dayjs with another jalaliday copy here — a second version
// double-patches the prototype and breaks the picker's display.
//
// Both fields keep the app's STRING form contract ("1405/05/01" / "08:00"):
// they accept/emit the same strings the API already stores, so form state and
// backend payloads are unchanged.
import dayjs, { type Dayjs } from "dayjs";
import {
  DatePicker as DatePickerJalali,
  TimePicker as TimePickerJalali,
} from "antd-jalali";

const DATE_FORMAT = "YYYY/MM/DD";
const TIME_FORMAT = "HH:mm";

function enDigits(v: string): string {
  return v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function parseJalaliDate(v: string | undefined): Dayjs | null {
  if (!v) return null;
  const m = enDigits(v).trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const padded = `${m[1]}/${m[2].padStart(2, "0")}/${m[3].padStart(2, "0")}`;
  // jalaliday 2.x parse convention (same call antd-jalali uses internally).
  const d = dayjs(padded, { format: DATE_FORMAT, jalali: true } as never);
  return d.isValid() ? d : null;
}

interface StringFieldProps {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Jalali calendar date picker; value is the API's "1405/05/01" string. */
export function JalaliDateField({ value, onChange, placeholder, disabled }: StringFieldProps) {
  return (
    <DatePickerJalali
      style={{ width: "100%" }}
      value={parseJalaliDate(value)}
      format={DATE_FORMAT}
      placeholder={placeholder ?? "انتخاب تاریخ"}
      disabled={disabled}
      // NOTE: never call d.calendar("jalali") here — antd-jalali also loads
      // dayjs/plugin/calendar, whose instance .calendar() (calendar-time
      // formatter) overwrites jalaliday's and returns a string. The instance
      // is already on the Jalali calendar (global default), so format directly.
      onChange={(d: Dayjs | null) => onChange?.(d ? d.format(DATE_FORMAT) : "")}
    />
  );
}

function parseTime(v: string | undefined): Dayjs | null {
  if (!v) return null;
  const d = dayjs(enDigits(v).trim(), TIME_FORMAT);
  return d.isValid() ? d : null;
}

/** Time-of-day picker; value is the API's "08:00" string. */
export function TimeField({ value, onChange, placeholder, disabled }: StringFieldProps) {
  return (
    <TimePickerJalali
      style={{ width: "100%" }}
      value={parseTime(value)}
      format={TIME_FORMAT}
      minuteStep={5}
      needConfirm={false}
      placeholder={placeholder ?? "انتخاب ساعت"}
      disabled={disabled}
      onChange={(d: Dayjs | Dayjs[] | null) => {
        // antd-jalali types onChange as Dayjs | Dayjs[] (range support); a
        // single picker only ever gets one value.
        const one = Array.isArray(d) ? d[0] : d;
        onChange?.(one ? one.format(TIME_FORMAT) : "");
      }}
    />
  );
}
