import type {
  ReportDefinition,
  Filter,
  FilterOperator,
  FilterValue,
  DynamicValue,
  FilterGroup,
  GroupBy,
  Metric,
  Sort,
} from "../contracts/report-definition";
import type { FieldType, Aggregation } from "../contracts/common";
import type { Dataset } from "../contracts/dataset";
import type { SemanticModel, Field } from "../contracts/semantic";

// ============================================================
// Public contract types (R3 verbatim)
// ============================================================

export type CellValue = string | number | boolean | null;
export interface ResolvedColumn { key: string; label: string; type: FieldType; isMetric: boolean; }
export type ResultRow = Record<string, string | number | null>;
export interface GroupNode { key: string; value: string | number; rows: ResultRow[]; children?: GroupNode[]; }
export interface QueryResult { columns: ResolvedColumn[]; rows: ResultRow[]; groups?: GroupNode[]; total: number; }

// ============================================================
// Injectable "now" for deterministic dynamic-date tests
// ============================================================

/** Injectable "now" so dynamic-date filters are deterministic in tests. */
export const ENGINE_TODAY: { value: number } = { value: Date.now() };

// ============================================================
// Internal helpers
// ============================================================

const GROUP_SEP = "∎"; // ∎

function pad(n: number): string { return String(n).padStart(2, "0"); }

function isoOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toNumber(v: CellValue): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

// ============================================================
// resolveDynamicValue
// ============================================================

export function resolveDynamicValue(dv: DynamicValue): number | string {
  const base = new Date(ENGINE_TODAY.value);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  let ms: number;
  switch (dv.token) {
    case "startOfYear":
      ms = Date.UTC(y, 0, 1);
      break;
    case "startOfMonth":
      ms = Date.UTC(y, m, 1);
      break;
    case "today":
    case "now":
    default:
      ms = Date.UTC(y, m, base.getUTCDate());
      break;
  }
  if (dv.offsetMonths) {
    const d2 = new Date(ms);
    d2.setUTCMonth(d2.getUTCMonth() + dv.offsetMonths);
    ms = d2.getTime();
  }
  if (dv.offsetDays) ms += dv.offsetDays * 86_400_000;
  return isoOf(ms);
}

function resolveFilterValue(value: FilterValue | undefined, dynamic?: boolean): FilterValue | undefined {
  if (
    dynamic &&
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "token" in value
  ) {
    return resolveDynamicValue(value as DynamicValue);
  }
  return value;
}

// ============================================================
// applyOperator
// ============================================================

export function applyOperator(
  op: FilterOperator,
  cell: CellValue,
  value?: FilterValue,
  value2?: FilterValue,
): boolean {
  switch (op) {
    case "isNull":    return cell === null || cell === undefined;
    case "isNotNull": return cell !== null && cell !== undefined;
    case "isTrue":    return cell === true;
    case "isFalse":   return cell === false;
  }
  if (cell === null || cell === undefined) return false;
  switch (op) {
    case "eq":    return cell === value;
    case "neq":   return cell !== value;
    case "gt":    return cell > (value as string | number);
    case "gte":   return cell >= (value as string | number);
    case "lt":    return cell < (value as string | number);
    case "lte":   return cell <= (value as string | number);
    case "between":
      return cell >= (value as string | number) && cell <= (value2 as string | number);
    case "notBetween":
      return cell < (value as string | number) || cell > (value2 as string | number);
    case "in":
      return Array.isArray(value) && (value as (string | number)[]).includes(cell as string | number);
    case "notIn":
      return Array.isArray(value) && !(value as (string | number)[]).includes(cell as string | number);
    case "contains":
      return String(cell).toLowerCase().includes(String(value).toLowerCase());
    case "notContains":
      return !String(cell).toLowerCase().includes(String(value).toLowerCase());
    case "startsWith":
      return String(cell).toLowerCase().startsWith(String(value).toLowerCase());
    case "endsWith":
      return String(cell).toLowerCase().endsWith(String(value).toLowerCase());
    default:
      return false;
  }
}

