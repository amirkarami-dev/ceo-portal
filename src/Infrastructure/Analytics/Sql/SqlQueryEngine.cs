using System.Text;
using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Analytics.Sql;

/// <summary>
/// SQL-backed query engine for the FarsNezam external database.
/// Security model:
/// <list type="bullet">
///   <item>Every table and column reference is whitelisted against the semantic model before SQL generation.</item>
///   <item>Identifiers are bracket-quoted from the whitelist — never from raw user/AI input.</item>
///   <item>All filter values are parameterized (@p0, @p1, …) — no value interpolation.</item>
///   <item>Aggregation is pushed to the DB (GROUP BY / aggregates in SQL) — no in-memory row loads.</item>
/// </list>
/// </summary>
internal sealed class SqlQueryEngine : IQueryEngine
{
    private readonly ISemanticModelStore _modelStore;
    private readonly SqlAnalyticsOptions _options;
    private readonly ILogger<SqlQueryEngine> _logger;

    public SqlQueryEngine(
        ISemanticModelStore modelStore,
        IOptions<SqlAnalyticsOptions> options,
        ILogger<SqlQueryEngine> logger)
    {
        _modelStore = modelStore;
        _options    = options.Value;
        _logger     = logger;
    }

    // =========================================================================
    // IQueryEngine implementation
    // =========================================================================

    public async Task<ReportResultDto> ExecuteAsync(
        ReportDefinitionDto definition,
        CancellationToken cancellationToken = default)
    {
        // 1. Resolve model by source key (def.Dataset)
        var model = await _modelStore.GetBySourceAsync(definition.Dataset, cancellationToken);
        if (model is null)
        {
            _logger.LogWarning("SqlQueryEngine: unknown dataset '{Dataset}'", definition.Dataset);
            return new ReportResultDto { Columns = [], Rows = [], Total = 0 };
        }

        // 2. Resolve real table name
        if (!KurdNezamSemanticModelStore.SourceToTable.TryGetValue(definition.Dataset, out var tableName))
        {
            _logger.LogWarning("SqlQueryEngine: no table mapping for source '{Source}'", definition.Dataset);
            return new ReportResultDto { Columns = [], Rows = [], Total = 0 };
        }

        // 3. Build parameterized SQL (pure, testable)
        var sql = BuildSql(definition, model, tableName, out var parameters);

        _logger.LogDebug("SqlQueryEngine executing: {Sql}", sql);

        // 4. Execute against the real DB
        var rows = new List<Dictionary<string, object?>>();

        await using var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn)
        {
            CommandTimeout = _options.CommandTimeoutSeconds,
        };

        foreach (var (name, value) in parameters)
        {
            cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        }

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var row = new Dictionary<string, object?>(StringComparer.Ordinal);
            for (int i = 0; i < reader.FieldCount; i++)
            {
                var colName = reader.GetName(i);
                row[colName] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            rows.Add(row);
        }

        // 5. Decode dictionary-coded values (Reshte 5 → "برق", PayeT -1 → "ارشد", …) for DISPLAY.
        // Filters/sorting already ran in SQL on the raw codes, so this changes presentation only.
        ApplyValueLabels(rows, model);

        // 6. Build column descriptors
        var columns = ResolveColumns(definition, model);

