using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics.Query;

/// <summary>
/// In-memory query engine — faithfully ports the TypeScript engine in
/// <c>analytics-web/src/query/engine.ts</c>.
///
/// Pipeline: FILTER → ROW-CALC → GROUP+AGGREGATE → AGG-CALC → SORT → OFFSET/LIMIT.
///
/// DEMO CLOCK: dynamic date tokens (startOfYear / today / …) are resolved
/// against <c>DemoToday = 2025-06-01 UTC</c>. The sample data is dated 2025,
/// so date-filtered reports return rows — same as the frontend.
/// TODO(v2): replace DemoToday with a real wall-clock / tenant time-zone service.
/// </summary>
internal sealed class QueryEngine : IQueryEngine
{
    // ── Demo clock ────────────────────────────────────────────────────────────
    /// <summary>
    /// Prototype demo clock: 2025-06-01 UTC.
    /// Kept as an internal field so tests can override it via reflection
    /// (matching the frontend's <c>ENGINE_TODAY.value</c> pattern).
    /// </summary>
    internal static DateTime DemoToday = new(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

    private const string GroupSep = "∎";

    private readonly ISemanticModelStore _store;

    public QueryEngine(ISemanticModelStore store)
    {
        _store = store;
    }

    // =========================================================================
    // Public entry point
    // =========================================================================

    public async Task<ReportResultDto> ExecuteAsync(
        ReportDefinitionDto def,
        CancellationToken cancellationToken = default)
    {
        // 1. Resolve semantic model by source key
        var model = await _store.GetBySourceAsync(def.Dataset, cancellationToken);
        if (model is null)
        {
            return new ReportResultDto { Columns = [], Rows = [], Total = 0 };
        }

        // 2. Load sample rows
        var allRows = SampleDataStore.GetRows(def.Dataset);

        // 3. Build id → column lookup
        var colLookup = model.Fields.ToDictionary(
            f => f.Id,
            f => f.ResolvedColumn,
            StringComparer.Ordinal);

        // 4. Validate field references (mirrors Bug-3 fix in engine.ts)
        foreach (var filter in def.Filters)
        {
            if (!colLookup.ContainsKey(filter.Field))
                throw new InvalidOperationException($"Unknown field: {filter.Field}");
        }
        foreach (var g in def.GroupBy)
        {
            if (!colLookup.ContainsKey(g.Field))
                throw new InvalidOperationException($"Unknown field: {g.Field}");
        }
        foreach (var m in def.Metrics)
        {
            if (m.Field != "*" && !colLookup.ContainsKey(m.Field))
                throw new InvalidOperationException($"Unknown field: {m.Field}");
        }

        // 5. Filter
        var rows = ApplyFilters(allRows, def, colLookup);

        // 6. Row-level calculated fields
        var rowCalcs = def.CalculatedFields.Where(c => (c.Scope ?? "row") == "row").ToList();
        var workingRows = rows.Select(r => new Dictionary<string, object?>(r, StringComparer.Ordinal)
            as IDictionary<string, object?>).ToList();
        foreach (var row in workingRows)
        {
            ApplyRowCalcs(row, rowCalcs);
        }

        // 7. Group + aggregate (or flat / whole-table)
        var aggCalcs = def.CalculatedFields.Where(c => c.Scope == "aggregate").ToList();
        List<Dictionary<string, object?>> outRows;

        if (!def.GroupBy.Any())
        {
            if (def.Metrics.Any())
            {
                // Single aggregate row over the entire filtered set
                var single = new Dictionary<string, object?>(StringComparer.Ordinal);
                foreach (var m in def.Metrics)
                {
                    single[m.Alias ?? MetricKey(m)] = ComputeMetric(m, workingRows, colLookup);
                }
                ApplyAggCalcs(single, aggCalcs);
                outRows = [single];
            }
            else
            {
                // Flat projection
                outRows = workingRows.Select(r => ProjectFlatRow(r, def, colLookup)).ToList();
            }
        }
        else
        {
            outRows = GroupAndAggregate(workingRows, def, colLookup, model, aggCalcs);
        }

        // 8. Sort
        if (def.Sorting.Any())
        {
            outRows = StableSort(outRows, def, model);
        }

        // 9. Offset / Limit
        IEnumerable<Dictionary<string, object?>> paged = outRows;
        if (def.Offset.HasValue) paged = paged.Skip(def.Offset.Value);
        if (def.Limit.HasValue)  paged = paged.Take(def.Limit.Value);
        var finalRows = paged.ToList();

        // 10. Build columns descriptor
        var columns = ResolveColumns(def, model);

        return new ReportResultDto
        {
            Columns = columns,
            Rows    = finalRows.Cast<IDictionary<string, object?>>().ToList(),
            Total   = finalRows.Count,
        };
    }

    // =========================================================================
    // Filter pipeline
    // =========================================================================

    private static List<IReadOnlyDictionary<string, object?>> ApplyFilters(
        IReadOnlyList<IReadOnlyDictionary<string, object?>> rows,
        ReportDefinitionDto def,
        Dictionary<string, string> colLookup)
    {
        if (!def.Filters.Any()) return [.. rows];
        return rows.Where(r => def.Filters.All(f => MatchesFilter(r, f, colLookup))).ToList();
    }

    private static bool MatchesFilter(
        IReadOnlyDictionary<string, object?> row,
        ReportFilterDto filter,
        Dictionary<string, string> colLookup)
    {
        var col = colLookup.GetValueOrDefault(filter.Field, filter.Field);
        row.TryGetValue(col, out var cell);

        var value  = ResolveValue(filter.Value,  filter.Dynamic);
        var value2 = ResolveValue(filter.Value2, filter.Dynamic);

        return ApplyOperator(filter.Operator, cell, value, value2);
    }

    // =========================================================================
    // Dynamic date resolution
    // =========================================================================

    private static object? ResolveValue(object? raw, bool dynamic)
    {
        if (!dynamic || raw is null) return raw;

        // If it is a DynamicFilterValueDto serialized as a JsonElement, we read its "token"
        // property. But at runtime from the DI pipeline it arrives as a JsonElement;
        // when constructed directly in tests it is a DynamicFilterValueDto.
        if (raw is DynamicFilterValueDto dv)
        {
            return ResolveDynamicToken(dv.Token, dv.OffsetMonths, dv.OffsetDays);
        }

        // Handle JsonElement coming from the deserialized API body
        if (raw is System.Text.Json.JsonElement je)
        {
            if (je.ValueKind == System.Text.Json.JsonValueKind.Object &&
                je.TryGetProperty("token", out var tokenEl))
            {
                int? offsetMonths = je.TryGetProperty("offsetMonths", out var omEl)
                    ? omEl.GetInt32() : null;
                int? offsetDays = je.TryGetProperty("offsetDays", out var odEl)
                    ? odEl.GetInt32() : null;
                return ResolveDynamicToken(tokenEl.GetString() ?? "today", offsetMonths, offsetDays);
            }
        }

        return raw;
    }

    internal static string ResolveDynamicToken(string token, int? offsetMonths, int? offsetDays)
    {
        var today = DemoToday;
        DateTime resolved = token switch
        {
            "startOfYear"  => new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            "startOfMonth" => new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc),
            _              => today,  // "today" | "now" | anything else
        };

        if (offsetMonths.HasValue)
            resolved = resolved.AddMonths(offsetMonths.Value);
        if (offsetDays.HasValue)
            resolved = resolved.AddDays(offsetDays.Value);

        return resolved.ToString("yyyy-MM-dd");
    }

