using Mabhas19.Application.Kurdnezam.Common;
using Mabhas19.Application.Kurdnezam.News;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// News for the kurdnezam landing site. Reads are public; writes require the Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamNews : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/news";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamNews, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamNewsById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamNews, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamNews, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamNews, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<KurdnezamPagedResult<KurdnezamNewsDto>>> GetKurdnezamNews(
        ISender sender,
        int? categoryId = null,
        string? q = null,
        bool? featured = null,
        int? unitId = null,
        int page = 1,
        int pageSize = 12)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamNewsQuery(categoryId, q, featured, unitId, page, pageSize)));

    public static async Task<Ok<KurdnezamNewsDto>> GetKurdnezamNewsById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamNewsByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamNews(ISender sender, KurdnezamNewsInput body)
    {
        var id = await sender.Send(new CreateKurdnezamNewsCommand(body));
        return TypedResults.Created($"/api/kurdnezam/news/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamNews(ISender sender, int id, KurdnezamNewsInput body)
    {
        await sender.Send(new UpdateKurdnezamNewsCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamNews(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamNewsCommand(id));
        return TypedResults.NoContent();
    }
}
