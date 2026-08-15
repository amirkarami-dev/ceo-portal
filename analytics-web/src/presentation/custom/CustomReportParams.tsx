import { useState } from "react";
import { Button, Select, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { Toolbar } from "../../components/ui";
import { labelLocaleOf } from "../labels";
import type { ParamSpec, Params } from "./registry";

/**
 * The picker bar for a custom report — «رشته», «منطقه», «نمایش» in the reference.
 *
 * Generic on purpose. It renders whatever `ParamSpec[]` the registry entry declares, so the next
 * custom report gets its filters by describing them rather than by writing another bar. That is the
 * difference between an escape hatch and a one-off page.
 *
 * ## Why a submit button and not live selects
 *
 * Each apply is a stored-procedure call. Selecting a city and then a discipline would fire two
 * queries, the first of which nobody asked for and whose result is thrown away the moment the second
 * select is touched. The reference UI has an explicit «نمایش» for the same reason. So the selects
 * edit a **draft** and only «نمایش» promotes it.
 *
 * The button stays enabled when nothing has changed. It is a submit control doing exactly what it
 * says — re-run with what is selected — and disabling it on first load, when the draft necessarily
 * matches the defaults, would read as broken.
 */
export function CustomReportParams({
  spec,
  value,
  onApply,
}: {
  spec: ParamSpec[];
  value: Params;
  onApply: (next: Params) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = labelLocaleOf(i18n.language);

  /**
   * The draft is local because it is local: nothing outside this bar has any use for a selection the
   * reader has not applied yet.
   *
   * It is seeded once and deliberately not synced back to `value`. `value` only ever changes through
   * this component's own `onApply`, so there is nothing to sync from. If a future caller starts
   * changing it from elsewhere, the fix is a `key` on this component, not a `useEffect` that would
   * wipe a half-made selection every time the parent re-renders.
   */
  const [draft, setDraft] = useState<Params>(value);

  if (spec.length === 0) return null;

  const labelOf = (p: ParamSpec) => p.label[locale] ?? p.label["fa-IR"] ?? p.label["en-US"] ?? p.key;

  return (
    <div data-testid="custom-report-params">
      <Toolbar>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {spec.map((p) => {
            const id = `custom-param-${p.key}`;
            return (
              <span key={p.key} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                {/* A real <label for>, so the select is named for a screen reader and clicking the
                    word focuses it — antd gives neither on its own. */}
                <Typography.Text id={`${id}-label`}>{labelOf(p)}:</Typography.Text>
                <Select
                  id={id}
                  aria-labelledby={`${id}-label`}
                  style={{ minWidth: 160 }}
                  value={draft[p.key] as string | number | undefined}
                  options={p.options}
                  onChange={(v) => setDraft((d) => ({ ...d, [p.key]: v }))}
                />
              </span>
            );
          })}

          <Button type="primary" onClick={() => onApply(draft)}>
            {t("customReport.apply")}
          </Button>
        </div>
      </Toolbar>
    </div>
  );
}
