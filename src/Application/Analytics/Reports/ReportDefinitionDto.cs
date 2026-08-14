using System.Text.Json.Serialization;

namespace Mabhas19.Application.Analytics.Reports;

// ---------------------------------------------------------------------------
// Nested DTOs for the AI-generated report definition
// ---------------------------------------------------------------------------

/// <summary>
/// A dynamic date token used in <see cref="ReportFilterDto"/> when <c>dynamic=true</c>.
/// Matches the frontend's <c>DynamicValue</c> contract.
/// </summary>
public class DynamicFilterValueDto
{
    /// <summary>startOfYear | startOfMonth | today | now</summary>
    [JsonPropertyName("token")]
    public string Token { get; init; } = "today";

    /// <summary>Optional signed integer: add N months to the resolved token date.</summary>
    [JsonPropertyName("offsetMonths")]
    public int? OffsetMonths { get; init; }

    /// <summary>Optional signed integer: add N days to the resolved token date.</summary>
    [JsonPropertyName("offsetDays")]
    public int? OffsetDays { get; init; }
}

/// <summary>
/// A derived column computed from metric aliases (post-aggregate) or raw row columns (row-level).
/// Mirrors the frontend's <c>CalculatedField</c> contract.
/// </summary>
public class CalculatedFieldDto
{
    /// <summary>Output key for the computed column.</summary>
    [JsonPropertyName("alias")]
    public string Alias { get; init; } = string.Empty;

    /// <summary>Human-readable label.</summary>
    [JsonPropertyName("label")]
    public string? Label { get; init; }

    /// <summary>Safe arithmetic expression over metric aliases or raw column names.</summary>
    [JsonPropertyName("expression")]
    public string Expression { get; init; } = string.Empty;

    /// <summary>aggregate (post-groupBy) | row (per raw row). Defaults to "row".</summary>
    [JsonPropertyName("scope")]
    public string? Scope { get; init; }

    /// <summary>number | string. Defaults to "number".</summary>
    [JsonPropertyName("type")]
    public string? Type { get; init; }
}

/// <summary>A column reference in the SELECT list.</summary>
public class ReportColumnDto
{
    [JsonPropertyName("field")]
    public string Field { get; init; } = string.Empty;
}

/// <summary>A filter predicate applied before aggregation.</summary>
public class ReportFilterDto
{
    [JsonPropertyName("field")]
    public string Field { get; init; } = string.Empty;

    [JsonPropertyName("operator")]
    public string Operator { get; init; } = string.Empty;   // eq neq gt gte lt lte in notIn contains notContains startsWith endsWith between notBetween isNull isNotNull

    [JsonPropertyName("value")]
    public object? Value { get; init; }

    /// <summary>Upper bound for <c>between</c> / <c>notBetween</c> operators.</summary>
    [JsonPropertyName("value2")]
    public object? Value2 { get; init; }

    /// <summary>
    /// When <c>true</c>, <see cref="Value"/> (and <see cref="Value2"/>) may be a
    /// <see cref="DynamicFilterValueDto"/> token object instead of a literal.
    /// </summary>
    [JsonPropertyName("dynamic")]
    public bool Dynamic { get; init; }
}

/// <summary>A GROUP BY field, with an optional date bucket.</summary>
public class ReportGroupByDto
{
    [JsonPropertyName("field")]
    public string Field { get; init; } = string.Empty;

    /// <summary>day | week | month | quarter | year</summary>
    [JsonPropertyName("dateBucket")]
    public string? DateBucket { get; init; }
}

/// <summary>An aggregated measure column.</summary>
public class ReportMetricDto
{
    [JsonPropertyName("field")]
    public string Field { get; init; } = string.Empty;

    /// <summary>sum | avg | min | max | count | countDistinct</summary>
    [JsonPropertyName("aggregation")]
    public string Aggregation { get; init; } = string.Empty;

    [JsonPropertyName("alias")]
    public string? Alias { get; init; }
}

