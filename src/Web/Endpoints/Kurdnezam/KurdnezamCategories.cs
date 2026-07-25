using Mabhas19.Application.Kurdnezam.Categories;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// News categories for the kurdnezam landing site. Reads are public; writes require the
/// Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamCategories : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/categories";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamCategories, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamCategoryById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamCategory, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamCategory, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamCategory, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamCategoryDto>>> GetKurdnezamCategories(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamCategoriesQuery()));

    public static async Task<Ok<KurdnezamCategoryDto>> GetKurdnezamCategoryById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamCategoryByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamCategory(ISender sender, KurdnezamCategoryInput body)
    {
        var id = await sender.Send(new CreateKurdnezamCategoryCommand(body));
        return TypedResults.Created($"/api/kurdnezam/categories/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamCategory(ISender sender, int id, KurdnezamCategoryInput body)
    {
        await sender.Send(new UpdateKurdnezamCategoryCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamCategory(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamCategoryCommand(id));
        return TypedResults.NoContent();
    }
}
