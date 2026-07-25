using Mabhas19.Application.Kurdnezam.OrgPages;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Static organisation pages (<c>/p/{slug}</c>) for the kurdnezam landing site. Reads are public;
/// writes require the Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamOrgPages : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/org-pages";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamOrgPages, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamOrgPageBySlug, "{slug}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamOrgPage, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamOrgPage, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamOrgPage, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamOrgPageDto>>> GetKurdnezamOrgPages(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamOrgPagesQuery()));

    public static async Task<Ok<KurdnezamOrgPageDto>> GetKurdnezamOrgPageBySlug(ISender sender, string slug)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamOrgPageBySlugQuery(slug)));

    public static async Task<Created<int>> CreateKurdnezamOrgPage(ISender sender, KurdnezamOrgPageInput body)
    {
        var id = await sender.Send(new CreateKurdnezamOrgPageCommand(body));
        return TypedResults.Created($"/api/kurdnezam/org-pages/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamOrgPage(ISender sender, int id, KurdnezamOrgPageInput body)
    {
        await sender.Send(new UpdateKurdnezamOrgPageCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamOrgPage(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamOrgPageCommand(id));
        return TypedResults.NoContent();
    }
}
