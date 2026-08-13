// report-web/src/features/viewer/FilterBar.tsx
import { DatePicker, Input, Select, Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { Filter, FilterValue, SemanticModel } from "@/contracts";
import { Toolbar } from "@/components/ui";
import { JalaliDateField } from "@/components/ui/JalaliDateField";

interface Props {
  filters: Filter[];
  semantic: SemanticModel;
  onChange: (idx: number, value: FilterValue) => void;
}

// Renders one control per definition filter, typed by the semantic field.
// Styled as a Toolbar row; filter behavior + callbacks are unchanged.
export function FilterBar({ filters, semantic, onChange }: Props) {
  const { t } = useTranslation();
  if (filters.length === 0) return null;

  const fieldOf = (key: string) =>
    semantic.entities.flatMap((e) => e.fields).find((f) => f.id === key);

  /**
   * A Jalali date lives in the warehouse as TEXT ("1405/03/17"), so its `type` is "string" and it
   * would otherwise get a free-text box — leaving people to type a Persian date by hand and to know
   * the exact format. `format.kind` is the model's own hint that the string is a date.
   *
   * The picker reads and writes that same string, so nothing converts to Gregorian and back. That
   * is why the built-in AntD picker cannot do this job: it has no year 1405.
   */
  const isJalaliDate = (field: ReturnType<typeof fieldOf>) =>
    field?.type === "string" && field.format?.kind === "date";

  return (
    <div data-testid="filter-bar">
      <Toolbar>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filters.map((f, i) => {
            const field = fieldOf(f.field);
            const label = field?.label?.["fa-IR"] ?? f.field;

            // `between` carries TWO bounds. One input replaced them with a single string, which
            // left the query with half a range — it used to return nothing at all, and now the
            // engine refuses it outright, so typing here ended in «خطا در بارگذاری گزارش».
            // Two inputs, and whichever one is edited keeps the other.
            if (f.operator === "between" || f.operator === "notBetween") {
              const pair = Array.isArray(f.value)
                ? (f.value as (string | number)[]).map((v) => String(v ?? ""))
                : [f.value == null ? "" : String(f.value), f.value2 == null ? "" : String(f.value2)];
              const [from = "", to = ""] = pair;
              const emit = (next: [string, string]) =>
                // Both bounds always travel together, so a half-filled range can never be sent.
                onChange(i, next.every((v) => v === "") ? null : next);

              // A Jalali range gets two Persian calendars, reading and writing «1405/03/17».
              if (isJalaliDate(field)) {
                return (
                  <span key={i} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    <JalaliDateField
                      style={{ width: 150 }}
                      value={from}
                      placeholder={`${label} — ${t("viewer.filterFrom")}`}
                      onChange={(v) => emit([v, to])}
                    />
                    <JalaliDateField
                      style={{ width: 150 }}
                      value={to}
                      placeholder={`${label} — ${t("viewer.filterTo")}`}
                      onChange={(v) => emit([from, v])}
                    />
                  </span>
                );
              }

              // A true Gregorian date field gets two ordinary pickers.
              if (field?.type === "date") {
                return (
                  <span key={i} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    <DatePicker
                      placeholder={`${label} — ${t("viewer.filterFrom")}`}
                      onChange={(d) => emit([d ? d.toISOString() : "", to])}
                    />
                    <DatePicker
                      placeholder={`${label} — ${t("viewer.filterTo")}`}
                      onChange={(d) => emit([from, d ? d.toISOString() : ""])}
                    />
                  </span>
                );
              }

              return (
                <span key={i} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <Input
                    style={{ width: 130 }}
                    placeholder={`${label} — ${t("viewer.filterFrom")}`}
                    value={from}
                    onChange={(e) => emit([e.target.value, to])}
                  />
                  <Input
                    style={{ width: 130 }}
                    placeholder={`${label} — ${t("viewer.filterTo")}`}
                    value={to}
                    onChange={(e) => emit([from, e.target.value])}
                  />
                </span>
              );
            }

            // A single Jalali date — an `eq` or a `gte`, say — gets one Persian calendar.
            if (isJalaliDate(field)) {
              return (
                <JalaliDateField
                  key={i}
                  style={{ width: 170 }}
                  value={typeof f.value === "string" ? f.value : undefined}
                  placeholder={label}
                  onChange={(v) => onChange(i, v || null)}
                />
              );
            }

            if (field?.type === "date") {
              return (
                <DatePicker
                  key={i}
                  placeholder={label}
                  onChange={(d) => onChange(i, d ? d.toISOString() : null)}
                />
              );
            }
            if (field?.role === "dimension" && (field as { enumValues?: unknown[] }).enumValues?.length) {
              const enumValues = (field as { enumValues?: (string | number)[] }).enumValues ?? [];
              return (
                <Select
                  key={i}
                  placeholder={label}
                  allowClear
                  style={{ minWidth: 160 }}
                  options={enumValues.map((v) => ({ value: v, label: String(v) }))}
                  onChange={(v) => onChange(i, v ?? null)}
                />
              );
            }
            return (
              <Input
                key={i}
                placeholder={label}
                allowClear
                onChange={(e) => onChange(i, e.target.value || null)}
              />
            );
          })}
          <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
            {t("viewer.filterHint")}
          </Typography.Text>
        </div>
      </Toolbar>
    </div>
  );
}
