using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

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

    public GetSemanticModelsQueryHandler(ISemanticModelStore store) => _store = store;

    public Task<IReadOnlyList<SemanticModelDto>> Handle(
        GetSemanticModelsQuery request,
        CancellationToken cancellationToken)
        => _store.GetAllAsync(cancellationToken);
}
