using Mabhas19.Application.Kurdnezam.TabGroups;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Tab groups (and their items) for the home bento panel. Reads are public; writes require the
/// Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamTabGroups : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/tab-groups";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamTabGroups, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamTabGroupById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamTabGroup, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamTabGroup, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamTabGroup, "{id:int}").RequireAdmin();

        // Items are only ever addressed through their group, so they live in this group's routes.
        groupBuilder.MapPost(CreateKurdnezamTabItem, "{id:int}/items").RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamTabItem, "items/{itemId:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamTabItem, "items/{itemId:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamTabGroupDto>>> GetKurdnezamTabGroups(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamTabGroupsQuery()));

    public static async Task<Ok<KurdnezamTabGroupDto>> GetKurdnezamTabGroupById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamTabGroupByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamTabGroup(ISender sender, KurdnezamTabGroupInput body)
    {
        var id = await sender.Send(new CreateKurdnezamTabGroupCommand(body));
        return TypedResults.Created($"/api/kurdnezam/tab-groups/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamTabGroup(ISender sender, int id, KurdnezamTabGroupInput body)
    {
        await sender.Send(new UpdateKurdnezamTabGroupCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamTabGroup(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamTabGroupCommand(id));
        return TypedResults.NoContent();
    }

    public static async Task<Created<int>> CreateKurdnezamTabItem(ISender sender, int id, KurdnezamTabItemInput body)
    {
        var itemId = await sender.Send(new CreateKurdnezamTabItemCommand(id, body));
        return TypedResults.Created($"/api/kurdnezam/tab-groups/{id}", itemId);
    }

    public static async Task<NoContent> UpdateKurdnezamTabItem(ISender sender, int itemId, KurdnezamTabItemInput body)
    {
        await sender.Send(new UpdateKurdnezamTabItemCommand(itemId, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamTabItem(ISender sender, int itemId)
    {
        await sender.Send(new DeleteKurdnezamTabItemCommand(itemId));
        return TypedResults.NoContent();
    }
}
