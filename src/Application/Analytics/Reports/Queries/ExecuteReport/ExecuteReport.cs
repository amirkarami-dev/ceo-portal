using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;

namespace Mabhas19.Application.Analytics.Reports.Queries.ExecuteReport;

[Authorize]
public record ExecuteReportQuery(ReportDefinitionDto Definition) : IRequest<ReportResultDto>;

public class ExecuteReportQueryHandler : IRequestHandler<ExecuteReportQuery, ReportResultDto>
{
    private readonly IQueryEngine _engine;
    private readonly ISemanticModelStore _models;
    private readonly IUser _user;

    public ExecuteReportQueryHandler(IQueryEngine engine, ISemanticModelStore models, IUser user)
    {
        _engine = engine;
        _models = models;
        _user   = user;
    }

    public async Task<ReportResultDto> Handle(ExecuteReportQuery request, CancellationToken cancellationToken)
    {
        // The Reports endpoint only requires authentication, so a model holding personal data
        // (نام / کد ملی) has to be checked here — otherwise any signed-in portal user could
        // export it. Hiding it from the dataset list is not enough: the dataset arrives in the
        // request body and could be set by hand.
        var model = await _models.GetBySourceAsync(request.Definition.Dataset, cancellationToken);

        if (model?.RequiresAdministrator == true &&
            _user.Roles?.Contains(Roles.Administrator) != true)
        {
            throw new ForbiddenAccessException();
        }

        return await _engine.ExecuteAsync(request.Definition, cancellationToken);
    }
}
