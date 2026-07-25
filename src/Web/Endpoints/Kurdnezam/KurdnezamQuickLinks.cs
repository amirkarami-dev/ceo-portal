using Mabhas19.Application.Kurdnezam.QuickLinks;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Quick links (header dock + footer shortcuts) for the kurdnezam landing site. Reads are public;
/// writes require the Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamQuickLinks : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/quick-links";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamQuickLinks, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamQuickLinkById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamQuickLink, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamQuickLink, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamQuickLink, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamQuickLinkDto>>> GetKurdnezamQuickLinks(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamQuickLinksQuery()));

    public static async Task<Ok<KurdnezamQuickLinkDto>> GetKurdnezamQuickLinkById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamQuickLinkByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamQuickLink(ISender sender, KurdnezamQuickLinkInput body)
    {
        var id = await sender.Send(new CreateKurdnezamQuickLinkCommand(body));
        return TypedResults.Created($"/api/kurdnezam/quick-links/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamQuickLink(ISender sender, int id, KurdnezamQuickLinkInput body)
    {
        await sender.Send(new UpdateKurdnezamQuickLinkCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamQuickLink(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamQuickLinkCommand(id));
        return TypedResults.NoContent();
    }
}