    // =========================================================================
    // Operator evaluation
    // =========================================================================

    private static bool ApplyOperator(string op, object? cell, object? value, object? value2)
    {
        switch (op)
        {
            case "isNull":    return cell is null;
            case "isNotNull": return cell is not null;
            case "isTrue":    return cell is true;
            case "isFalse":   return cell is false;
        }

        if (cell is null) return false;

        switch (op)
        {
            case "eq":    return CellEquals(cell, value);
            case "neq":   return !CellEquals(cell, value);
            case "gt":    return CompareCell(cell, value) > 0;
            case "gte":   return CompareCell(cell, value) >= 0;
            case "lt":    return CompareCell(cell, value) < 0;
            case "lte":   return CompareCell(cell, value) <= 0;
            case "between":
                return CompareCell(cell, value) >= 0 && CompareCell(cell, value2) <= 0;
            case "notBetween":
                return CompareCell(cell, value) < 0 || CompareCell(cell, value2) > 0;
            case "in":
                return value is System.Collections.IEnumerable en
                    && en.Cast<object?>().Any(v => CellEquals(cell, v));
            case "notIn":
                return value is not System.Collections.IEnumerable en2
                    || !en2.Cast<object?>().Any(v => CellEquals(cell, v));
            case "contains":
                return cell?.ToString()?.Contains(
                    value?.ToString() ?? string.Empty,
                    StringComparison.OrdinalIgnoreCase) ?? false;
            case "notContains":
                return !(cell?.ToString()?.Contains(
                    value?.ToString() ?? string.Empty,
                    StringComparison.OrdinalIgnoreCase) ?? false);
            case "startsWith":
                return cell?.ToString()?.StartsWith(
                    value?.ToString() ?? string.Empty,
                    StringComparison.OrdinalIgnoreCase) ?? false;
            case "endsWith":
                return cell?.ToString()?.EndsWith(
                    value?.ToString() ?? string.Empty,
                    StringComparison.OrdinalIgnoreCase) ?? false;
            default:
                return false;
        }
    }