// ============================================================
// aggregate
// ============================================================

export function aggregate(agg: Aggregation, values: CellValue[]): number {
  if (agg === "count") return values.length;
  if (agg === "countDistinct") {
    return new Set(values.filter((v) => v !== null && v !== undefined)).size;
  }
  const nums = values.map(toNumber).filter((n): n is number => n !== null);
  if (nums.length === 0) return 0;
  switch (agg) {
    case "sum":  return nums.reduce((a, b) => a + b, 0);
    case "avg":  return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":  return Math.min(...nums);
    case "max":  return Math.max(...nums);
    case "none": return nums[0];
    default:     return 0;
  }
}

// ============================================================
// dateBucketKey
// ============================================================

export function dateBucketKey(iso: string, bucket: GroupBy["dateBucket"]): string {
  const [y, mo = "01", d = "01"] = iso.split("-");
  switch (bucket) {
    case "year":
      return y;
    case "quarter":
      return `${y}-Q${Math.floor((Number(mo) - 1) / 3) + 1}`;
    case "month":
      return `${y}-${mo}`;
    case "week": {
      const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
      const dayNum = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - dayNum + 3);
      const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
      const week =
        1 +
        Math.round(
          ((date.getTime() - firstThursday.getTime()) / 86_400_000 -
            3 +
            ((firstThursday.getUTCDay() + 6) % 7)) /
            7,
        );
      return `${date.getUTCFullYear()}-W${pad(week)}`;
    }
    case "day":
    default:
      return iso;
  }
}

// ============================================================
// evalExpression — safe shunting-yard evaluator (no eval/Function)
// ============================================================

const ALLOWED_FNS = new Set(["round", "abs", "coalesce", "ratio"]);

