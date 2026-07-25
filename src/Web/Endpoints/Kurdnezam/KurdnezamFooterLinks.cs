using Mabhas19.Application.Kurdnezam.FooterLinks;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Footer links for the kurdnezam landing site. Reads are public; writes require the Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamFooterLinks : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/footer-links";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamFooterLinks, string.Empty).AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamFooterLink, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamFooterLink, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamFooterLink, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamFooterLinkDto>>> GetKurdnezamFooterLinks(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamFooterLinksQuery()));

    public static async Task<Created<int>> CreateKurdnezamFooterLink(ISender sender, KurdnezamFooterLinkInput body)
    {
        var id = await sender.Send(new CreateKurdnezamFooterLinkCommand(body));
        return TypedResults.Created($"/api/kurdnezam/footer-links/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamFooterLink(ISender sender, int id, KurdnezamFooterLinkInput body)
    {
        await sender.Send(new UpdateKurdnezamFooterLinkCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamFooterLink(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamFooterLinkCommand(id));
        return TypedResults.NoContent();
    }
}