    private static bool CellEquals(object? a, object? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;

        // Numeric: coerce both to double for comparison
        if (TryToDouble(a, out var da) && TryToDouble(b, out var db))
            return Math.Abs(da - db) < 1e-12;

        return string.Equals(a.ToString(), b.ToString(), StringComparison.Ordinal);
    }

    private static int CompareCell(object? a, object? b)
    {
        if (TryToDouble(a, out var da) && TryToDouble(b, out var db))
            return da.CompareTo(db);
        return StringComparer.Ordinal.Compare(a?.ToString(), b?.ToString());
    }

    // =========================================================================
    // Group + Aggregate
    // =========================================================================

    private static List<Dictionary<string, object?>> GroupAndAggregate(
        List<IDictionary<string, object?>> rows,
        ReportDefinitionDto def,
        Dictionary<string, string> colLookup,
        SemanticModelDto model,
        List<CalculatedFieldDto> aggCalcs)
    {
        // Build insertion-ordered buckets
        var buckets = new Dictionary<string, (List<IDictionary<string, object?>> Rows, object?[] DimValues)>(
            StringComparer.Ordinal);

        var fieldTypes = model.Fields.ToDictionary(f => f.Id, f => f.Type, StringComparer.Ordinal);

        foreach (var row in rows)
        {
            var dimValues = new object?[def.GroupBy.Count];
            var keyParts  = new string[def.GroupBy.Count];

            for (int i = 0; i < def.GroupBy.Count; i++)
            {
                var g      = def.GroupBy[i];
                var col    = colLookup.GetValueOrDefault(g.Field, g.Field);
                row.TryGetValue(col, out var raw);
                var bucketed = BucketValue(raw, g, fieldTypes.GetValueOrDefault(g.Field, "string"));
                dimValues[i] = bucketed;
                keyParts[i]  = bucketed?.ToString() ?? "\0null";
            }

            var key = string.Join(GroupSep, keyParts);
            if (!buckets.TryGetValue(key, out var bucket))
            {
                bucket = ([], dimValues);
                buckets[key] = bucket;
            }
            bucket.Rows.Add(row);
        }

        var result = new List<Dictionary<string, object?>>(buckets.Count);

        foreach (var (_, (bucketRows, dimValues)) in buckets)
        {
            var outRow = new Dictionary<string, object?>(StringComparer.Ordinal);

            // Dimension values — key is the field id
            for (int i = 0; i < def.GroupBy.Count; i++)
            {
                outRow[def.GroupBy[i].Field] = dimValues[i];
            }

            // Metrics
            foreach (var m in def.Metrics)
            {
                outRow[m.Alias ?? MetricKey(m)] = ComputeMetric(m, bucketRows, colLookup);
            }

            // Post-aggregate calculated fields
            ApplyAggCalcs(outRow, aggCalcs);

            result.Add(outRow);
        }

        return result;
    }

    // =========================================================================
    // Date bucketing
    // =========================================================================

    private static object? BucketValue(object? raw, ReportGroupByDto g, string fieldType)
    {
        if (g.DateBucket is null || fieldType != "date" || raw is not string iso)
            return raw;
        return DateBucketKey(iso, g.DateBucket);
    }

