using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Reports.Queries.ExecuteReport;

[Authorize]
public record ExecuteReportQuery(ReportDefinitionDto Definition) : IRequest<ReportResultDto>;

public class ExecuteReportQueryHandler : IRequestHandler<ExecuteReportQuery, ReportResultDto>
{
    private readonly IQueryEngine _engine;

    public ExecuteReportQueryHandler(IQueryEngine engine)
    {
        _engine = engine;
    }

    public Task<ReportResultDto> Handle(ExecuteReportQuery request, CancellationToken cancellationToken)
        => _engine.ExecuteAsync(request.Definition, cancellationToken);
}