export function evalExpression(
  expr: string,
  scope: Record<string, number | null>,
): number | null {
  // Tokenize: identifiers, numbers, operators, parens, comma
  const tokens = expr.match(/[A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*|[+\-*/%(,)]/g);
  // Safety: every character must be in a recognized token
  const reconstructed = tokens ? tokens.join("") : "";
  if (!tokens || reconstructed !== expr.replace(/\s+/g, "")) {
    throw new Error(`Unsafe or unparseable expression: ${expr}`);
  }

  // Shunting-yard algorithm: tokens → RPN
  const out: (number | string)[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };

  for (const t of tokens) {
    if (/^\d/.test(t)) {
      out.push(Number(t));
    } else if (/^[A-Za-z_]/.test(t)) {
      if (ALLOWED_FNS.has(t)) {
        ops.push(t);
      } else if (t in scope) {
        out.push(scope[t] ?? 0);
      } else {
        throw new Error(`Unknown identifier in expression: ${t}`);
      }
    } else if (t === "(") {
      ops.push(t);
    } else if (t === ")") {
      while (ops.length && ops.at(-1) !== "(") out.push(ops.pop()!);
      ops.pop(); // discard "("
      if (ops.length && ALLOWED_FNS.has(ops.at(-1)!)) out.push(ops.pop()!);
    } else if (t === ",") {
      while (ops.length && ops.at(-1) !== "(") out.push(ops.pop()!);
    } else {
      // Binary operator
      while (ops.length && prec[ops.at(-1)!] !== undefined && prec[ops.at(-1)!] >= prec[t]) {
        out.push(ops.pop()!);
      }
      ops.push(t);
    }
  }
  while (ops.length) out.push(ops.pop()!);

  // Evaluate RPN
  let hadDiv = false;
  const st: number[] = [];
  for (const tk of out) {
    if (typeof tk === "number") {
      st.push(tk);
      continue;
    }
    // Built-in functions
    if (tk === "round") { st.push(Math.round(st.pop()!)); continue; }
    if (tk === "abs") { st.push(Math.abs(st.pop()!)); continue; }
    if (tk === "coalesce") { const b = st.pop()!, a = st.pop()!; st.push(Number.isFinite(a) ? a : b); continue; }
    if (tk === "ratio") { const b = st.pop()!, a = st.pop()!; st.push(b === 0 ? NaN : a / b); continue; }
    // Binary operators
    const b = st.pop()!;
    const a = st.pop()!;
    if (tk === "/" || tk === "%") hadDiv = true;
    switch (tk) {
      case "+": st.push(a + b); break;
      case "-": st.push(a - b); break;
      case "*": st.push(a * b); break;
      case "/": st.push(b === 0 ? NaN : a / b); break;
      case "%": st.push(b === 0 ? NaN : a % b); break;
      default: throw new Error(`Unknown operator: ${tk}`);
    }
  }

  const r = st.pop();
  if (r === undefined || Number.isNaN(r) || !Number.isFinite(r)) {
    return hadDiv ? null : (r ?? null);
  }
  return r;
}

// ============================================================
// runQuery — main pipeline
// ============================================================

function entityOf(semantic: SemanticModel, datasetSource: string) {
  return semantic.entities.find((e) => e.source === datasetSource) ?? semantic.entities[0];
}

function fieldById(entity: ReturnType<typeof entityOf>, id: string): Field | undefined {
  return entity.fields.find((f) => f.id === id);
}

function matchesFilter(
  row: Record<string, CellValue>,
  f: Filter,
  colLookup: Map<string, string>,
): boolean {
  const col = colLookup.get(f.field) ?? f.field;
  const v = resolveFilterValue(f.value, f.dynamic);
  const v2 = f.dynamic ? resolveFilterValue(f.value2, f.dynamic) : f.value2;
  return applyOperator(f.operator, row[col] ?? null, v, v2);
}

function matchesGroup(
  row: Record<string, CellValue>,
  g: FilterGroup,
  colLookup: Map<string, string>,
): boolean {
  const results = g.conditions.map((c) =>
    "logic" in c
      ? matchesGroup(row, c as FilterGroup, colLookup)
      : matchesFilter(row, c as Filter, colLookup),
  );
  return g.logic === "or" ? results.some(Boolean) : results.every(Boolean);
}

function bucketValue(
  v: CellValue,
  g: GroupBy,
  field: Field | undefined,
): CellValue {
  if (g.dateBucket && field?.type === "date" && typeof v === "string") {
    return dateBucketKey(v, g.dateBucket);
  }
  return v;
}

function computeMetric(
  m: Metric,
  bucketRows: Record<string, CellValue>[],
  colLookup: Map<string, string>,
): number {
  const col = m.field === "*" ? "*" : (colLookup.get(m.field) ?? m.field);
  const values =
    col === "*"
      ? bucketRows.map(() => 1 as CellValue)
      : bucketRows.map((r) => (r[col] ?? null) as CellValue);
  return aggregate(m.aggregation, values);
}

function applyAggCalcs(
  row: ResultRow,
  aggCalcs: NonNullable<ReportDefinition["calculatedFields"]>,
): void {
  for (const cf of aggCalcs) {
    const scope: Record<string, number | null> = {};
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (typeof v === "number") scope[k] = v;
    }
    row[cf.alias] = evalExpression(cf.expression, scope);
  }
}

function compareCells(a: CellValue, b: CellValue, type: FieldType): number {
  // Nulls sort last
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (type === "number") return (a as number) - (b as number);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function aliasType(
  def: ReportDefinition,
  entity: ReturnType<typeof entityOf>,
  key: string,
): FieldType {
  if ((def.metrics ?? []).some((m) => (m.alias ?? `${m.aggregation}_${m.field}`) === key)) return "number";
  if ((def.calculatedFields ?? []).some((c) => c.alias === key)) return "number";
  return fieldById(entity, key)?.type ?? "string";
}

function stableSort(
  rows: ResultRow[],
  sorting: Sort[],
  def: ReportDefinition,
  entity: ReturnType<typeof entityOf>,
): ResultRow[] {
  // Lower priority number = primary sort key; undefined priority uses array position
  const keys = [...sorting].sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity));
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      for (const s of keys) {
        const t = aliasType(def, entity, s.field);
        const c = compareCells(x.row[s.field] ?? null, y.row[s.field] ?? null, t);
        if (c !== 0) return s.direction === "desc" ? -c : c;
      }
      return x.i - y.i; // stable by original position
    })
    .map((w) => w.row);
}