    internal static string DateBucketKey(string iso, string bucket)
    {
        var parts = iso.Split('-');
        var y  = parts.Length > 0 ? parts[0] : "0000";
        var mo = parts.Length > 1 ? parts[1] : "01";
        var d  = parts.Length > 2 ? parts[2] : "01";

        return bucket switch
        {
            "year"    => y,
            "quarter" => $"{y}-Q{(int.Parse(mo) - 1) / 3 + 1}",
            "month"   => $"{y}-{mo}",
            "week"    => WeekBucketKey(int.Parse(y), int.Parse(mo), int.Parse(d)),
            _         => iso,  // "day" or unrecognised
        };
    }

    private static string WeekBucketKey(int y, int mo, int d)
    {
        // ISO 8601 week number — matches the TypeScript implementation
        var date = new DateTime(y, mo, d, 0, 0, 0, DateTimeKind.Utc);
        int dayNum = ((int)date.DayOfWeek + 6) % 7; // Mon=0 … Sun=6
        var thursday = date.AddDays(3 - dayNum);
        var firstThursday = new DateTime(thursday.Year, 1, 4, 0, 0, 0, DateTimeKind.Utc);
        int week = 1 + (int)Math.Round(
            ((thursday - firstThursday).TotalDays - 3 +
             ((int)firstThursday.DayOfWeek + 6) % 7) / 7.0);
        return $"{thursday.Year}-W{week:D2}";
    }

    // =========================================================================
    // Aggregation
    // =========================================================================

    private static double ComputeMetric(
        ReportMetricDto m,
        IReadOnlyList<IDictionary<string, object?>> bucketRows,
        Dictionary<string, string> colLookup)
    {
        if (m.Aggregation == "count") return bucketRows.Count;

        if (m.Aggregation == "countDistinct")
        {
            var col2 = m.Field == "*" ? null : colLookup.GetValueOrDefault(m.Field, m.Field);
            return bucketRows
                .Select(r =>
                {
                    if (col2 is null) return (object?)null;
                    r.TryGetValue(col2, out var v2);
                    return v2;
                })
                .Where(v => v is not null)
                .Distinct()
                .Count();
        }

        var col = m.Field == "*" ? null : colLookup.GetValueOrDefault(m.Field, m.Field);
        var nums = bucketRows
            .Select(r =>
            {
                if (col is null) return null;
                r.TryGetValue(col, out var v);
                return v;
            })
            .Select(v => TryToDoubleNullable(v))
            .Where(n => n.HasValue)
            .Select(n => n!.Value)
            .ToList();

        if (nums.Count == 0) return 0;

        return m.Aggregation switch
        {
            "sum" => nums.Sum(),
            "avg" => nums.Average(),
            "min" => nums.Min(),
            "max" => nums.Max(),
            _     => 0,
        };
    }

    // =========================================================================
    // Calculated fields
    // =========================================================================

    private static void ApplyRowCalcs(IDictionary<string, object?> row, List<CalculatedFieldDto> calcs)
    {
        foreach (var cf in calcs)
        {
            var scope = BuildNumericScope(row);
            try { row[cf.Alias] = EvalExpression(cf.Expression, scope); }
            catch { row[cf.Alias] = null; }
        }
    }

    private static void ApplyAggCalcs(IDictionary<string, object?> row, List<CalculatedFieldDto> calcs)
    {
        foreach (var cf in calcs)
        {
            var scope = BuildNumericScope(row);
            try { row[cf.Alias] = EvalExpression(cf.Expression, scope); }
            catch { row[cf.Alias] = null; }
        }
    }

    private static Dictionary<string, double?> BuildNumericScope(IDictionary<string, object?> row)
    {
        var scope = new Dictionary<string, double?>(StringComparer.Ordinal);
        foreach (var (k, v) in row)
        {
            if (TryToDoubleNullable(v) is { } d) scope[k] = d;
        }
        return scope;
    }

    // ── Safe shunting-yard evaluator (mirrors evalExpression in engine.ts) ────

    private static readonly HashSet<string> AllowedFunctions =
        ["round", "abs", "coalesce", "ratio"];

