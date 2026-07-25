namespace Mabhas19.Application.Analytics.Reports;

/// <summary>Describes a single column in a <see cref="ReportResultDto"/>.</summary>
public class ResultColumnDto
{
    /// <summary>Machine-readable column key — matches the key used in each result row dictionary.</summary>
    public string Key { get; init; } = string.Empty;

    /// <summary>Human-readable label for display.</summary>
    public string Label { get; init; } = string.Empty;

    /// <summary>
    /// Kept for backward compatibility; mirrors <see cref="Label"/>.
    /// Prefer <see cref="Label"/> for new code.
    /// </summary>
    public string Name => Label;

    /// <summary>Data type hint for the client: "string" | "number" | "date".</summary>
    public string DataType { get; init; } = "string";

    /// <summary>
    /// <c>true</c> for aggregated measures and calculated fields;
    /// <c>false</c> for dimension / groupBy columns.
    /// </summary>
    public bool IsMetric { get; init; }
}
