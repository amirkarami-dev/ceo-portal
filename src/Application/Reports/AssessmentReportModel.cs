namespace Mabhas19.Application.Reports;

/// <summary>Flat model passed to the PDF generator for an assessment report.</summary>
public record AssessmentReportModel
{
    public string ProjectTitle { get; init; } = string.Empty;
    public string? Client { get; init; }
    public string? Address { get; init; }
    public string City { get; init; } = string.Empty;
    public string ClimateCode { get; init; } = string.Empty;
    public string ClimateLabel { get; init; } = string.Empty;
    public double TotalArea { get; init; }
    public int FloorCount { get; init; }
    public int UnitCount { get; init; }
    public string? Usage { get; init; }
    public string BuildingGroupLabel { get; init; } = string.Empty;
    public int TotalScore { get; init; }
    public int MaxScore { get; init; }
    public DateTimeOffset GeneratedAt { get; init; }

    public IReadOnlyList<ReportSection> Sections { get; init; } = new List<ReportSection>();

    public record ReportSection(string Key, string Title, int Score, int MaxScore);
}
