using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Analytics.SemanticModels.Queries.GetSemanticModels;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Analytics;

/// <summary>
/// Analytics semantic-model (dataset catalogue) endpoint. Auto-mapped to <c>/api/SemanticModels</c>
/// by <see cref="Mabhas19.Web.Infrastructure.IEndpointGroup"/> conventions. Lets the prompt UI list
/// the datasets a user can generate a report against.
/// </summary>
public class SemanticModels : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(GetSemanticModels, string.Empty);
    }

    public static async Task<Ok<IReadOnlyList<SemanticModelDto>>> GetSemanticModels(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetSemanticModelsQuery()));
}