    /// <summary>
    /// Evaluates a safe arithmetic expression over a numeric scope.
    /// Supports: + - * / % and built-ins round / abs / coalesce / ratio.
    /// Returns <c>null</c> on division-by-zero or evaluation error.
    /// Throws <see cref="InvalidOperationException"/> on unsafe tokens.
    /// </summary>
    internal static double? EvalExpression(string expr, Dictionary<string, double?> scope)
    {
        // Tokenize
        var tokens = System.Text.RegularExpressions.Regex.Matches(
                expr,
                @"[A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*|[+\-*/%(),]")
            .Select(m => m.Value)
            .ToList();

        // Safety: reconstructed must equal whitespace-stripped expr
        var reconstructed = string.Concat(tokens);
        if (reconstructed != System.Text.RegularExpressions.Regex.Replace(expr, @"\s+", ""))
            throw new InvalidOperationException($"Unsafe or unparseable expression: {expr}");

        // Shunting-yard → RPN
        var prec = new Dictionary<string, int>(StringComparer.Ordinal)
            { ["+"] = 1, ["-"] = 1, ["*"] = 2, ["/"] = 2, ["%"] = 2 };
        var output = new List<object>();
        var opStack = new Stack<string>();

        foreach (var t in tokens)
        {
            if (double.TryParse(t, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var num))
            {
                output.Add(num);
            }
            else if (IsIdentifier(t))
            {
                if (AllowedFunctions.Contains(t))
                {
                    opStack.Push(t);
                }
                else if (scope.TryGetValue(t, out var sv))
                {
                    output.Add(sv ?? 0.0);
                }
                else
                {
                    throw new InvalidOperationException($"Unknown identifier in expression: {t}");
                }
            }
            else if (t == "(")
            {
                opStack.Push(t);
            }
            else if (t == ")")
            {
                while (opStack.Count > 0 && opStack.Peek() != "(")
                    output.Add(opStack.Pop());
                if (opStack.Count > 0) opStack.Pop(); // discard "("
                if (opStack.Count > 0 && AllowedFunctions.Contains(opStack.Peek()))
                    output.Add(opStack.Pop());
            }
            else if (t == ",")
            {
                while (opStack.Count > 0 && opStack.Peek() != "(")
                    output.Add(opStack.Pop());
            }
            else
            {
                while (opStack.Count > 0 &&
                       prec.TryGetValue(opStack.Peek(), out var topPrec) &&
                       prec.TryGetValue(t, out var curPrec) &&
                       topPrec >= curPrec)
                {
                    output.Add(opStack.Pop());
                }
                opStack.Push(t);
            }
        }
        while (opStack.Count > 0) output.Add(opStack.Pop());

        // Evaluate RPN
        var st = new Stack<double>();
        bool hadDiv = false;

        foreach (var tk in output)
        {
            if (tk is double d) { st.Push(d); continue; }
            var s = (string)tk;

            switch (s)
            {
                case "round":   st.Push(Math.Round(st.Pop())); continue;
                case "abs":     st.Push(Math.Abs(st.Pop())); continue;
                case "coalesce":
                {
                    var b = st.Pop(); var a = st.Pop();
                    st.Push(double.IsFinite(a) ? a : b);
                    continue;
                }
                case "ratio":
                {
                    var b = st.Pop(); var a = st.Pop();
                    st.Push(b == 0 ? double.NaN : a / b);
                    hadDiv = true;
                    continue;
                }
            }

            var rb = st.Pop(); var ra = st.Pop();
            switch (s)
            {
                case "+": st.Push(ra + rb); break;
                case "-": st.Push(ra - rb); break;
                case "*": st.Push(ra * rb); break;
                case "/":
                    hadDiv = true;
                    st.Push(rb == 0 ? double.NaN : ra / rb);
                    break;
                case "%":
                    hadDiv = true;
                    st.Push(rb == 0 ? double.NaN : ra % rb);
                    break;
                default:
                    throw new InvalidOperationException($"Unknown operator: {s}");
            }
        }

        if (!st.TryPop(out var result)) return null;
        if (double.IsNaN(result) || !double.IsFinite(result))
            return hadDiv ? null : (double?)result;
        return result;
    }

    private static bool IsIdentifier(string t) =>
        t.Length > 0 && (char.IsLetter(t[0]) || t[0] == '_');