        return new ReportResultDto
        {
            Columns = columns,
            Rows    = rows.Cast<IDictionary<string, object?>>().ToList(),
            Total   = rows.Count,
        };
    }

    // =========================================================================
    // Public pure SQL builder — unit-testable without a DB connection
    // =========================================================================

    /// <summary>
    /// Builds a parameterized SQL SELECT statement from the validated report definition.
    /// All identifiers come ONLY from the whitelisted semantic model.
    /// All filter values are emitted as named parameters (@p0, @p1, …).
    /// </summary>
    /// <param name="definition">Report definition (from the AI or the client).</param>
    /// <param name="model">Resolved semantic model (pre-fetched by caller for testability).</param>
    /// <param name="tableName">Real SQL table name (from the source→table whitelist).</param>
    /// <param name="parameters">Output: list of (paramName, value) pairs for SqlCommand.Parameters.</param>
    /// <returns>Parameterized SQL string ready for execution.</returns>
    /// <exception cref="InvalidOperationException">Thrown when an unknown field is referenced (whitelist enforcement).</exception>
    /// <summary>
    /// Replaces dictionary-coded values in result rows with their display labels, per the
    /// model's <see cref="SemanticFieldDto.ValueLabels"/>. Pure and idempotent: unknown codes
    /// and fields without a dictionary pass through untouched. bit columns arrive from
    /// SqlDataReader as bool and normalise to "1"/"0"; numeric codes normalise to their
    /// invariant integral string (smallint/int/decimal all become "5", "-1", …).
    /// </summary>
    internal static void ApplyValueLabels(
        List<Dictionary<string, object?>> rows, SemanticModelDto model)
    {
        var labelledFields = model.Fields
            .Where(f => f.ValueLabels is { Count: > 0 })
            .ToList();
        if (labelledFields.Count == 0 || rows.Count == 0) return;

        foreach (var row in rows)
        {
            foreach (var field in labelledFields)
            {
                if (!row.TryGetValue(field.Id, out var value) || value is null) continue;

                var code = NormalizeCode(value);
                if (code is not null && field.ValueLabels!.TryGetValue(code, out var label))
                {
                    row[field.Id] = label;
                }
            }
        }
    }

    /// <summary>bool → "1"/"0"; integral-valued numerics → invariant string; strings trimmed.</summary>
    private static string? NormalizeCode(object value)
    {
        switch (value)
        {
            case bool b:
                return b ? "1" : "0";
            case string s:
                return s.Trim();
            case sbyte or byte or short or ushort or int or uint or long:
                return Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture)
                    .ToString(System.Globalization.CultureInfo.InvariantCulture);
            case decimal d when d == decimal.Truncate(d):
                return ((long)d).ToString(System.Globalization.CultureInfo.InvariantCulture);
            case double dbl when dbl == Math.Truncate(dbl):
                return ((long)dbl).ToString(System.Globalization.CultureInfo.InvariantCulture);
            default:
                return null; // fractional / exotic → leave the raw value alone
        }
    }

    public static string BuildSql(
        ReportDefinitionDto definition,
        SemanticModelDto model,
        string tableName,
        out List<(string Name, object? Value)> parameters)
    {
        // Build field whitelist: fieldId → ResolvedColumn
        var fieldMap = model.Fields.ToDictionary(
            f => f.Id,
            f => f.ResolvedColumn,
            StringComparer.Ordinal);

        // Jalali date fields (type == "string" AND used with dateBucket)
        var fieldTypes = model.Fields.ToDictionary(f => f.Id, f => f.Type, StringComparer.Ordinal);

        // Full field map (for lookup-join metadata).
        var fieldDtos = model.Fields.ToDictionary(f => f.Id, StringComparer.Ordinal);

        parameters = [];
        int paramIndex = 0;

        // ── Validate all referenced fields ────────────────────────────────────

        ValidateFields(definition, fieldMap);

        // ── Lookup (code → label) LEFT JOINs for grouped dimensions ───────────
        // A field may declare a lookup table in the TRUSTED semantic model; when grouped,
        // we LEFT JOIN it and project the label instead of the raw code. Table/column
        // identifiers come ONLY from the model (never user/AI input) → safe to bracket-quote.
        var lookupJoins = new List<string>();
        var joinedLookups = new HashSet<string>(StringComparer.Ordinal);
        foreach (var g in definition.GroupBy)
        {
            if (fieldDtos.TryGetValue(g.Field, out var fld) && fld.HasLookup && joinedLookups.Add(g.Field))
            {
                lookupJoins.Add(
                    $"LEFT JOIN [{fld.LookupTable}] AS [lk_{g.Field}] " +
                    $"ON [{tableName}].[{fld.ResolvedColumn}] = [lk_{g.Field}].[{fld.LookupKeyColumn}]");
            }
        }

        // Qualify base-table columns with the table name ONLY when we join (avoids identifier
        // ambiguity — e.g. both the base table and a lookup may have an [Id] column). With no
        // join, columns stay bare so existing single-table SQL is byte-for-byte unchanged.
        bool qualify = lookupJoins.Count > 0;

        // Resolves a whitelisted field id to its (optionally table-qualified) bracketed column.
        string ColRef(string fieldId) =>
            qualify ? $"[{tableName}].[{fieldMap[fieldId]}]" : $"[{fieldMap[fieldId]}]";

        // Dimension SELECT/GROUP expression: the lookup label when configured, else the
        // (optionally Jalali-bucketed) column.
        string DimExpr(ReportGroupByDto g)
        {
            if (fieldDtos.TryGetValue(g.Field, out var fld) && fld.HasLookup)
                return $"[lk_{g.Field}].[{fld.LookupNameColumn}]";
            return BuildDimExpression(ColRef(g.Field), g, fieldTypes.GetValueOrDefault(g.Field, "string"));
        }

        // ── SELECT columns ────────────────────────────────────────────────────

        var sb = new StringBuilder();

        bool hasGroupBy = definition.GroupBy.Count > 0;
        bool hasMetrics = definition.Metrics.Count > 0;

        // Build SELECT list
        sb.Append("SELECT ");

        var selectParts = new List<string>();

        if (hasGroupBy)
        {
            foreach (var g in definition.GroupBy)
                selectParts.Add($"{DimExpr(g)} AS [{g.Field}]");
        }

        if (hasMetrics)
        {
            foreach (var m in definition.Metrics)
            {
                var aggExpr = BuildAggregateExpression(m, ColRef);
                var alias   = m.Alias ?? $"{m.Aggregation}_{m.Field}";
                selectParts.Add($"{aggExpr} AS [{alias}]");
            }
        }

        // Flat column projection (no groupBy, no metrics)
        if (!hasGroupBy && !hasMetrics)
        {
            if (definition.Columns.Count > 0)
            {
                foreach (var c in definition.Columns)
                    selectParts.Add($"{ColRef(c.Field)} AS [{c.Field}]");
            }
            else
            {
                // Fallback: SELECT *
                selectParts.Add("*");
            }
        }

        sb.AppendJoin(", ", selectParts);

        // ── FROM ──────────────────────────────────────────────────────────────

        // tableName comes ONLY from our SourceToTable whitelist — safe to bracket-quote
        sb.Append($" FROM [{tableName}]");
        foreach (var join in lookupJoins)
            sb.Append(' ').Append(join);

        // ── WHERE ─────────────────────────────────────────────────────────────

        if (definition.Filters.Count > 0)
        {
            var whereParts = new List<string>();
            foreach (var filter in definition.Filters)
            {
                var clause = BuildFilterClause(filter, ColRef(filter.Field), parameters, ref paramIndex);
                if (clause is not null)
                    whereParts.Add(clause);
            }

            if (whereParts.Count > 0)
            {
                sb.Append(" WHERE ");
                sb.AppendJoin(" AND ", whereParts);
            }
        }

        // ── GROUP BY ──────────────────────────────────────────────────────────

        if (hasGroupBy)
        {
            sb.Append(" GROUP BY ");
            sb.AppendJoin(", ", definition.GroupBy.Select(DimExpr));
        }

        // ── ORDER BY ─────────────────────────────────────────────────────────

        var limit = definition.Limit ?? 1_000;
        var offset = definition.Offset ?? 0;

        if (definition.Sorting.Count > 0)
        {
            sb.Append(" ORDER BY ");
            var sortParts = definition.Sorting.Select(s =>
            {
                // Sort field must be a known field or a metric alias — validate
                var dir = string.Equals(s.Direction, "desc", StringComparison.OrdinalIgnoreCase)
                    ? "DESC" : "ASC";

                // Check if it's a metric alias
                var metricAlias = definition.Metrics
                    .FirstOrDefault(m => string.Equals(m.Alias ?? $"{m.Aggregation}_{m.Field}", s.Field, StringComparison.Ordinal));

                if (metricAlias is not null)
                {
                    // Sort by metric alias — safe to bracket from local definition
                    var alias = metricAlias.Alias ?? $"{metricAlias.Aggregation}_{metricAlias.Field}";
                    return $"[{alias}] {dir}";
                }

                if (fieldMap.ContainsKey(s.Field))
                {
                    if (hasGroupBy)
                    {
                        // When grouping, sort by the SELECT expression (not the raw column)
                        var gDef = definition.GroupBy.FirstOrDefault(g => g.Field == s.Field);
                        if (gDef is not null)
                            return $"{DimExpr(gDef)} {dir}";
                    }
                    return $"{ColRef(s.Field)} {dir}";
                }

                throw new InvalidOperationException(
                    $"Sort field '{s.Field}' is not a whitelisted field or metric alias.");
            });
            sb.AppendJoin(", ", sortParts);
        }
        else
        {
            // Need an ORDER BY for FETCH/OFFSET
            sb.Append(" ORDER BY (SELECT NULL)");
        }

        // ── OFFSET / FETCH ────────────────────────────────────────────────────

        var limitParamName  = $"@limit";
        var offsetParamName = $"@offset";
        parameters.Add((limitParamName, limit));
        parameters.Add((offsetParamName, offset));

        sb.Append($" OFFSET {offsetParamName} ROWS FETCH NEXT {limitParamName} ROWS ONLY");

        return sb.ToString();
    }

    // =========================================================================
    // Whitelist validation
    // =========================================================================

    private static void ValidateFields(
        ReportDefinitionDto definition,
        Dictionary<string, string> fieldMap)
    {
        foreach (var f in definition.Filters)
        {
            if (!fieldMap.ContainsKey(f.Field))
                throw new InvalidOperationException(
                    $"Filter field '{f.Field}' is not defined in the semantic model. Allowed: {string.Join(", ", fieldMap.Keys)}");
        }

        foreach (var g in definition.GroupBy)
        {
            if (!fieldMap.ContainsKey(g.Field))
                throw new InvalidOperationException(
                    $"GroupBy field '{g.Field}' is not defined in the semantic model. Allowed: {string.Join(", ", fieldMap.Keys)}");
        }

        foreach (var m in definition.Metrics)
        {
            if (m.Field != "*" && !fieldMap.ContainsKey(m.Field))
                throw new InvalidOperationException(
                    $"Metric field '{m.Field}' is not defined in the semantic model. Allowed: {string.Join(", ", fieldMap.Keys)}");
        }

        foreach (var c in definition.Columns)
        {
            if (!fieldMap.ContainsKey(c.Field))
                throw new InvalidOperationException(
                    $"Column field '{c.Field}' is not defined in the semantic model. Allowed: {string.Join(", ", fieldMap.Keys)}");
        }
    }

    // =========================================================================
    // SQL expression builders (identifiers from whitelist only)
    // =========================================================================

    /// <summary>
    /// Returns the SELECT / GROUP BY expression for a dimension field,
    /// applying Jalali date bucketing (LEFT()) when requested.
    /// Only "year" and "month" buckets are supported for Jalali string dates.
    /// </summary>
    private static string BuildDimExpression(
        string colExpr,   // already bracketed (and optionally table-qualified) column reference
        ReportGroupByDto g,
        string fieldType)
    {
        if (g.DateBucket is not null && fieldType == "string")
        {
            // Jalali date string bucketing via string prefix
            return g.DateBucket switch
            {
                "year"  => $"LEFT({colExpr}, 4)",
                "month" => $"LEFT({colExpr}, 7)",
                _       => colExpr,  // unsupported bucket → plain column
            };
        }

        return colExpr;
    }

    /// <summary>
    /// Builds an aggregate SQL expression for a metric.
    /// The field name comes only from the whitelisted fieldMap.
    /// </summary>
    private static string BuildAggregateExpression(
        ReportMetricDto m,
        Func<string, string> colRef)   // resolves a field id to its bracketed (qualified) column
    {
        return m.Aggregation switch
        {
            "count"         => "COUNT(*)",
            "countDistinct" when m.Field != "*" => $"COUNT(DISTINCT {colRef(m.Field)})",
            "countDistinct" => "COUNT(*)",
            "sum"           when m.Field != "*" => $"SUM({colRef(m.Field)})",
            "avg"           when m.Field != "*" => $"AVG(CAST({colRef(m.Field)} AS FLOAT))",
            "min"           when m.Field != "*" => $"MIN({colRef(m.Field)})",
            "max"           when m.Field != "*" => $"MAX({colRef(m.Field)})",
            _               => "COUNT(*)",
        };
    }

    /// <summary>
    /// Builds a parameterized WHERE clause fragment for a single filter.
    /// All values are emitted as @p{n} parameters — never interpolated.
    /// </summary>
    private static string? BuildFilterClause(
        ReportFilterDto filter,
        string col,                  // already-bracketed (and optionally table-qualified) column reference
        List<(string Name, object? Value)> parameters,
        ref int paramIndex)
    {
        switch (filter.Operator)
        {
            case "isNull":
                return $"{col} IS NULL";

            case "notNull":
            case "isNotNull":
                return $"{col} IS NOT NULL";

            case "eq":
            {
                var p = NextParam(ref paramIndex);
                parameters.Add((p, CoerceValue(filter.Value)));
                return $"{col} = {p}";
            }

            case "neq":
            {
                var p = NextParam(ref paramIndex);
                parameters.Add((p, CoerceValue(filter.Value)));
                return $"{col} <> {p}";
            }

            case "gt":
            {
                var p = NextParam(ref paramIndex);
                parameters.Add((p, CoerceValue(filter.Value)));
                return $"{col} > {p}";
            }

            case "gte":
            {
                var p = NextParam(ref paramIndex);
                parameters.Add((p, CoerceValue(filter.Value)));
                return $"{col} >= {p}";
            }

            case "lt":
            {
                var p = NextParam(ref paramIndex);
                parameters.Add((p, CoerceValue(filter.Value)));
                return $"{col} < {p}";
            }

            case "lte":
            {
                var p = NextParam(ref paramIndex);
                parameters.Add((p, CoerceValue(filter.Value)));
                return $"{col} <= {p}";
            }

            case "contains":
            {
                // Value is wrapped in % at parameter build time — the LIKE pattern is a parameter
                var p = NextParam(ref paramIndex);
                var raw = filter.Value?.ToString() ?? string.Empty;
                parameters.Add((p, $"%{raw}%"));
                return $"{col} LIKE {p}";
            }

            case "between":
            {
                var p1 = NextParam(ref paramIndex);
                var p2 = NextParam(ref paramIndex);
                parameters.Add((p1, CoerceValue(filter.Value)));
                parameters.Add((p2, CoerceValue(filter.Value2)));
                return $"{col} BETWEEN {p1} AND {p2}";
            }

            case "in":
            {
                // filter.Value should be a JSON array or IEnumerable
                var values = ExtractList(filter.Value);
                if (values.Count == 0) return "1=0"; // empty IN → always false
                var paramNames = new List<string>(values.Count);
                for (int i = 0; i < values.Count; i++)
                {
                    var pn = NextParam(ref paramIndex);
                    paramNames.Add(pn);
                    parameters.Add((pn, CoerceValue(values[i])));
                }
                return $"{col} IN ({string.Join(", ", paramNames)})";
            }

            default:
                // Unknown operator — skip (conservative: callers should validate)
                return null;
        }
    }

    // =========================================================================
    // Column descriptor builder
    // =========================================================================

    private static List<ResultColumnDto> ResolveColumns(
        ReportDefinitionDto definition,
        SemanticModelDto model)
    {
        var seen     = new HashSet<string>(StringComparer.Ordinal);
        var columns  = new List<ResultColumnDto>();
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

        foreach (var g in definition.GroupBy)
        {
            fieldMap.TryGetValue(g.Field, out var f);
            Push(g.Field, f?.Name ?? g.Field, f?.Type ?? "string", isMetric: false);
        }

        foreach (var m in definition.Metrics)
        {
            var alias = m.Alias ?? $"{m.Aggregation}_{m.Field}";
            Push(alias, alias, "number", isMetric: true);
        }

        if (!definition.GroupBy.Any() && !definition.Metrics.Any())
        {
            foreach (var c in definition.Columns)
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

    private static string NextParam(ref int index) => $"@p{index++}";

    /// <summary>Coerces a JsonElement or boxed value to a CLR primitive suitable for SqlParameter.</summary>
    private static object? CoerceValue(object? raw)
    {
        if (raw is null) return null;

        if (raw is System.Text.Json.JsonElement je)
        {
            return je.ValueKind switch
            {
                System.Text.Json.JsonValueKind.String  => je.GetString(),
                System.Text.Json.JsonValueKind.Number  => je.TryGetInt64(out var l) ? (object?)l : je.GetDouble(),
                System.Text.Json.JsonValueKind.True    => true,
                System.Text.Json.JsonValueKind.False   => false,
                System.Text.Json.JsonValueKind.Null    => null,
                _                                      => je.GetRawText(),
            };
        }

        return raw;
    }

    /// <summary>Extracts a list of values from an object that may be a JsonElement array or IEnumerable.</summary>
    private static List<object?> ExtractList(object? raw)
    {
        if (raw is null) return [];

        if (raw is System.Text.Json.JsonElement je &&
            je.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            return je.EnumerateArray().Select(el => CoerceValue(el as object)).ToList();
        }

        if (raw is System.Collections.IEnumerable en and not string)
        {
            return en.Cast<object?>().Select(CoerceValue).ToList();
        }

        // Single value wrapped in array
        return [CoerceValue(raw)];
    }
}
