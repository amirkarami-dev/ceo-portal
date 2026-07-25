using Mabhas19.Application.Kurdnezam.Units;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Organisational units for the kurdnezam landing site. Reads are public; writes require the
/// Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamUnits : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/units";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamUnits, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamUnitById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamUnit, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamUnit, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamUnit, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamUnitDto>>> GetKurdnezamUnits(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamUnitsQuery()));

    public static async Task<Ok<KurdnezamUnitDto>> GetKurdnezamUnitById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamUnitByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamUnit(ISender sender, KurdnezamUnitInput body)
    {
        var id = await sender.Send(new CreateKurdnezamUnitCommand(body));
        return TypedResults.Created($"/api/kurdnezam/units/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamUnit(ISender sender, int id, KurdnezamUnitInput body)
    {
        await sender.Send(new UpdateKurdnezamUnitCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamUnit(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamUnitCommand(id));
        return TypedResults.NoContent();
    }
}
