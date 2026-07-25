using Mabhas19.Application.Analytics.Reports;

namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>Executes a report definition against the underlying data store and returns tabular results.</summary>
public interface IQueryEngine
{
    Task<ReportResultDto> ExecuteAsync(ReportDefinitionDto definition, CancellationToken cancellationToken = default);
}
