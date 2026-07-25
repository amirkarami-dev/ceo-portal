// report-web/src/features/viewer/FilterBar.tsx
import { DatePicker, Input, Select, Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { Filter, FilterValue, SemanticModel } from "@/contracts";
import { Toolbar } from "@/components/ui";

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

  return (
    <div data-testid="filter-bar">
      <Toolbar>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {filters.map((f, i) => {
            const field = fieldOf(f.field);
            const label = field?.label?.["fa-IR"] ?? f.field;
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
