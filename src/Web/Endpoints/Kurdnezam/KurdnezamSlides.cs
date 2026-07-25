using Mabhas19.Application.Kurdnezam.Slides;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Hero-slider slides for the kurdnezam landing site. Reads are public; writes require the
/// Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamSlides : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/slides";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamSlides, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamSlideById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamSlide, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamSlide, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamSlide, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamSlideDto>>> GetKurdnezamSlides(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamSlidesQuery()));

    public static async Task<Ok<KurdnezamSlideDto>> GetKurdnezamSlideById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamSlideByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamSlide(ISender sender, KurdnezamSlideInput body)
    {
        var id = await sender.Send(new CreateKurdnezamSlideCommand(body));
        return TypedResults.Created($"/api/kurdnezam/slides/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamSlide(ISender sender, int id, KurdnezamSlideInput body)
    {
        await sender.Send(new UpdateKurdnezamSlideCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamSlide(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamSlideCommand(id));
        return TypedResults.NoContent();
    }
}