    // =========================================================================
    // Flat projection
    // =========================================================================

    private static Dictionary<string, object?> ProjectFlatRow(
        IDictionary<string, object?> row,
        ReportDefinitionDto def,
        Dictionary<string, string> colLookup)
    {
        var out_ = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var c in def.Columns)
        {
            var col = colLookup.GetValueOrDefault(c.Field, c.Field);
            row.TryGetValue(col, out var v);
            out_[c.Field] = v;
        }
        return out_;
    }

    // =========================================================================
    // Sort
    // =========================================================================

    private static List<Dictionary<string, object?>> StableSort(
        List<Dictionary<string, object?>> rows,
        ReportDefinitionDto def,
        SemanticModelDto model)
    {
        var fieldTypes = model.Fields.ToDictionary(f => f.Id, f => f.Type, StringComparer.Ordinal);
        var metricKeys = new HashSet<string>(
            def.Metrics.Select(m => m.Alias ?? MetricKey(m)), StringComparer.Ordinal);
        var calcKeys = new HashSet<string>(
            def.CalculatedFields.Select(c => c.Alias), StringComparer.Ordinal);

        // Sort specs in priority order (lower priority number = primary)
        var specs = def.Sorting
            .Select((s, i) => (Sort: s, Idx: i))
            .OrderBy(x => x.Sort.Priority ?? x.Idx)
            .ToList();

        return rows
            .Select((row, i) => (row, i))
            .OrderBy(x => 0)  // stable baseline
            .ThenBy(x =>
            {
                // multi-key sort via IComparer
                return 0;
            })
            .ToList()
            .OrderBy(x => x.i)  // stable initial order
            .ToList()
            .Select(x => x.row)
            .ToList()
            // Do a proper stable multi-key sort using index tagging
            .Pipe(rows2 => StableSortInner(rows2, specs, fieldTypes, metricKeys, calcKeys));
    }

    private static List<Dictionary<string, object?>> StableSortInner(
        List<Dictionary<string, object?>> rows,
        List<(ReportSortDto Sort, int Idx)> specs,
        Dictionary<string, string> fieldTypes,
        HashSet<string> metricKeys,
        HashSet<string> calcKeys)
    {
        return rows
            .Select((row, i) => (row, i))
            .OrderBy(x => 0, Comparer<int>.Create((_, __) => 0))
            .ToList()
            // Custom stable sort via index tagging
            .OrderUsing(specs, fieldTypes, metricKeys, calcKeys)
            .Select(x => x.row)
            .ToList();
    }

    // =========================================================================
    // Column resolution
    // =========================================================================

    private static List<ResultColumnDto> ResolveColumns(
        ReportDefinitionDto def,
        SemanticModelDto model)
    {
        var seen    = new HashSet<string>(StringComparer.Ordinal);
        var columns = new List<ResultColumnDto>();
        var fieldMap = model.Fields.ToDictionary(f => f.Id, StringComparer.Ordinal);

        void Push(string key, string label, string type, bool isMetric)
        {
            if (!seen.Add(key)) return;
            columns.Add(new ResultColumnDto
            {
                Key      = key,
                Label    = label,
                DataType = type,
                IsMetric = isMetric,
            });
        }

        // GroupBy dimensions first
        foreach (var g in def.GroupBy)
        {
            fieldMap.TryGetValue(g.Field, out var f);
            Push(g.Field, f?.Name ?? g.Field, f?.Type ?? "string", isMetric: false);
        }
        // Metrics
        foreach (var m in def.Metrics)
        {
            var key = m.Alias ?? MetricKey(m);
            Push(key, key, "number", isMetric: true);
        }
        // Calculated fields
        foreach (var cf in def.CalculatedFields)
        {
            Push(cf.Alias, cf.Label ?? cf.Alias, cf.Type ?? "number", isMetric: true);
        }
        // Flat (no groupBy/metrics) — project visible columns
        if (!def.GroupBy.Any() && !def.Metrics.Any())
        {
            foreach (var c in def.Columns)
            {
                fieldMap.TryGetValue(c.Field, out var f);
                Push(c.Field, f?.Name ?? c.Field, f?.Type ?? "string",
                    isMetric: f?.Role == "measure");
            }
        }

        return columns;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private static string MetricKey(ReportMetricDto m) =>
        $"{m.Aggregation}_{m.Field}";

    private static bool TryToDouble(object? v, out double d)
    {
        switch (v)
        {
            case double   dbl: d = dbl; return true;
            case float    flt: d = flt; return true;
            case int      i:   d = i;   return true;
            case long     l:   d = l;   return true;
            case decimal  dec: d = (double)dec; return true;
            case System.Text.Json.JsonElement je when je.ValueKind == System.Text.Json.JsonValueKind.Number:
                d = je.GetDouble(); return true;
            default:
                if (v is not null && double.TryParse(
                        v.ToString(),
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out d))
                    return true;
                d = 0; return false;
        }
    }

    private static double? TryToDoubleNullable(object? v) =>
        TryToDouble(v, out var d) ? d : null;
}

