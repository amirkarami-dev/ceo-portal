namespace Mabhas19.Application.Analytics.Reports;

/// <summary>Tabular result returned by the query engine after executing a report definition.</summary>
public class ReportResultDto
{
    public IReadOnlyList<ResultColumnDto> Columns { get; init; } = [];

    public IReadOnlyList<IDictionary<string, object?>> Rows { get; init; } = [];

    /// <summary>Total row count (may exceed <see cref="Rows"/>.Count when paged).</summary>
    public int Total { get; init; }
}