/// <summary>A sort specification.</summary>
public class ReportSortDto
{
    [JsonPropertyName("field")]
    public string Field { get; init; } = string.Empty;

    /// <summary>asc | desc</summary>
    [JsonPropertyName("direction")]
    public string Direction { get; init; } = "asc";

    /// <summary>
    /// Sort priority (lower = primary key). When absent, the order of elements
    /// in the <see cref="ReportDefinitionDto.Sorting"/> list determines priority.
    /// </summary>
    [JsonPropertyName("priority")]
    public int? Priority { get; init; }
}

// ---------------------------------------------------------------------------
// Root DTO — matches the AI JSON output and is the application's transfer object
// ---------------------------------------------------------------------------

/// <summary>
/// Portable description of a report — the full shape returned by the AI
/// and accepted by the query engine.
/// </summary>
public class ReportDefinitionDto
{
    /// <summary>Machine-readable identifier suggested by the AI.</summary>
    [JsonPropertyName("id")]
    public string? Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    /// <summary>The semantic dataset / view the report targets.</summary>
    [JsonPropertyName("dataset")]
    public string Dataset { get; init; } = string.Empty;

    /// <summary>Columns to include in the result (SELECT list).</summary>
    [JsonPropertyName("columns")]
    public IReadOnlyList<ReportColumnDto> Columns { get; init; } = [];

    [JsonPropertyName("filters")]
    public IReadOnlyList<ReportFilterDto> Filters { get; init; } = [];

    [JsonPropertyName("groupBy")]
    public IReadOnlyList<ReportGroupByDto> GroupBy { get; init; } = [];

    [JsonPropertyName("metrics")]
    public IReadOnlyList<ReportMetricDto> Metrics { get; init; } = [];

    [JsonPropertyName("sorting")]
    public IReadOnlyList<ReportSortDto> Sorting { get; init; } = [];

    [JsonPropertyName("limit")]
    public int? Limit { get; init; }

    /// <summary>Number of rows to skip before returning results (used with <see cref="Limit"/> for pagination).</summary>
    [JsonPropertyName("offset")]
    public int? Offset { get; init; }

    /// <summary>Derived columns — computed post-aggregate or per-row from arithmetic expressions.</summary>
    [JsonPropertyName("calculatedFields")]
    public IReadOnlyList<CalculatedFieldDto> CalculatedFields { get; init; } = [];

    /// <summary>
    /// The report title a person typed, per language. Null or an absent language means "no override" —
    /// fall back to <see cref="Name"/>.
    /// </summary>
    [JsonPropertyName("titleOverrides")]
    public LocalizedLabelDto? TitleOverrides { get; init; }

    /// <summary>
    /// Column labels a person typed, per language, keyed by result column key (a metric alias such as
    /// <c>sum_amount</c>, or a dimension field id).
    ///
    /// Deliberately separate from <see cref="ReportMetricDto.Alias"/> and from the frontend's
    /// <c>metric.label</c>: the AI writes a Persian <c>label</c> onto every report it generates, so the
    /// two must stay distinguishable. "A machine guessed this" is not "a human typed this", and only
    /// the second may override the composed, language-aware name.
    /// </summary>
    [JsonPropertyName("labelOverrides")]
    public IReadOnlyDictionary<string, LocalizedLabelDto>? LabelOverrides { get; init; }
}

/// <summary>
/// One human-authored string per language. Mirrors the shape the semantic model already uses for
/// field labels (<c>{ "fa-IR": …, "en-US": … }</c>), so there is one convention rather than two.
///
/// Both sides are optional on purpose: a Persian user renames a chart and the English reader keeps
/// the automatically composed name rather than being shown Persian — which is the bug the frontend's
/// label composition exists to prevent.
/// </summary>
public class LocalizedLabelDto
{
    [JsonPropertyName("fa-IR")]
    public string? FaIR { get; init; }

    [JsonPropertyName("en-US")]
    public string? EnUS { get; init; }
}