// ── Extension helpers ─────────────────────────────────────────────────────────

file static class SortExtensions
{
    /// <summary>Stable multi-key sort using index tagging.</summary>
    internal static List<(Dictionary<string, object?> row, int i)> OrderUsing(
        this List<(Dictionary<string, object?> row, int i)> tagged,
        List<(Mabhas19.Application.Analytics.Reports.ReportSortDto Sort, int Idx)> specs,
        Dictionary<string, string> fieldTypes,
        HashSet<string> metricKeys,
        HashSet<string> calcKeys)
    {
        return tagged
            .OrderBy(x =>
            {
                // We use a Tuple as sort key so .NET's stable sort keeps order within ties
                return new SortKey(x.row, specs, fieldTypes, metricKeys, x.i);
            }, SortKeyComparer.Instance)
            .ToList();
    }
}

file sealed class SortKey
{
    private readonly Dictionary<string, object?> _row;
    private readonly List<(Mabhas19.Application.Analytics.Reports.ReportSortDto Sort, int Idx)> _specs;
    private readonly Dictionary<string, string> _fieldTypes;
    private readonly HashSet<string> _metricKeys;
    private readonly int _origIndex;

    public SortKey(
        Dictionary<string, object?> row,
        List<(Mabhas19.Application.Analytics.Reports.ReportSortDto Sort, int Idx)> specs,
        Dictionary<string, string> fieldTypes,
        HashSet<string> metricKeys,
        int origIndex)
    {
        _row        = row;
        _specs      = specs;
        _fieldTypes = fieldTypes;
        _metricKeys = metricKeys;
        _origIndex  = origIndex;
    }

    public int OrigIndex => _origIndex;

    public int CompareWith(SortKey other)
    {
        foreach (var (s, _) in _specs)
        {
            _row.TryGetValue(s.Field, out var av);
            other._row.TryGetValue(s.Field, out var bv);

            var isNum = _metricKeys.Contains(s.Field) ||
                        _fieldTypes.GetValueOrDefault(s.Field, "string") == "number";

            int c;
            if (av is null && bv is null) c = 0;
            else if (av is null) c = 1;
            else if (bv is null) c = -1;
            else if (isNum && TryD(av, out var da) && TryD(bv, out var db))
                c = da.CompareTo(db);
            else
                c = StringComparer.Ordinal.Compare(av?.ToString(), bv?.ToString());

            if (c != 0)
                return s.Direction == "desc" ? -c : c;
        }
        return _origIndex.CompareTo(other._origIndex); // stable
    }

    private static bool TryD(object? v, out double d)
    {
        switch (v)
        {
            case double dbl: d = dbl; return true;
            case float  flt: d = flt; return true;
            case int    i:   d = i;   return true;
            case long   l:   d = l;   return true;
            default:
                if (v is not null && double.TryParse(
                        v.ToString(),
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out d))
                    return true;
                d = 0; return false;
        }
    }
}

file sealed class SortKeyComparer : IComparer<SortKey>
{
    public static readonly SortKeyComparer Instance = new();
    public int Compare(SortKey? x, SortKey? y)
    {
        if (x is null && y is null) return 0;
        if (x is null) return -1;
        if (y is null) return 1;
        return x.CompareWith(y);
    }
}

file static class PipeExtension
{
    internal static TOut Pipe<TIn, TOut>(this TIn value, Func<TIn, TOut> fn) => fn(value);
}