function resolveColumns(
  def: ReportDefinition,
  entity: ReturnType<typeof entityOf>,
): ResolvedColumn[] {
  const cols: ResolvedColumn[] = [];
  const seen = new Set<string>();

  const push = (key: string, label: string, type: FieldType, isMetric: boolean) => {
    if (seen.has(key)) return;
    seen.add(key);
    cols.push({ key, label, type, isMetric });
  };

  // groupBy dimensions first
  for (const g of def.groupBy ?? []) {
    const f = fieldById(entity, g.field);
    push(g.field, f?.label["fa-IR"] ?? g.field, f?.type ?? "string", false);
  }
  // then metrics
  for (const m of def.metrics ?? []) {
    const key = m.alias ?? `${m.aggregation}_${m.field}`;
    push(key, m.label ?? key, "number", true);
  }
  // then calculated fields
  for (const cf of def.calculatedFields ?? []) {
    push(cf.alias, cf.label ?? cf.alias, cf.type ?? "number", true);
  }

  // flat (no groupBy/metrics) → project visible columns
  if (!def.groupBy?.length && !def.metrics?.length) {
    for (const c of def.columns) {
      if (c.visible === false) continue;
      const f = fieldById(entity, c.field);
      push(
        c.field,
        c.label ?? f?.label["fa-IR"] ?? c.field,
        c.type ?? f?.type ?? "string",
        f?.role === "measure",
      );
    }
    for (const cf of (def.calculatedFields ?? []).filter((x) => (x.scope ?? "row") === "row")) {
      push(cf.alias, cf.label ?? cf.alias, cf.type ?? "number", true);
    }
  }

  return cols;
}

function projectFlatRow(
  r: Record<string, CellValue>,
  def: ReportDefinition,
  colLookup: Map<string, string>,
): ResultRow {
  const out: ResultRow = {};
  for (const c of def.columns) {
    if (c.visible === false) continue;
    const col = colLookup.get(c.field) ?? c.field;
    const v = r[col] ?? null;
    out[c.field] = typeof v === "boolean" ? String(v) : (v as string | number | null);
  }
  for (const cf of (def.calculatedFields ?? []).filter((x) => (x.scope ?? "row") === "row")) {
    out[cf.alias] = (r[cf.alias] ?? null) as string | number | null;
  }
  return out;
}

