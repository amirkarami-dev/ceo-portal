namespace Mabhas19.Application.Analytics.Reports.Queries.GetReports;

/// <summary>Summary row for the saved-reports list (DefinitionJson is not included).</summary>
public sealed record SavedReportDto(
    int Id,
    string Name,
    string? OwnerName,
    string Visibility,
    DateTimeOffset UpdatedAt);
