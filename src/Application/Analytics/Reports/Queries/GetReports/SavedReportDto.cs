using Mabhas19.Application.Analytics.Reports;

namespace Mabhas19.Application.Analytics.Reports.Queries.GetReports;

/// <summary>Saved report with the definition required by the library, viewer, and dashboard picker.</summary>
public sealed record SavedReportDto(
    int Id,
    string Name,
    string? OwnerName,
    string Visibility,
    DateTimeOffset UpdatedAt,
    ReportDefinitionDto Definition);