export function runQuery(
  def: ReportDefinition,
  dataset: Dataset,
  semantic: SemanticModel,
): QueryResult {
  const entity = entityOf(semantic, def.dataset);

  // ── Build id→column lookup ──────────────────────────────────
  const colLookup = new Map<string, string>(
    entity.fields.map((f) => [f.id, f.column]),
  );

  // ── Validate field references (Bug 3) ──────────────────────
  const collectFilterFields = (cond: Filter | FilterGroup): string[] => {
    if ("logic" in cond) {
      return (cond as FilterGroup).conditions.flatMap(collectFilterFields);
    }
    return [(cond as Filter).field];
  };

  const filterFields = def.filterGroup
    ? collectFilterFields(def.filterGroup)
    : (def.filters ?? []).map((f) => f.field);

  for (const id of filterFields) {
    if (!colLookup.has(id)) throw new Error(`Unknown field: ${id}`);
  }
  for (const g of def.groupBy ?? []) {
    if (!colLookup.has(g.field)) throw new Error(`Unknown field: ${g.field}`);
  }
  for (const m of def.metrics ?? []) {
    if (m.field !== "*" && !colLookup.has(m.field)) throw new Error(`Unknown field: ${m.field}`);
  }
  // calculatedFields reference metric aliases — NOT validated against model fields

  // ── 1. FILTER ──────────────────────────────────────────────
  let rows: Record<string, CellValue>[] = dataset.map((r) => ({ ...r }));
  if (def.filterGroup) {
    rows = rows.filter((r) => matchesGroup(r, def.filterGroup!, colLookup));
  } else if (def.filters?.length) {
    rows = rows.filter((r) => def.filters!.every((f) => matchesFilter(r, f, colLookup)));
  }

  // ── 2. ROW-LEVEL calculated fields ─────────────────────────
  const rowCalcs = (def.calculatedFields ?? []).filter((c) => (c.scope ?? "row") === "row");
  for (const r of rows) {
    for (const cf of rowCalcs) {
      const scope: Record<string, number | null> = {};
      for (const k of Object.keys(r)) {
        const n = toNumber(r[k]);
        if (n !== null) scope[k] = n;
      }
      r[cf.alias] = evalExpression(cf.expression, scope);
    }
  }

  // ── 3. GROUP + AGGREGATE (or flat projection) ───────────────
  const aggCalcs = (def.calculatedFields ?? []).filter((c) => c.scope === "aggregate");
  let out: ResultRow[];
  const groupNodes: GroupNode[] = [];

  if (!def.groupBy?.length) {
    if (def.metrics?.length) {
      // Aggregate over the whole filtered set → single row
      const row: ResultRow = {};
      for (const m of def.metrics) {
        row[m.alias ?? `${m.aggregation}_${m.field}`] = computeMetric(m, rows, colLookup);
      }
      applyAggCalcs(row, aggCalcs);
      out = [row];
    } else {
      // Flat projection
      out = rows.map((r) => projectFlatRow(r, def, colLookup));
    }
  } else {
    // Build group buckets preserving insertion order (Map)
    const buckets = new Map<string, Record<string, CellValue>[]>();

    const keyOf = (r: Record<string, CellValue>) =>
      def.groupBy!
        .map((g) => {
          const col = colLookup.get(g.field) ?? g.field;
          return String(bucketValue(r[col] ?? null, g, fieldById(entity, g.field)));
        })
        .join(GROUP_SEP);

    for (const r of rows) {
      const k = keyOf(r);
      const bucket = buckets.get(k);
      if (bucket) {
        bucket.push(r);
      } else {
        buckets.set(k, [r]);
      }
    }

    out = [];
    for (const [k, bucketRows] of buckets) {
      const row: ResultRow = {};
      // Dimension values (bucketed) — output key is the field id, data is read via column
      for (const g of def.groupBy!) {
        const col = colLookup.get(g.field) ?? g.field;
        row[g.field] = bucketValue(
          bucketRows[0][col] ?? null,
          g,
          fieldById(entity, g.field),
        ) as string | number;
      }
      // Metrics
      for (const m of def.metrics ?? []) {
        row[m.alias ?? `${m.aggregation}_${m.field}`] = computeMetric(m, bucketRows, colLookup);
      }
      // Post-aggregate calculated fields
      applyAggCalcs(row, aggCalcs);
      out.push(row);
      groupNodes.push({
        key: k,
        value: row[def.groupBy![0].field] as string | number,
        rows: [row],
      });
    }
  }

  // ── 4. SORT ─────────────────────────────────────────────────
  if (def.sorting?.length) {
    out = stableSort(out, def.sorting, def, entity);
  }

  // ── 5. OFFSET / LIMIT ───────────────────────────────────────
  if (def.offset) out = out.slice(def.offset);
  if (def.limit !== undefined) out = out.slice(0, def.limit);

  return {
    columns: resolveColumns(def, entity),
    rows: out,
    groups: groupNodes.length ? groupNodes : undefined,
    total: out.length,
  };
}
