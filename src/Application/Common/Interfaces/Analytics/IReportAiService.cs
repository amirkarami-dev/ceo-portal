using Mabhas19.Application.Analytics.Reports;

namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>Generates a <see cref="ReportDefinitionDto"/> from a natural-language prompt using AI.</summary>
public interface IReportAiService
{
    Task<ReportDefinitionDto> GenerateAsync(string prompt, string semanticModelId, CancellationToken cancellationToken = default);
}
