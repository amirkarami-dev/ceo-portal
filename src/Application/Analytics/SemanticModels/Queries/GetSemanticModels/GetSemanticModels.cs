using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;

namespace Mabhas19.Application.Analytics.SemanticModels.Queries.GetSemanticModels;

/// <summary>
/// Returns the catalogue of analytics semantic models available to the report engine.
/// Resolves whatever <see cref="ISemanticModelStore"/> is registered — the FarsNezam SQL
/// models when <c>ConnectionStrings:AnalyticsDb</c> is configured, the bundled sample models otherwise.
/// </summary>
[Authorize]
public record GetSemanticModelsQuery : IRequest<IReadOnlyList<SemanticModelDto>>;

public class GetSemanticModelsQueryHandler
    : IRequestHandler<GetSemanticModelsQuery, IReadOnlyList<SemanticModelDto>>
{
    private readonly ISemanticModelStore _store;
    private readonly IUser _user;

    public GetSemanticModelsQueryHandler(ISemanticModelStore store, IUser user)
    {
        _store = store;
        _user  = user;
    }

    public async Task<IReadOnlyList<SemanticModelDto>> Handle(
        GetSemanticModelsQuery request,
        CancellationToken cancellationToken)
    {
        var all = await _store.GetAllAsync(cancellationToken);

        // Models holding personal data are not offered to non-admins. This is presentation only —
        // ExecuteReportQueryHandler does the real check, because the dataset comes from the
        // request body and a hidden option is not a permission.
        if (_user.Roles?.Contains(Roles.Administrator) == true)
        {
            return all;
        }

        return all.Where(m => !m.RequiresAdministrator).ToList();
    }
}
