// report-web/src/ai/rules.ts
import type { SemanticModel, Entity, Field } from "../contracts/semantic";
import type {
  ReportDefinition, ColumnDef, GroupBy, Metric, Sort,
} from "../contracts/report-definition";
import type { Aggregation } from "../contracts/common";

/** Normalize fa/en text: lowercase, strip persian diacritics, ي/ك→ی/ک,
 *  persian/arabic digits→ascii, collapse whitespace/punctuation. */
export function normalizePrompt(prompt: string): string {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  let s = prompt.toLowerCase();
  // normalize alef variants: آ (U+0622 alef+madda) → ا, أ (U+0623) → ا, إ (U+0625) → ا
  s = s.replace(/[آأإ]/g, "ا");
  // strip persian diacritics (harakat) + tatweel + zero-width chars
  s = s.replace(/[ً-ْـ‌‏‎]/g, "");
  s = s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ۀ/g, "ه").replace(/ة/g, "ه");
  s = s.replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
  s = s.replace(/[.,،؛:!?()[\]{}"'«»]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

const TIME_WORDS = ["ماهانه", "ماهیانه", "monthly", "روند", "trend"];
const QUARTER_WORDS = ["فصلی", "quarterly"];
const YEAR_WORDS = ["سالانه", "سالیانه", "yearly", "annual"];
const BY_WORDS = ["به تفکیک", "بر اساس", "per", "by"];
const TOP_WORDS = ["برتر", "بیشترین", "top", "بالاترین"];
const AVG_WORDS = ["میانگین", "متوسط", "average", "avg", "mean"];
const COUNT_WORDS = ["تعداد", "شمارش", "count", "چند"];

const includesAny = (s: string, words: string[]) => words.some((w) => s.includes(w));

function fieldLabels(f: Field): string[] {
  return [
    normalizePrompt(f.label["fa-IR"]),
    normalizePrompt(f.label["en-US"]),
    ...(f.synonyms ?? []).map(normalizePrompt),
  ];
}

/** Score a field against the prompt: exact-token=3, substring=2, none=0. */
function scoreField(prompt: string, f: Field): number {
  const tokens = prompt.split(" ");
  let best = 0;
  for (const label of fieldLabels(f)) {
    if (!label) continue;
    if (tokens.includes(label)) best = Math.max(best, 3);
    else if (prompt.includes(label) || label.split(" ").every((w) => tokens.includes(w))) best = Math.max(best, 2);
  }
  return best;
}

function matchedFields(prompt: string, entity: Entity, role: Field["role"]): Field[] {
  return entity.fields
    .filter((f) => f.role === role)
    .map((f) => ({ f, s: scoreField(prompt, f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.f);
}

function dateBucket(prompt: string): GroupBy["dateBucket"] {
  if (includesAny(prompt, QUARTER_WORDS)) return "quarter";
  if (includesAny(prompt, YEAR_WORDS)) return "year";
  return "month";
}

function measureAggregation(prompt: string, f: Field): Aggregation {
  if (includesAny(prompt, AVG_WORDS) && (f.allowedAggregations ?? []).includes("avg")) return "avg";
  if (includesAny(prompt, COUNT_WORDS)) return "count";
  return (f.defaultAggregation ?? "sum") as Aggregation;
}

/** Deterministic rule pass: prompt + model → analytical-intent ReportDefinition.
 *  Never invents fields; only references existing semantic field ids. */
export function buildByRules(normalizedPrompt: string, model: SemanticModel): ReportDefinition {
  const entity = model.entities[0];
  const measures = matchedFields(normalizedPrompt, entity, "measure");
  const dimensions = matchedFields(normalizedPrompt, entity, "dimension");
  const dates = matchedFields(normalizedPrompt, entity, "date");
  const wantsTime = includesAny(normalizedPrompt, [...TIME_WORDS, ...QUARTER_WORDS, ...YEAR_WORDS]);
  const wantsBy = includesAny(normalizedPrompt, BY_WORDS);
  const wantsTop = includesAny(normalizedPrompt, TOP_WORDS);

  // Determine if there's any semantic signal in the prompt to justify picking a measure.
  const hasSignal = measures.length > 0 || dimensions.length > 0 || wantsTime || wantsTop || wantsBy;
  // Pick the primary measure: a matched one, or the entity's first measure if there's any signal.
  // With no signal at all (off-topic prompt), fall through to count.
  const measure: Field | undefined =
    measures[0] ?? (hasSignal ? entity.fields.find((f) => f.role === "measure") : undefined);

  const groupBy: GroupBy[] = [];
  if (wantsTime) {
    const dateField = dates[0] ?? entity.fields.find((f) => f.id === entity.defaultDateField);
    if (dateField) groupBy.push({ field: dateField.id, dateBucket: dateBucket(normalizedPrompt) });
  }
  if ((wantsBy || wantsTop) && dimensions[0]) groupBy.push({ field: dimensions[0].id });
  else if (!wantsTime && dimensions[0]) groupBy.push({ field: dimensions[0].id });

  const metrics: Metric[] = [];
  if (measure) {
    const agg = measureAggregation(normalizedPrompt, measure);
    metrics.push({ field: measure.id, aggregation: agg, alias: measure.id, label: measure.label["fa-IR"], format: measure.format });
  } else {
    metrics.push({ field: "*", aggregation: "count", alias: "count", label: "تعداد" });
  }

  const columns: ColumnDef[] = [
    ...groupBy.map<ColumnDef>((g) => ({ field: g.field, type: entity.fields.find((f) => f.id === g.field)?.type })),
    ...metrics.map<ColumnDef>((m) => ({ field: m.alias!, type: "number" })),
  ];

  const sorting: Sort[] = [];
  let limit: number | undefined;

  const timeGroup = groupBy.find((g) => !!g.dateBucket);
  if (timeGroup) {
    sorting.push({ field: timeGroup.field, direction: "asc" });
  } else if (wantsTop) {
    sorting.push({ field: metrics[0].alias!, direction: "desc" });
    limit = extractTopN(normalizedPrompt) ?? 10;
  } else if (metrics[0]) {
    sorting.push({ field: metrics[0].alias!, direction: "desc" });
  }

  return {
    id: `rpt_${Date.now()}`,
    schemaVersion: "1.0",
    name: normalizedPrompt.slice(0, 60),
    dataset: entity.source,
    columns,
    groupBy: groupBy.length ? groupBy : undefined,
    metrics,
    sorting: sorting.length ? sorting : undefined,
    limit,
    // presentation filled by chooseView (Task 7) inside MockReportAIService.
    presentation: { views: [] },
  };
}

/** Pull the N out of "10 برتر" / "top 10" if present. */
export function extractTopN(prompt: string): number | undefined {
  const m = prompt.match(/(\d+)/);
  return m ? Number(m[1]) : undefined;
}
